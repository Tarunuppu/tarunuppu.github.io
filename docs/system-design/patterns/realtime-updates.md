---
sidebar_position: 1
title: When the server has news
sidebar_label: "Realtime updates: When the server has news"
hide_table_of_contents: true
---

# When the server has news

<Updated date="2026-10-17" />

<Topics tags={['Polling / long polling', 'SSE', 'WebSockets', 'Consistent-hashing routing', 'Pub/Sub', 'Reconnection & ordering']} />

Every lesson so far assumed the same shape: the client asks, the server answers. But plenty of data changes on the *server's* side — a stock price ticks, a dashboard metric moves, a teammate edits the same document — and the client needs to know *now*, without having asked. That inverts the usual flow: the server has news, and it has to reach a client who isn't currently asking for anything.

Doing that well is really two separate questions, and it's worth keeping them apart:

1. **The connection** — how does an update physically travel from a server to a client?
2. **The trigger** — how does *that* server find out there's an update to send in the first place?

## Part 1 — getting the update to the client

Four options, from most wasteful to most capable.

### Polling

The client asks, on a timer, "anything new since my last check?" If there's an update, the server returns it; if not, it returns an empty response. Simple, but at scale it's brutal: millions of clients hammering the server every few seconds, and most of the time the honest answer is "nothing yet" — enormous load for almost no useful work.

:::note The connection underneath
Before any request is sent, the client and server first establish a **TCP connection** — the three-way handshake from [What happens when you open a web page](../building-blocks/web-page-journey). That connection is the "pipe": a two-way channel that carries bytes in both directions and stays open until one side deliberately closes it. Setting it up costs a round trip, which is exactly why holding one open and reusing it is worth the trouble.

An ordinary exchange over that pipe is brief — the client sends a request, the server sends back one complete response, and it's done. But the server isn't *obliged* to behave that way; it has two liberties the techniques below rely on:

- **Hold the request** — it can take a request and simply *not answer yet*, leaving the response unsent while the pipe stays open.
- **Keep writing** — it doesn't have to send the whole response at once; HTTP can stream a body out in pieces (**chunked transfer encoding**), so the server can keep pushing more bytes down the *same* open pipe.

So "holding a request open" and "sending more data over an already-open connection" aren't new protocols — they're just these two liberties, put to use.
:::

### Long polling

The same idea, with one change: instead of instantly replying "nothing," the server **holds the request open** — it parks the request and waits — until it actually has an update (or a timeout fires), then responds. That kills the flood of empty responses, but it brings two costs:

- **Long-lived state.** A normal HTTP request is in and out in milliseconds — the server handles it and immediately forgets it. A long-polled request instead sits *parked* for seconds or minutes, holding a connection and some memory the whole time. One is cheap; a million of them, all held open at once, tie up real resources. "State the server has to keep, per client, for a long time" is exactly what makes a system harder to scale and restart — so we try to minimise how long any request stays open.
- **Latency on the *next* update.** Long polling runs in a cycle: ask → wait → receive → **reconnect** → ask again. Delivering an update *closes* the connection, and the client has to open a fresh request before it can receive the next one. In the small gap while it's reconnecting, there's no open line — so an update that lands in that window just has to wait until the new request arrives. For rapid-fire updates, those gaps add up.

<figure className="diagram">
<svg viewBox="0 0 620 236" width="620" height="236" role="img" aria-label="A long-polling timeline. The server holds each request open for a while (shaded bands), which is per-client state. Update A is delivered and the connection closes; while the client reconnects there is no open line, so update B, which arrives during that gap, is delayed until the client's next request.">
  <defs>
    <marker id="lp-arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <text className="d-text" x="30" y="52" fontSize="12" textAnchor="start">Client</text>
  <text className="d-text" x="30" y="162" fontSize="12" textAnchor="start">Server</text>
  <line className="d-stroke" x1="78" y1="48" x2="574" y2="48" strokeWidth="0.75" strokeDasharray="2 3" />
  <line className="d-stroke" x1="78" y1="158" x2="574" y2="158" strokeWidth="0.75" strokeDasharray="2 3" />
  <rect className="d-fill" x="96" y="48" width="150" height="110" />
  <text className="d-text" x="171" y="178" fontSize="10.5" textAnchor="middle">held open (state)</text>
  <line className="d-accent-stroke" x1="98" y1="52" x2="112" y2="154" strokeWidth="1.25" markerEnd="url(#lp-arrow)" />
  <circle className="d-accent" cx="246" cy="158" r="4" />
  <line className="d-accent-stroke" x1="248" y1="154" x2="264" y2="52" strokeWidth="1.25" markerEnd="url(#lp-arrow)" />
  <text className="d-text" x="268" y="44" fontSize="10.5" textAnchor="start">update A ✓</text>
  <text className="d-text" x="330" y="106" fontSize="10.5" textAnchor="middle">no open</text>
  <text className="d-text" x="330" y="120" fontSize="10.5" textAnchor="middle">line</text>
  <circle className="d-accent" cx="330" cy="158" r="4" />
  <text className="d-text" x="330" y="178" fontSize="10.5" textAnchor="middle">update B arrives</text>
  <rect className="d-fill" x="414" y="48" width="150" height="110" />
  <line className="d-accent-stroke" x1="416" y1="52" x2="430" y2="154" strokeWidth="1.25" markerEnd="url(#lp-arrow)" />
  <line className="d-accent-stroke" x1="432" y1="154" x2="448" y2="52" strokeWidth="1.25" markerEnd="url(#lp-arrow)" />
  <text className="d-text" x="452" y="44" fontSize="10.5" textAnchor="start">update B ✓</text>
  <line className="d-accent-stroke" x1="330" y1="206" x2="430" y2="206" strokeWidth="1" markerEnd="url(#lp-arrow)" />
  <text className="d-text" x="380" y="224" fontSize="10.5" textAnchor="middle">B's delay</text>
  <text className="d-text" x="574" y="206" fontSize="10" textAnchor="end">time →</text>
</svg>
<figcaption>Each shaded band is one request the server holds open — cheap once, costly across millions (the <strong>state</strong>). Update A is delivered and the connection closes; update B lands during the reconnect gap, when there's no open line, so it waits until the client's next request (the <strong>latency</strong>). SSE removes both by keeping a single connection open the whole time.</figcaption>
</figure>

### Server-Sent Events (SSE)

The client opens **one long-lived connection** and leaves it open; the server pushes events down it the moment it has one. Each update rides down that *same* open connection as its own packet — SSE leans on HTTP's ability to send a response body in pieces (the "keep writing" liberty above), instead of one complete reply. (The connection isn't infinite — SSE typically refreshes every ~30 seconds, the server asking the client to reconnect.) It's a one-way street — server to client — and it's a great fit for **high-frequency updates** with none of long polling's latency. We first met it in [How services talk](../building-blocks/how-services-talk).

### WebSockets

A **stateful, bidirectional** protocol riding on a TCP connection — so it inherits TCP's ordering and reliability. Either side can send at any time, over a connection that may stay open for hours. The catch is that everything *between* client and server (proxies, load balancers) must tolerate long-lived connections. Reach for it when you genuinely need a **two-way** channel at low latency — a chat app, a collaborative editor, a multiplayer game.

| Transport | Direction | How it works | Best for |
| --- | --- | --- | --- |
| **Polling** | client pulls | ask on a timer | simple, rare updates (and you can tolerate waste) |
| **Long polling** | client pulls | server holds the request until there's news | occasional updates, no persistent-connection support |
| **SSE** | server → client | one long-lived connection, server streams events | frequent, one-way updates (feeds, dashboards) |
| **WebSockets** | both ways | persistent bidirectional channel over TCP | two-way, low-latency (chat, games, co-editing) |

## Part 2 — how the sending server gets the update

Here's the subtler half. Say a client holds an open SSE or WebSocket connection to Server B. When an update for *that* client appears somewhere in your system, how does Server B come to know it should push something down that connection?

### Pull — the server polls the database

The client's own poll is the trigger: when it asks, the server checks the database. It's the simplest model and it has the same two weaknesses as polling did — **latency** (the gap between an update landing in the database and a server noticing it) and **wasted database load** when updates are rare but polls are frequent. Perfectly fine when you don't actually need realtime; a poor fit when you do.

The two real push models are below, and the whole game is getting the update to the *one* server that holds the target client's connection.

### Push via consistent-hashing routing

Pin every client to a specific server, chosen by hashing its ID — the [consistent hashing](../building-blocks/consistent-hashing) from the building blocks, used here to route *connections* instead of data.

- **Connecting:** the client connects to any server; that server knows the hash function and the server set, computes which server this client *should* be on, and either keeps the connection or redirects the client to the right one.
- **Triggering:** when an update for a client arrives, the update service runs the same hash — kept in sync across services by a coordination service like **ZooKeeper** — to find which server holds that client's connection, then pings it directly. That server pushes to the client.

It's the right choice when connections are **persistent** (WebSocket/SSE), the system must **scale dynamically**, and each connection carries **significant server-side state** that would be expensive to rebuild.<Sidenote>Why consistent hashing specifically, rather than plain `hash % N`? Because adding or removing a server with `% N` would reshuffle nearly every client — disconnecting them all, forcing reconnections, and rebuilding each connection's server-side state (who's connected, session metadata, and so on) from scratch. Consistent hashing moves only a small fraction of clients when the fleet changes, so most connections and their state survive.</Sidenote> It shines when the destination is **fixed and predictable** — route everyone editing one Google Doc, or playing in one game room, to the same server, which can then hold the shared state in memory.

### Push via Pub/Sub

Instead of pinning each client to a specific server, put a **message broker** in the middle and let it fan updates out. Everything hangs on one idea — a **topic**, a named channel that interested parties *subscribe* to and that updates are *published* to — plus two small lookup tables, one at each level.

**Where the state lives.** Two maps make it work:

- **The broker** keeps, per topic, the list of **endpoint servers subscribed to it** (`topic → servers`). It doesn't track individual clients at all — only which servers want each topic.
- **Each endpoint server** keeps its *own* map of `topic → its open connections` — which of the many clients connected to *it* care about each topic.

```
Broker        stock:AAPL → [ E1, E2 ]        (topic → subscribed servers)

Endpoint E1   stock:AAPL → [ C1, C3 ]        (topic → its own client connections)
Endpoint E2   stock:AAPL → [ C2 ]
```

**Connecting.** A client connects to an endpoint server and asks for a topic. The server (1) subscribes to that topic on the broker, if it hasn't already, and (2) adds `topic → this connection` to its own map.

**Broadcasting.** When an update for `stock:AAPL` is published to the broker:

1. The broker looks up the topic's subscriber list — `[E1, E2]` — and sends the update to each of those servers. *(That's the fan-out.)*
2. Each server looks up the topic in its *own* map to find exactly which of its connections care — E1 finds `C1, C3`, E2 finds `C2` — and writes the update down those connections.

The trade-offs:

- **Upsides** — load is easy to manage (a plain "least connections" load balancer works, since any endpoint server can serve any client), broadcasting to huge numbers of clients is efficient, and you keep connection state from spreading all through the system.
- **Downsides** — endpoint servers don't inherently know whether a subscriber is still connected or when it drops; the Pub/Sub service is a **single point of failure and a bottleneck**; and it adds a layer of indirection between the update source and the client.<Sidenote>That extra hop — update source → Pub/Sub service → endpoint server → client — is a layer the consistent-hashing model doesn't have, where the update service pings the client's server directly. The indirection costs a little latency and creates many-to-many connections between Pub/Sub hosts and endpoint servers.</Sidenote>

### Choosing between them

<figure className="diagram">
<svg viewBox="0 0 620 300" width="620" height="300" role="img" aria-label="Two push models. Top: consistent-hashing routing — an update service hashes the client id and pings the one server holding that client, which forwards to the client. Bottom: pub/sub — an update service publishes to a topic, which fans out to several endpoint servers, each forwarding to its clients.">
  <defs>
    <marker id="rt-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <text className="d-text" x="20" y="28" fontSize="12.5" textAnchor="start">Consistent hashing — direct, pinned route</text>
  <rect className="d-fill" x="20" y="44" width="92" height="42" rx="6" />
  <rect className="d-stroke" x="20" y="44" width="92" height="42" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="66" y="70" fontSize="12" textAnchor="middle">Update svc</text>
  <line className="d-accent-stroke" x1="112" y1="65" x2="236" y2="65" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <text className="d-text" x="174" y="57" fontSize="10.5" textAnchor="middle">hash(id) → B</text>
  <rect className="d-fill" x="238" y="44" width="92" height="42" rx="6" />
  <rect className="d-stroke" x="238" y="44" width="92" height="42" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="284" y="70" fontSize="12" textAnchor="middle">Server B</text>
  <line className="d-accent-stroke" x1="330" y1="65" x2="430" y2="65" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <circle className="d-fill" cx="462" cy="65" r="16" />
  <circle className="d-stroke" cx="462" cy="65" r="16" strokeWidth="1.5" />
  <text className="d-text" x="462" y="69" fontSize="10.5" textAnchor="middle">client</text>
  <line className="d-stroke" x1="20" y1="112" x2="600" y2="112" strokeWidth="0.75" strokeDasharray="2 3" />
  <text className="d-text" x="20" y="140" fontSize="12.5" textAnchor="start">Pub/Sub — broadcast fan-out</text>
  <rect className="d-fill" x="20" y="200" width="92" height="42" rx="6" />
  <rect className="d-stroke" x="20" y="200" width="92" height="42" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="66" y="226" fontSize="12" textAnchor="middle">Update svc</text>
  <line className="d-accent-stroke" x1="112" y1="221" x2="176" y2="221" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <rect className="d-fill" x="178" y="200" width="86" height="42" rx="6" />
  <rect className="d-stroke" x="178" y="200" width="86" height="42" rx="6" strokeWidth="1.5" />
  <text className="d-text" x="221" y="226" fontSize="12" textAnchor="middle">Pub/Sub</text>
  <line className="d-accent-stroke" x1="264" y1="215" x2="372" y2="169" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <line className="d-accent-stroke" x1="264" y1="221" x2="372" y2="221" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <line className="d-accent-stroke" x1="264" y1="227" x2="372" y2="273" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <rect className="d-fill" x="374" y="152" width="80" height="34" rx="5" />
  <rect className="d-stroke" x="374" y="152" width="80" height="34" rx="5" strokeWidth="1.25" />
  <text className="d-text" x="414" y="173" fontSize="11" textAnchor="middle">Server 1</text>
  <rect className="d-fill" x="374" y="204" width="80" height="34" rx="5" />
  <rect className="d-stroke" x="374" y="204" width="80" height="34" rx="5" strokeWidth="1.25" />
  <text className="d-text" x="414" y="225" fontSize="11" textAnchor="middle">Server 2</text>
  <rect className="d-fill" x="374" y="256" width="80" height="34" rx="5" />
  <rect className="d-stroke" x="374" y="256" width="80" height="34" rx="5" strokeWidth="1.25" />
  <text className="d-text" x="414" y="277" fontSize="11" textAnchor="middle">Server 3</text>
  <line className="d-accent-stroke" x1="454" y1="169" x2="498" y2="169" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <line className="d-accent-stroke" x1="454" y1="221" x2="498" y2="221" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <line className="d-accent-stroke" x1="454" y1="273" x2="498" y2="273" strokeWidth="1.5" markerEnd="url(#rt-arrow)" />
  <circle className="d-fill" cx="516" cy="169" r="13" />
  <circle className="d-stroke" cx="516" cy="169" r="13" strokeWidth="1.25" />
  <circle className="d-fill" cx="516" cy="221" r="13" />
  <circle className="d-stroke" cx="516" cy="221" r="13" strokeWidth="1.25" />
  <circle className="d-fill" cx="516" cy="273" r="13" />
  <circle className="d-stroke" cx="516" cy="273" r="13" strokeWidth="1.25" />
</svg>
<figcaption>Two ways the update reaches the client's server. Consistent hashing pings the one server that owns the client — direct, pinned. Pub/Sub publishes once and lets the broker fan the update out to every subscribed server — decoupled, broadcast.</figcaption>
</figure>

The deciding question is **how the update needs to travel**:

- **Consistent hashing** when there's a specific, predictable "home" for each client or piece of shared state. Routing everyone to one server gives you data locality and lets that server hold the live state in RAM.
    - *Collaboration & games* (Google Docs, Figma, a multiplayer match) — hash the document or match ID so every participant lands on the one server holding the master state, syncing at microsecond latency with no broker in the path.
    - *1-on-1 chat* (WhatsApp-style) — hash the recipient's ID to find the exact server holding their socket, and route the message straight there over an internal call.
- **Pub/Sub** when you need to **broadcast to many independent consumers** that don't know about each other.
    - *Multi-service events* — "Order placed" is published once; inventory, payments, notifications, and analytics each react on their own.
    - *Fan-out feeds* (a celebrity's post reaching 10 million timelines) and *live-stream chat* — the broker handles the massive duplication asynchronously, so the publisher never blocks trying to deliver millions of copies itself.

:::tip In an interview
Keep the two questions separate — *transport* (SSE vs WebSockets) and *trigger* (consistent hashing vs Pub/Sub) — and justify each on its own. A clean line like "SSE for the one-way price feed, and Pub/Sub to fan each symbol's updates out to every subscribed server" shows you know they're independent choices.
:::

## Two things that bite in production

- **Reconnection.** Connections drop. To recover cleanly, track what each client has already received — a per-user message queue, or **sequence numbers** the client replays from on reconnect — so it gets exactly what it missed and no more. Redis streams are a common tool for this.
- **Ordering across servers.** When updates flow through many servers, two messages sent moments apart can arrive out of order if they take different paths. **Logical timestamps** (or vector clocks) can re-establish order, but the simpler move — and the right one for most interviews — is to **funnel all related messages through a single server or partition**, where stamping a total order is trivial. You trade a little scalability for a lot of simplicity.

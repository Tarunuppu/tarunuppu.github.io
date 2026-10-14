---
sidebar_position: 2
title: How services talk to each other
sidebar_label: "APIs: How services talk to each other"
hide_table_of_contents: true
---

# How services talk to each other

<Topics tags={['HTTP vs API', 'REST', 'GraphQL', 'gRPC', 'Protocol Buffers', 'WebSockets / SSE']} />

The previous lesson ended at HTTP — the envelope a request travels in. But HTTP only says how to *package* a request and a response; it says nothing about what any particular request *means*. You can speak HTTP flawlessly, send a perfectly valid `GET /user/42`, and still get nothing useful back, because the server was never told that `/user/42` is a thing anyone can ask for.

That agreement — what you're allowed to ask for, and what you'll get back — is the **API**. This lesson draws the line between HTTP and the API, then walks the three shapes an API usually takes (REST, GraphQL, gRPC) and the trade each one makes.

## HTTP carries; the API is the contract

It's worth being exact about the split, because they're easy to conflate:

- **HTTP** defines *how data is transmitted* over the web — the communication protocol, the envelope.
- **The API** defines *what can be requested and what will be returned* — the contract between client and server.

Even with no API at all, HTTP can still carry a request to a server. It just won't achieve anything: without predefined endpoints and server-side logic to recognise it, the request has no meaning on the other end and nothing handles it.<Sidenote>Think of HTTP as a correctly addressed, correctly stamped envelope. It reaches the building — but unless someone inside has agreed to read that kind of letter and reply, it just sits there. The API is that agreement.</Sidenote>

So the interesting question isn't *how* the request travels — that's settled — but what the contract should look like. There are three common answers.

## REST

REST is the default style, and its core idea is a discipline about naming: model everything the server exposes as a **resource**, and let each request be a **verb acting on a resource** — the HTTP method is the verb, the path names the resource.

| Request | What it means |
| --- | --- |
| `GET /user/{id}` | Read one user |
| `POST /user` (+ body) | Create a user |
| `PUT /user/{id}` | Replace that user |
| `GET /user/{id}/post/{post_id}` | Read one post belonging to a user |

Notice what the paths have in common: they all name *things*. The method already supplies the action, so the path shouldn't. This is the usual way to go wrong:

```
PUT /updateUser/{id}   ❌ not RESTful
```

`updateUser` is an **action**, not a resource — and the verb (`PUT`) was already going to say "update." Naming the action in the path as well is the tell that a design has stopped being RESTful.

REST's weakness is performance at the extremes. It is **not the most performant choice for very high-throughput services**, and part of the reason is the wire format: JSON is a fairly inefficient format to serialise and deserialise.<Sidenote>JSON is text. Every number, bracket, and quote is characters a machine has to write on one side and parse back on the other — cheap once, but a real cost at millions of requests per second.</Sidenote> That cost is exactly what the next two styles push against, from opposite directions.

## GraphQL

REST tends to have two matching problems, both about the *shape* of what comes back:

- **Over-fetching** — an endpoint returns more than the screen actually needs, so you pay for data you throw away.
- **Under-fetching** — one endpoint doesn't return enough, so the client has to make several more round trips to assemble one view.

GraphQL's whole idea is to **fetch only the data that is needed**: the client states exactly which fields it wants, and the server returns exactly those — no more, no fewer — usually in a single request. A UI asks for just the data it needs to render the page, and nothing else comes along for the ride.

## gRPC

gRPC is Google's **Remote Procedure Call** framework — it lets one service call a function in another as if it were a local function call. It keeps HTTP as the transport<Sidenote>HTTP/2, specifically.</Sidenote> but changes how the message is encoded: instead of JSON text, it uses a compact **binary format** called Protocol Buffers.<Sidenote>Both sides agree on the message's fields ahead of time, so the encoded data carries only the values — no field names or punctuation.</Sidenote> Binary is smaller and faster for a machine to parse than text, which is what makes gRPC more efficient than JSON over HTTP. What it improves is the encoding, not HTTP itself.

That efficiency matters most **between internal services** — systems you control that call each other constantly, where speed counts for more than being easy to call from a browser.

## When request–response isn't enough

REST, GraphQL, and gRPC are all variations on the same pattern: the client asks, the server answers, the exchange ends. Some problems don't fit that shape — the server needs to *push* updates as they happen, or both sides need to talk at once. Those are served by a different family: **Server-Sent Events (SSE)**, **WebSockets**, and **WebRTC**.<Sidenote>Briefly: SSE is a one-way stream from server to client over HTTP; WebSockets is a two-way, always-open channel; WebRTC is a peer-to-peer link for real-time audio, video, and data.</Sidenote> They have their own lesson in the patterns cluster, under real-time updates — here it's enough to know they exist and that they sit outside the request-and-response world the three styles above live in.

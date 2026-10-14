---
sidebar_position: 3
title: Spreading the load
sidebar_label: "Load balancing: Spreading the load"
hide_table_of_contents: true
---

# Spreading the load

<Topics tags={['Vertical vs horizontal scaling', 'Load balancers', 'Client-side LB', 'Layer 4 vs Layer 7', 'Health checks', 'LB algorithms']} />

One server has a ceiling. Enough traffic, and it runs out of CPU, memory, or connections, and requests start to queue or fail. There are only two ways out, and the second one creates the problem this lesson is about.

## Two ways to scale

- **Vertical scaling** — replace the server with a bigger one: more CPU, more memory. Simple, but there's a hard ceiling; the largest machine you can buy is still one machine, and one machine can still fail.
- **Horizontal scaling** — add more servers and share the work across them. This scales much further, but it raises a new question: when a request arrives, *which* of the servers should handle it?

Distributing those requests across the pool is **load balancing**, and it can happen in one of two places: inside the **client** itself, or in a **dedicated load balancer** between the clients and the servers.

## Who decides: client-side vs dedicated

### Client-side load balancing

Here the **client's own code** chooses which server to call. It reads from a registry — a directory of the servers currently available — and picks one itself.<Sidenote>This usually means the client embeds a small library that knows how to do the choosing. A Redis cluster, for example, expects clients to use a Redis client library (such as Jedis for Java) that handles the routing.</Sidenote>

- **Upside:** it's fast — there's no separate load balancer sitting in the request path adding a hop, and the server is freed of that work.
- **Downside:** every client has to be kept up to date as the set of servers changes. With many clients, that information takes time to propagate.

Examples: a **Redis cluster**, and **DNS**.

That downside decides when it's a good fit:

- **Few clients** (especially ones you control) → client-side works well.
- **Many clients** → only if they can **tolerate update delays** while server changes propagate. If they can't, use a dedicated load balancer instead.

### Dedicated load balancer

Here a **separate server or hardware device** sits between the clients and the backend servers and makes the routing decision for them. Where it can route depends on how deep into the request it looks — which maps onto the network layers from the first lesson:

| | **Layer 4** | **Layer 7** |
| --- | --- | --- |
| Operates at | Transport layer (TCP) | Application layer (HTTP) |
| Routes based on | IP addresses and ports, without reading the content | The actual content of each request |
| Cost | Fast — minimal packet inspection | More CPU — it inspects each request |
| Best for | Raw performance (e.g. WebSockets) | HTTP traffic, where smarter routing and more features help |

One consequence of Layer 4 working at the TCP level: it **pins a connection to a server**. Once a client opens a TCP connection through an L4 balancer, that same backend handles every request in that session — which is exactly what long-lived connections like WebSockets need.

:::tip Health checks
A load balancer continuously **health-checks** the servers behind it. If one stops responding, it stops sending that server traffic until it recovers — so a dead server quietly reduces capacity instead of failing requests.
:::

## How it chooses: algorithms

Health checks tell the balancer which servers are *available* — not which one to use. With several healthy servers in the pool, it still needs a rule for picking one for each incoming request, and that rule is its **balancing algorithm**. The common ones:

- **Round robin** — each server in turn.
- **Random** — pick one at random.
- **Least connections** — the server currently handling the fewest.
- **Least response time** — the server answering fastest right now.
- **IP hash** — the client's IP decides the server, so a given client keeps landing on the same one. Useful when the connection needs to be persistent.

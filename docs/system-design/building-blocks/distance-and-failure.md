---
sidebar_position: 4
title: Distance and failure
sidebar_label: "Latency & resilience: Distance and failure"
hide_table_of_contents: true
---

# Distance and failure

<Topics tags={['Network latency', 'CDN', 'Regional partitioning', 'Timeouts & retries', 'Exponential backoff', 'Idempotency', 'Circuit breakers']} />

The earlier lessons quietly assumed the network just works: the request goes out, the response comes back. Across a real internet it doesn't, for two physical reasons. Distance is one — signals take time to cross the planet, and that time is latency the user feels. Failure is the other — links and machines go down. This lesson is the defensive toolkit for both, plus the second-order problem that failure creates when it spreads.

## The cost of distance

The further a request has to travel between client and server, the longer it takes: more distance means higher latency and a slower response. You can't beat the speed of light, so both fixes are about **shortening the distance** rather than speeding up the trip. There are two common strategies.

**Content Delivery Network (CDN).** A CDN is a network of servers placed strategically around the world to keep data close to the user, serving it from a nearby location using caching instead of going all the way back to the origin. When the data a user needs sits a city away instead of a continent away, the round trip is simply shorter.

**Regional partitioning.** When the application allows it, you can split the data and the servers by region, so a request is served entirely within its own region. Uber is the classic example: a rider in a city only needs drivers in that same city, so you can keep a database of just that city's drivers, in that city, and have local servers answer local requests. People in one city only ever touch their region's data and servers.

## Surviving failures

Networks fail in ordinary ways — power cuts, cut cables. A request can simply get no answer, and the system has to cope rather than hang. The first-line tools are **timeouts, retries, and backoff**:

- **Timeout** — don't wait forever. If a request hasn't responded within some limit, give up on it and try again.
- **Retries** — try again, but a bounded number of times. You can't retry indefinitely.
- **Backoff** — wait a little between retries, to give a struggling server room to recover rather than being hit again immediately.

That last one has a trap. If a server goes down and every client retries at the same fixed interval, they all come back *together*, in lockstep, and hammer the recovering server at the same instant<Sidenote>This synchronised retry storm is often called a **thundering herd**.</Sidenote> — the worst possible case. The fix is **exponential backoff with randomness**: grow the wait after each failure (so clients back off harder the longer the outage lasts), and add a little randomness<Sidenote>The random offset is called **jitter**.</Sidenote> so the retries scatter in time instead of landing on the same beat.

There's one condition that makes all of this safe. Suppose a request *did* reach the server and do its work, but the response was lost on the way back. The client, hearing nothing, retries — and the operation runs a second time. So every technique above depends on the request being **idempotent**: an operation is idempotent if running it many times leaves the server in the same state as running it once, so a duplicate retry does no harm.<Sidenote>`GET`, `PUT`, and `DELETE` are naturally idempotent; `POST` usually isn't, since each call tends to create another resource.</Sidenote> Without that, a lost response plus a retry could charge a customer twice.

## When failure spreads: cascading failures

The dangerous version of failure isn't one component going down — it's that failure spreading. A **cascading failure** is a domino effect in a distributed system: one component fails, which overloads or breaks the healthy components depending on it, which break the ones depending on *them*, until a small original problem has collapsed the whole system.

The standard defence is a **circuit breaker**. If a service notices that a dependency it calls is failing continuously, it "trips" — it stops forwarding calls to that dependency and immediately fails those requests itself for a cool-off period, without making the call at all. That does two things: it stops the caller from piling up requests that are doomed anyway, and it gives the failing dependency room to recover instead of being buried under traffic while it's down.

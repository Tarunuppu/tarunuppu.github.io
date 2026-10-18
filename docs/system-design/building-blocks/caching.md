---
sidebar_position: 6
title: Not doing the work twice
sidebar_label: "Caching: Not doing the work twice"
hide_table_of_contents: true
---

# Not doing the work twice

<Updated date="2026-10-10" />

<Topics tags={['Cache types', 'CDN', 'Cache-aside', 'Write-through / write-back', 'Read-through', 'Eviction (LRU/LFU/TTL)', 'Cache stampede', 'Hot keys']} />

The fastest work is the work you never do. A **cache** stores the result of something expensive — a database query, a computation, a fetch from far away — so the next request for it gets the answer immediately instead of paying the full cost again. That's the whole idea, and it's one of the highest-leverage moves in system design.

The catch is that a cache is a second, faster *copy* of your data — and the moment you keep a copy, you take on a handful of problems the original never had. Four, really: where that copy lives, how it keeps up with the original as data changes, what gets thrown out when it runs out of room, and what happens when a crowd rushes the same entry at once.

## Where the cache lives

- **External cache** — the most common one: a dedicated cache that sits between the application and the database, taking load off the database and serving hot data with less latency.
- **In-process cache** — the cache lives in the memory of the application server itself. Faster still, because the data is local and there's no network call — but each server instance has its own copy, which makes them hard to keep consistent with each other.
- **Client-side cache** — the data is kept right where it's needed, so there's no network call at all. Fastest of the lot; the cost is that you have less control over the cached copy. Think of a browser caching UI assets, or a Redis client caching cluster metadata so it can decide which node to talk to.
- **CDN** — a cache placed close to the user, geographically. We met it in [the distance lesson](./distance-and-failure) as a way to cut latency; seen as a cache, it works like this: a request goes to the nearest CDN, which checks whether the content is cached. If it is, the CDN serves it without ever touching the origin. If it isn't, the CDN fetches it from the origin, stores a copy, and serves it — so the next user in that region gets it instantly.<Sidenote>CDNs can cache some dynamic content now, but their bread and butter is static media — images, video, scripts, stylesheets. Examples: Cloudflare, Akamai.</Sidenote>

## How reads and writes flow

A cache sitting next to a database raises an obvious question: when data is read *or* written, how do you keep the cache and the database in sync — both holding the same, up-to-date data? There are four standard patterns — two mostly about how reads work, two about how writes work — and in practice you pair one of each.

| Pattern | How it works | The trade |
| --- | --- | --- |
| **Cache-aside** (lazy loading) | The app checks the cache — a hit returns the value; a miss reads the database, stores the result in the cache, then returns it. | The most common pattern, with the app doing the work itself. A miss is *slower* than no cache at all — you pay the cache check and then the database read. |
| **Read-through** | The app only ever talks to the cache; on a miss the *cache itself* reads the database, stores the value, and returns it. | Like cache-aside's read, except the cache does the loading instead of the app. CDNs work this way. |
| **Write-through** | The app writes to the cache, which *synchronously* writes on to the database before returning. | Reads are always fresh, but writes are slow (you wait for both), and if the database write fails after the cache write, the two fall out of sync. Use it when you need fresh data every time. |
| **Write-behind** (write-back) | The app writes to the cache, which flushes to the database *asynchronously* a little later. | Writes are extremely fast — but if the cache dies before it flushes, that data is gone. Use it when write throughput matters more than the odd lost write. |

## What gets thrown out: eviction

A cache has limited room, so when it fills up it has to drop something. The policy is how it chooses:

- **LRU (least recently used)** — evict whatever hasn't been touched for the longest. Typically backed by a linked list.
- **LFU (least frequently used)** — evict whatever is asked for *least often*. A good fit for things like trending videos or a top-playlist.
- **FIFO (first in, first out)** — evict whatever was inserted earliest, like a queue. Generally a poor choice: it can throw out a key that's still hot simply because it arrived first.
- **TTL (time to live)** — not an eviction policy on its own, but related: it sets how long a key may live before it expires.

## What breaks under load

Caching introduces its own failure modes, and they tend to show up exactly when the cache is working hardest.

**Cache stampede (thundering herd).** A single hot key expires, and in that instant every request for it misses at once and slams the database together.<Sidenote>Same shape as the retry "thundering herd" in the distance lesson: many clients converging on one struggling resource at the same moment.</Sidenote> Two defences:

- **Request coalescing (single-flight)** — let just *one* request go fetch the value from the database and populate the cache; every other request for that key waits for it, then reads the fresh cache entry.
- **Cache warming** — predict which hot keys are about to expire and refresh them *before* they do. Only possible when keys carry a TTL you can see coming.

**Cache consistency.** The cached copy goes stale — it no longer matches the database. Three ways to manage it:

- **Invalidate on write** — when you update the data in the database, delete its cache entry so the next read repopulates it.
- **Accept eventual consistency** — for feeds, metrics, and analytics, a slightly stale value is perfectly fine.
- **Set a TTL** — expiring keys bounds how stale data can get; it shrinks the problem without removing it.

**Hot keys.** A few keys get the overwhelming majority of the traffic, and a single hot key can overload one cache node badly enough to take it down. Three defences:

- **Replicas** — keep the key on several cache nodes and balance reads across them.
- **Local cache** — hold the very hottest keys in an in-process cache, taking that load off the external cache entirely.
- **Rate limiting** — throttle abusive traffic aimed at specific keys.

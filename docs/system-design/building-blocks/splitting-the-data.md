---
sidebar_position: 8
title: Splitting the data
sidebar_label: "Sharding: Splitting the data"
hide_table_of_contents: true
---

# Splitting the data

<Topics tags={['Partitioning (horizontal / vertical)', 'Sharding', 'Shard keys', 'Range / hash / directory strategies', 'Hot shards', 'Cross-shard queries', 'Consistency (2PC / saga)']} />

[Spreading the load](./spreading-the-load) solved too much *traffic* by adding more servers. This lesson is the same move for too much *data*. A single database has a ceiling just like a single server does: enough rows, and one machine can't store them all — and every query has to wade through the whole pile to find the handful it wants. The fix is to split the data into smaller pieces: first *inside* one database (**partitioning**), then *across many* (**sharding**). The rest of the lesson is how you split, and what splitting breaks.

## Partitioning: dividing one database

**Partitioning** splits a table into smaller pieces *within a single database instance* — no new machines involved. The point is efficiency: a query can read just the piece it needs instead of scanning the whole table. Picture a table of millions of orders. Ask for *last month's* orders and, unpartitioned, the database scans every row and throws most of them away. Partition the table by month, and the same query reads only the one partition holding last month — a fraction of the work.

There are two ways to cut a table, along its two axes:

- **Horizontal partitioning** splits by *rows* — each partition holds a subset of the rows, with every column intact. Partitioning orders *by year* is the classic case: each year's rows in their own partition, so a query for one year touches one partition.
- **Vertical partitioning** splits by *columns* — each partition holds every row, but only some of the columns. The usual move is to put the frequently-read columns in one partition and the rarely-touched ones (a bulky `profile_bio`, say) in another, so everyday queries never load the heavy columns they don't need.

<figure className="diagram">
<svg viewBox="0 0 600 250" width="600" height="250" role="img" aria-label="Two ways to partition a table. On the left, a horizontal split cuts the table into groups of rows, keeping all columns. On the right, a vertical split separates a group of columns, keeping all rows.">
  <text className="d-text" x="150" y="44" fontSize="15" textAnchor="middle">Horizontal — by rows</text>
  <rect className="d-fill" x="70" y="66" width="160" height="56" rx="4" />
  <rect className="d-stroke" x="70" y="66" width="160" height="140" rx="4" strokeWidth="1.5" />
  <line className="d-stroke" x1="123" y1="66" x2="123" y2="206" strokeWidth="0.75" />
  <line className="d-stroke" x1="177" y1="66" x2="177" y2="206" strokeWidth="0.75" />
  <line className="d-stroke" x1="70" y1="94" x2="230" y2="94" strokeWidth="0.75" />
  <line className="d-stroke" x1="70" y1="150" x2="230" y2="150" strokeWidth="0.75" />
  <line className="d-stroke" x1="70" y1="178" x2="230" y2="178" strokeWidth="0.75" />
  <line className="d-accent" x1="70" y1="122" x2="230" y2="122" strokeWidth="2.5" />
  <text className="d-text" x="450" y="44" fontSize="15" textAnchor="middle">Vertical — by columns</text>
  <rect className="d-fill" x="370" y="66" width="53" height="140" rx="4" />
  <rect className="d-stroke" x="370" y="66" width="160" height="140" rx="4" strokeWidth="1.5" />
  <line className="d-stroke" x1="476" y1="66" x2="476" y2="206" strokeWidth="0.75" />
  <line className="d-stroke" x1="370" y1="94" x2="530" y2="94" strokeWidth="0.75" />
  <line className="d-stroke" x1="370" y1="122" x2="530" y2="122" strokeWidth="0.75" />
  <line className="d-stroke" x1="370" y1="150" x2="530" y2="150" strokeWidth="0.75" />
  <line className="d-stroke" x1="370" y1="178" x2="530" y2="178" strokeWidth="0.75" />
  <line className="d-accent" x1="423" y1="66" x2="423" y2="206" strokeWidth="2.5" />
</svg>
<figcaption>Two ways to cut a table. Horizontal keeps every column but splits the rows into groups; vertical keeps every row but splits off a set of columns.</figcaption>
</figure>

## Sharding: dividing across machines

Partitioning makes a *query* cheaper, but every partition still lives on the same machine — so it does nothing for a database that has simply outgrown one box's CPU, memory, or disk. **Sharding** is the step across that boundary. It's horizontal partitioning where each piece — each **shard** — lives on its own independent database, with its own CPU, memory, and storage. The rows are divided the same way as before, but now they sit on *different machines*, so the data *and* the load that hits it are spread across many boxes instead of one.

<figure className="diagram">
<svg viewBox="0 0 600 250" width="600" height="250" role="img" aria-label="On the left, partitioning: one database box divided into three sections inside. On the right, sharding: three separate, standalone database boxes side by side.">
  <text className="d-text" x="150" y="40" fontSize="15" textAnchor="middle">Partitioning</text>
  <rect className="d-fill" x="85" y="66" width="130" height="140" rx="8" />
  <rect className="d-stroke" x="85" y="66" width="130" height="140" rx="8" strokeWidth="1.5" />
  <line className="d-stroke" x1="85" y1="112" x2="215" y2="112" strokeWidth="0.75" />
  <line className="d-stroke" x1="85" y1="160" x2="215" y2="160" strokeWidth="0.75" />
  <text className="d-text" x="150" y="228" fontSize="12.5" textAnchor="middle">one machine, divided inside</text>
  <text className="d-text" x="455" y="40" fontSize="15" textAnchor="middle">Sharding</text>
  <rect className="d-fill" x="360" y="76" width="58" height="118" rx="8" />
  <rect className="d-stroke" x="360" y="76" width="58" height="118" rx="8" strokeWidth="1.5" />
  <rect className="d-fill" x="426" y="76" width="58" height="118" rx="8" />
  <rect className="d-stroke" x="426" y="76" width="58" height="118" rx="8" strokeWidth="1.5" />
  <rect className="d-fill" x="492" y="76" width="58" height="118" rx="8" />
  <rect className="d-stroke" x="492" y="76" width="58" height="118" rx="8" strokeWidth="1.5" />
  <text className="d-label" x="389" y="140" fontSize="13" textAnchor="middle">1</text>
  <text className="d-label" x="455" y="140" fontSize="13" textAnchor="middle">2</text>
  <text className="d-label" x="521" y="140" fontSize="13" textAnchor="middle">3</text>
  <text className="d-text" x="455" y="228" fontSize="12.5" textAnchor="middle">separate machines, each its own CPU & disk</text>
</svg>
<figcaption>Partitioning divides the data inside one database; sharding puts each piece on its own independent database. Those separate machines are what let sharding scale past a single box — and, as the rest of this lesson shows, what create its hardest problems.</figcaption>
</figure>

## How to shard

Sharding well comes down to two choices: the **shard key** (which field you split on) and the **strategy** (how those splits map to shards).

### The shard key

The **shard key** is the field used to sort each row into a group — `user_id`, say, or `country`. A good one has three properties:

- **High cardinality** — plenty of distinct values, so the data can divide finely. A key with only a few possible values (a boolean `is_active`) can make only a few groups, however many shards you have.
- **Even distribution** — the values are spread evenly across the rows, so every shard gets a roughly equal share rather than one bulging while others stay nearly empty.
- **Query alignment** — the key matches how you actually query, so most queries carry the shard key and can be answered by a *single* shard instead of interrogating all of them.

Choose badly and you get the mirror image: uneven distribution, **hot spots** where one shard is pounded while the rest sit idle, and queries that have to hit every shard to find what they need.

### The strategy

With a key chosen, the **strategy** decides which shard a given key actually lands on. Three are common:

| Strategy | How a key finds its shard | The trade-off |
| --- | --- | --- |
| **Range-based** | Contiguous ranges of the key — `user_id` 1–1M on shard 1, 1M–2M on shard 2, and so on. | Simple, and neighbouring keys stay together — but values can arrive lopsidedly, piling recent sign-ups or timestamps onto one shard. |
| **Hash-based** | A hash of the key picks the shard: `shard = hash(key) % number_of_shards`. | Spreads data very evenly — but changing the shard count reshuffles almost everything (below). |
| **Directory-based** | A lookup table records exactly which shard each key lives on. | Total flexibility — at the cost of a single point of failure and an extra hop on every query. |

#### Range-based

Because neighbouring key values sit on the same shard, a *range query* — say "all orders placed in March" — touches just one or two shards instead of fanning out to all of them. That locality is its real strength. Its weakness is uneven load, because ranges rarely hold equal amounts of data or traffic. The worst case is a shard key that only ever grows — an auto-increment ID, or a timestamp: every new row falls into the highest range, so **all new writes pile onto the single newest shard** while the earlier ones sit idle — and you lose the very write-spreading you sharded for.<Sidenote>Even when writes aren't the problem, naturally lumpy keys cause the same imbalance in storage: shard users alphabetically by surname and the common-letter shards bulge while the rare-letter ones stay nearly empty.</Sidenote>

#### Hash-based

This is the usual default. A hash function such as MD5 has a property that's perfect here: feed it two almost-identical inputs and you get two completely unrelated outputs.<Sidenote>This is called the *avalanche effect*: flipping a single bit of the input changes, on average, half the bits of the output. It's what turns a clumpy set of real-world keys into an evenly scattered set of shard assignments.</Sidenote> That turns even a lopsided set of keys — all your user IDs bunched in one numeric range — into shard assignments scattered evenly across the shards, which is exactly the even distribution you want.

Its weakness lives in the formula. `shard = hash(key) % N` depends on `N`, the number of shards. Add or remove a shard and `N` changes, so the result of that division changes for *almost every key at once* — nearly all of the data has to move to a different shard. On a live system that's a huge, disruptive reshuffle. That single problem is important enough to have its own fix, which is the whole subject of the next lesson, [consistent hashing](./consistent-hashing).

#### Directory-based

Its strength is flexibility. Instead of a formula, a directory service keeps an explicit table — user 15 → shard 1, user 87 → shard 4 — so any key can be sent to any shard, and you move a key just by editing its row. The price is paid on every request: each query must consult the directory first (an extra network hop, so latency on *everything*), and the directory becomes a **single point of failure** — if it goes down, nobody can locate their data and the whole system goes down with it.

:::tip In an interview
The shard key is the heart of a sharding answer. Expect to defend your choice on the three properties above, and to name which of your queries would go cross-shard as a result. "I'd shard by `X`, which keeps the common query `Y` on a single shard, at the cost of query `Z` having to fan out" is exactly the trade-off reasoning interviewers are listening for.
:::

## What sharding breaks

Spreading data across independent machines is what makes sharding scale — and also what creates its three signature problems. Each traces back to the same root: there is no longer a single machine that sees all the data.

### Hot shards

A **hot shard** takes wildly more traffic than the others — but, crucially, not because you picked a bad key or strategy. Some keys are simply, intrinsically popular. A celebrity's Instagram account is read millions of times an hour while a typical account is read a handful; whichever shard holds that account runs hot no matter how evenly everything was distributed. It's a property of the *key*, not of the sharding.

Three ways to cope:

- **Isolate the hot keys** — give the few troublemakers their own dedicated shard (directory-based routing for those, hash or range for everyone else).
- **Use a compound shard key** — shard on two fields instead of one, for example `hash(user_id + date)`. A single user's rows now scatter across many shards by date instead of all landing on one.<Sidenote>There's a cost to this, worth saying out loud: once a user's rows are spread across shards, a query for *all* of that user's data has to visit several shards. You've traded a hot shard for a cross-shard read — often a good trade, but a trade.</Sidenote>
- **Split shards dynamically** — some databases automatically split a shard when it grows too large or too hot. MongoDB's balancer, for instance, splits a range of data into smaller chunks and migrates them to other shards to even things out (it does this even when you shard by a hashed key).

### Cross-shard queries

Once the data is scattered, some queries simply can't be answered by one shard — anything that filters on something *other* than the shard key may have matching rows on every shard. No shard key eliminates these; the goal is only to **minimise** them. Two levers:

- **Cache** the results of the expensive cross-shard queries you run often, so you pay the full fan-out only now and then. (The [caching lesson](./caching) in full.)
- **Denormalise** so the rows a query needs already sit together on one shard. This is the deliberate duplication from [Where data lives](./where-data-lives): you copy data onto the shard that needs it, trading extra storage and harder writes for queries that stay local.

:::note How indexing fits in
Indexing (from [Finding the needle](./finding-the-needle)) and partitioning attack the same problem — reading less data — but at different levels. Partitioning works *coarsely*, pruning whole partitions a query doesn't need; an index works *finely*, jumping to the matching rows **within** a partition. They stack: prune to the right partition first, then let that partition's index find the rows.

The twist under sharding is that **each shard is its own database, so its indexes are local to it** — there's no single index spanning all shards. A query on the shard key lands on one shard and uses its index; a query on any *other* column has to consult every shard's local index and merge the results — which is exactly the cross-shard scatter-gather above. In that sense the shard key is to a shard what a composite index's leading column is to the index: the field you have to filter on to unlock the pruning.
:::

### Keeping data consistent

A database transaction guarantees **atomicity** — every statement in it succeeds, or none does (the *A* in [ACID](./where-data-lives)). That's easy to promise inside one database and breaks the moment a transaction's statements land on different shards, because no single machine can commit or roll back all of them together.

How much that matters depends on the operation:

- Transferring money between two users on different shards **must** stay consistent — the debit on one shard and the credit on the other have to both happen, or both not.
- A like on a post can be **eventually consistent** — if the count is briefly off, no harm done.

The options, from the one to reach for first to the one for when you truly can't avoid it:

- **Design the cross-shard transaction away.** The best fix is not to need one — arrange the data so the things that must change together already live on the same shard.
- **Accept eventual consistency** wherever the use case tolerates it (likes, view counts, feeds).
- **Two-phase commit (2PC)** — a coordinator asks every shard to *prepare*, then, once all agree, tells them all to *commit*. Correct, but slow and fragile: the shards block while the coordination plays out, and a coordinator that dies mid-way can leave them stuck.
- **The saga pattern** — break the operation into a sequence of independent steps, each paired with a **compensating action** that undoes it. Run the steps in order; if one fails partway, run the compensating actions for the steps already done, unwinding the work. You get eventual consistency without 2PC's fragility. The money transfer as a saga:
    1. Deduct the amount from User A (shard 1).
    2. Add it to User B (shard 2).
    3. If step 2 fails, run A's compensating action — refund the deduction.

---

One reassurance to close on: you rarely build any of this by hand. **Every modern database ships with sharding built in, or has a mature third-party layer for it** — the machinery of routing keys to shards, moving data, and rebalancing is automated. What stays your job is the thinking on this page: choosing the shard key, and living with the trade-offs it commits you to. And the single sharpest of those trade-offs — hash-based sharding's all-at-once reshuffle when the shard count changes — is exactly what the next lesson sets out to fix.

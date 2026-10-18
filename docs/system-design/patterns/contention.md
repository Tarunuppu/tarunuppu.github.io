---
sidebar_position: 2
title: When writes collide
sidebar_label: "Contention: When writes collide"
hide_table_of_contents: true
---

# When writes collide

<Updated date="2026-10-18" />

<Topics tags={['Race conditions', 'Pessimistic locking', 'Isolation levels', 'Optimistic concurrency (OCC)', '2PC', 'Distributed locks', 'Saga']} />

Two people click "buy" on the last concert seat at the same instant. Both see "1 left," both pay, both get a confirmation — and the system just sold one seat twice. That's **contention**: multiple operations racing for the same data at the same moment, and left unhandled it produces double-bookings, lost updates, and corrupt state. This lesson is the toolkit for getting it right: first inside **one database**, then **across machines** — where contention is joined by a second, easily-confused problem, and half the skill is keeping the two straight.

## The problem: a race condition

Reserving a seat is a **transaction** — a group of steps the database runs as one unit:

```
1.  check seats_left > 0
2.  seats_left = seats_left − 1
3.  insert a row into tickets
4.  charge the user
```

A transaction guarantees **atomicity**: all four steps happen, or none do. You'd think that settles it. It doesn't. Picture two bookings reaching this block at the same moment: both run step 1 and *both read `seats_left = 1`* before either has run step 2.<Sidenote>Why do they both see `1`? Because of the database's default isolation level (**read committed**, in PostgreSQL): a transaction sees the latest *committed* value, and neither booking has committed its decrement yet — so both read the still-committed `1`.</Sidenote> From there both sail through: both decrement to 0, both insert a ticket, both charge a card. Two seats sold, one seat exists.

<figure className="diagram">
<svg viewBox="0 0 620 210" width="620" height="210" role="img" aria-label="A race condition on a timeline. User A reads seats_left = 1; then User B also reads 1 before A has written; then A decrements, charges, and commits; then B decrements, charges, and commits off its stale read. Both bookings succeed, overselling the one seat.">
  <text className="d-text" x="30" y="63" fontSize="12" textAnchor="start">User A</text>
  <text className="d-text" x="30" y="145" fontSize="12" textAnchor="start">User B</text>
  <text className="d-text" x="300" y="24" fontSize="11" textAnchor="middle">both read 1 before either writes</text>
  <rect className="d-fill" x="90" y="44" width="96" height="36" rx="5" />
  <rect className="d-accent-stroke" x="90" y="44" width="96" height="36" rx="5" strokeWidth="2" />
  <text className="d-text" x="138" y="66" fontSize="12" textAnchor="middle">read → 1</text>
  <rect className="d-fill" x="196" y="126" width="96" height="36" rx="5" />
  <rect className="d-accent-stroke" x="196" y="126" width="96" height="36" rx="5" strokeWidth="2" />
  <text className="d-text" x="244" y="148" fontSize="12" textAnchor="middle">read → 1</text>
  <rect className="d-fill" x="300" y="44" width="150" height="36" rx="5" />
  <rect className="d-stroke" x="300" y="44" width="150" height="36" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="375" y="66" fontSize="11.5" textAnchor="middle">−1, charge, commit</text>
  <rect className="d-fill" x="460" y="126" width="150" height="36" rx="5" />
  <rect className="d-stroke" x="460" y="126" width="150" height="36" rx="5" strokeWidth="1.5" />
  <text className="d-text" x="535" y="148" fontSize="11.5" textAnchor="middle">−1, charge, commit</text>
  <line className="d-stroke" x1="40" y1="188" x2="600" y2="188" strokeWidth="0.75" strokeDasharray="2 3" />
  <text className="d-text" x="600" y="182" fontSize="10" textAnchor="end">time →</text>
</svg>
<figcaption>Both bookings read "1 left" before either writes, so both believe a seat is free — both charge, and the single seat is sold twice. Note the trap: <strong>atomicity didn't help</strong>. Each transaction did all-or-nothing perfectly; what's missing is <em>isolation</em> between them.</figcaption>
</figure>

This is a **race condition** — two operations racing on the same data, where the outcome depends on their exact timing. In SQL, both bookings run the same block, and nothing in it stops the interleaving the diagram shows:

```sql
BEGIN;
SELECT seats_left FROM events WHERE id = 42;          -- both read 1
-- app checks: seats_left > 0 ?  →  true for both
UPDATE events SET seats_left = seats_left - 1 WHERE id = 42;
INSERT INTO tickets (event_id, user_id) VALUES (42, 101);
COMMIT;
```

The plain `SELECT` takes no lock, so both transactions read `1` and both pass the check; the two `UPDATE`s then run one after the other and drive `seats_left` to `−1`, with two tickets inserted. Fixing it means coordinating the two, which is what every tool below does.

## Solving it in one database

A single database hands you two guarantees almost for free. **Isolation**: it can keep two transactions from colliding on the same row. **Atomicity**: it runs a transaction all-or-nothing. The race above is a failure of the *first* — hold onto that word, because the second will come back to bite us the moment we leave one database behind. For now, if every piece of contended data lives in one database, you have three tools for isolation, and they divide along one question: do you *expect* conflicts, or not?

### Pessimistic locking — assume the worst

**Pessimistic** means assuming contention *will* happen and heading it off up front.<Sidenote>The mindset: expect a collision, so prepare for it before touching anything.</Sidenote> Before reading the row, you **lock** it — `SELECT … FOR UPDATE` — which bars anyone else from touching that row until you commit.<Sidenote>"Locking" a row means exactly that: no other transaction may update it (or lock it itself) until the holder releases the lock, normally at commit.</Sidenote> The second booking now **blocks** at step 1 until the first finishes; by the time it reads, `seats_left` is already 0, and it's correctly turned away. In SQL it's one added keyword on the read:

```sql
BEGIN;
SELECT seats_left FROM events WHERE id = 42 FOR UPDATE;   -- 2nd booking waits here
-- app checks: seats_left > 0 ?  →  proceed only if true
UPDATE events SET seats_left = seats_left - 1 WHERE id = 42;
INSERT INTO tickets (event_id, user_id) VALUES (42, 101);
COMMIT;
```

<details>
<summary>(Optional) Why does the second booking block here, when a locked row can still be read?</summary>

Fair question — a locked row *can* still be read, but only by a **plain** `SELECT`. The catch is that `SELECT … FOR UPDATE` is **not** a plain read: the `FOR UPDATE` means "read this row **and** take its exclusive lock, because I mean to change it." It's a *locking read*.

So picture the first booking already holding that lock:

- A **plain** `SELECT seats_left …` (a dashboard, say) would **not** block — it just peeks at the last committed value.
- `SELECT … FOR UPDATE` **does** block, because it's asking for the very lock the first booking holds.

Think *peeking* versus *reserving*: anyone can peek at a row while it's held, but two transactions can't reserve it at once — the second waits. Both bookings reserve (both use `FOR UPDATE`), and that mutual agreement is exactly what serialises them. If the second booking used a plain `SELECT` instead, it wouldn't wait — it would read the stale `1` and land you right back in the original race.

</details>

The cost is concurrency — a lock is a queue. So the rule is **lock as few rows as possible, for as short a time as possible**: lock whole tables and you serialise everything; hold locks for seconds instead of milliseconds and you build a bottleneck.

### Isolation levels — turn up the strictness

The database already has a dial for this kind of interference: the **isolation level**, the ladder from [Where data lives](../building-blocks/where-data-lives) (read uncommitted → read committed → repeatable read → serializable). The seat race is an artifact of the default rung; turn the dial to **serializable** — where transactions are guaranteed to behave as if run one after another — and the anomaly is gone. It works, but it's a blunter, pricier instrument than a targeted lock and gives you less control over *what* gets serialised. Usually a pessimistic lock on the one hot row is the better trade.

### Optimistic concurrency — assume the best

**Optimistic concurrency control (OCC)** takes the opposite bet: assume conflicts are *rare*, so don't lock anything — just check at the very end whether someone slipped in. Each row carries a **version number**, and a write is a three-step dance:

1. **Read** the row and its version (say `v5`).
2. **Validate**, right before writing: is the version still `v5`?
3. **Write or abort**: if it's still `v5`, write and bump it to `v6`; if it changed, someone beat you to it — abort and retry.

In SQL, steps 2 and 3 collapse into a single conditional `UPDATE` — the `AND version = 5` *is* the validation, and the number of rows changed tells you whether you won:

```sql
SELECT seats_left, version FROM events WHERE id = 42;   -- read: seats_left 1, version 5

-- …decide to take a seat, then:
UPDATE events
SET    seats_left = seats_left - 1, version = version + 1
WHERE  id = 42 AND version = 5;
-- 1 row changed → success (version is now 6)
-- 0 rows changed → someone changed it first → abort and retry
```

Because nothing is locked, OCC is **highly scalable and can't deadlock**, and it's very fast *when conflicts are rare*. The flip side is in its name: under **high** contention on one row, validations keep failing and you spend all your time in abort-and-retry loops, burning CPU for nothing. So OCC fits read-heavy data with occasional writes — product pages, user profiles — not a single hot seat everyone wants at once.

## Solving it across machines

In the one-database case the lock worked because one engine owned the row: `FOR UPDATE` is a lock that engine hands out and enforces. The moment the contended resource isn't behind a single database — users racing for the same seat across a whole fleet of app servers, or a resource with no one authoritative row to lock — that lock has nothing to grab onto. You need a lock every server can see.

### Distributed locks

A **distributed lock** is a single lock visible to every server, so only one process *anywhere* can hold a resource at a time — pessimistic locking stretched across machines. It has a useful side benefit: it can back a user-facing **reservation** — the "seat held for 10 minutes" or "item in your cart" state that stops users from even entering a fight over the same resource. Three common ways to build one:

| Strategy | How it works | The trade-off |
| --- | --- | --- |
| **Redis + TTL** | `SET NX` atomically creates a lock that auto-expires via a time-to-live | Fast, simple, no cleanup job — but a single point of failure if Redis is down |
| **Database column** | a `status` + `expiry` column, leaning on SQL's ACID guarantees | Reuses what you already run, strongly consistent — but slower, and needs a cleanup job |
| **ZooKeeper / etcd** | purpose-built coordination: consensus + ephemeral nodes that vanish if a client dies | Very robust across partitions — but a whole extra cluster to operate |

They come with a sharp edge, though — **the expiring-lock trap.** A TTL lock can expire *while you're still working* (a slow network call, a GC pause). A second process then grabs the lock, and now two processes edit the same resource — the exact thing you were preventing. The fix is a **fencing token**: an always-increasing number handed out with each lock; the storage layer remembers the highest it has seen and rejects any write carrying an older one, so the stale holder's writes bounce off.

## The twin problem: atomicity

Everything up to here has been about **isolation** — stopping two operations from colliding on the same data. Spreading data across databases breaks a second, different guarantee — **atomicity** — and because it surfaces in the same place, it's constantly mistaken for isolation.

Picture a checkout split across services that each own their own database: the **Orders** service records the order in its database, and the **Inventory** service decrements stock in its own. If the server crashes *between* those two writes, you've recorded an order whose stock was never taken — or taken stock for an order that was never recorded. Look closely — **nothing collided.** No second operation was involved; one operation ran and a crash tore it in half. That's not contention, it's a loss of **atomicity** (the *A* in [ACID](../building-blocks/where-data-lives)), which a single database guarantees but no ordinary transaction can stretch across two separate databases. Two tools restore it across systems — and both carry a catch that ties them straight back to the first half of this lesson.

### Two-phase commit (2PC)

A **coordinator** (often the app server) drives all the databases through two phases:

1. **Prepare** — the coordinator asks each database, in effect, *"I'm about to run this transaction — can you promise to do your part, whatever happens?"*<Sidenote>That promise is binding: a database that answers "ready" must be able to commit even if it crashes and restarts, so it durably records its intent before replying.</Sidenote> Each one either locks what it needs and answers "ready," or answers "no."
2. **Commit** — if *all* said ready, the coordinator tells everyone to commit. If *any* said no, it tells everyone to roll back.

Everyone (coordinator included) keeps a log, so a crash can be recovered from. 2PC does guarantee atomicity across systems — but it's slow, and it has a notorious **blocking problem**: if the coordinator crashes *between* prepare and commit, every database that answered "ready" is stuck holding its locks, waiting for a verdict that never comes, and every other transaction touching those rows is blocked until the coordinator returns. In [CAP](../building-blocks/cap-theorem) terms, 2PC picks **consistency over availability** — a partition makes it block, not corrupt.

Now the catch, and it's the whole reason a page about collisions is talking about 2PC at all: **2PC buys you atomicity, not isolation.** It guarantees the databases commit *together* — but says nothing about whether two *concurrent* orders race on the same item. That's still down to locking at each participant: the race condition from the top of this lesson, alive and well, now nested inside the atomicity machinery. Both snippets below show one participant (the Inventory database) doing its part of an order inside a 2PC transaction; both are 2PC, but only the second is race-free:

```sql
-- 2PC WITHOUT a lock — two concurrent orders still race
XA START 'tx';
SELECT stock FROM inventory WHERE sku = 'X';             -- both orders read 1
-- app checks: stock >= 1 ?  →  true for both
UPDATE inventory SET stock = stock - 1 WHERE sku = 'X';
XA END 'tx';  XA PREPARE 'tx';    -- phase 1; coordinator then commits every participant
```

```sql
-- 2PC WITH a lock — the race is prevented
XA START 'tx';
SELECT stock FROM inventory WHERE sku = 'X' FOR UPDATE;  -- 2nd order blocks here
-- app checks: stock >= 1 ?
UPDATE inventory SET stock = stock - 1 WHERE sku = 'X';
XA END 'tx';  XA PREPARE 'tx';    -- phase 1; coordinator then commits every participant
```

Same protocol, same atomic commit across both databases — the only difference is `FOR UPDATE`.<Sidenote>`XA START` / `XA PREPARE` / `XA COMMIT` are the SQL commands a database exposes so a coordinator can drive it through 2PC: `PREPARE` is phase 1 ("are you ready?"), and the coordinator issues `COMMIT` to every participant once all have said yes.</Sidenote> Without the lock, two concurrent orders both read `1`, both pass the check, and both decrement — overselling the last unit to `−1`. With it, the second order waits, reads the already-reduced stock, and is correctly turned away. 2PC delivered the **atomicity**; a lock from the first half of this lesson delivered the **isolation**. Different problems, different tools, and a cross-database operation usually needs both at once.

### Saga

The **saga** from [Splitting the data](../building-blocks/splitting-the-data) is the second way to get cross-system atomicity, and the one that sidesteps 2PC's blocking. Break the distributed operation into a sequence of **independent steps, each a complete local transaction committed immediately**, and give each a **compensating action** that undoes it. The checkout: record the order (commit), decrement stock (commit); if the decrement fails because the item is sold out, run the order's compensation — void it. If a later step fails, you unwind by running the earlier steps' compensations.

Because each step commits on its own, **no locks are held open across network calls** the way 2PC holds them — that's the entire point. You do need a durable **orchestrator** to remember how far the saga got, so after a crash it can resume or compensate. The trade-off: between steps the system is briefly inconsistent (the order exists before its stock has been decremented) — **eventual consistency** — and accepting that short window is exactly how a saga dodges 2PC's blocking.

A saga is still an *atomicity* tool, and the same catch applies: it keeps the overall operation all-or-nothing, but inside each local step you're back to the first half of this lesson for isolation — a lock or a version check to stop two sagas racing on the same item. Sagas are also a full pattern in their own right — orchestration, durable state, and crash recovery — which the next lesson takes up properly.

## Choosing the approach

Start with the question that saves the most pain — *can all the contended data live in one database?* Nine times out of ten it can, and distributed coordination disappears. If it genuinely can't, the next question isn't which tool — it's **which guarantee broke**, because isolation tools and atomicity tools don't substitute for each other:

| Guarantee at stake | Situation | Reach for |
| --- | --- | --- |
| **Isolation** | One database, **high** contention | **Pessimistic locking** (`FOR UPDATE`) — predictable, handles the worst case |
| **Isolation** | One database, **low** contention | **Optimistic concurrency** (version columns) — faster when conflicts are rare, no blocking |
| **Isolation** | Across servers, or reservation UX (ticketing, carts) | **Distributed locks** — one lock every server sees; back a reservation to keep users out of the fight |
| **Atomicity** | One operation spans several databases | **2PC** for strong consistency (but it blocks on failure), or a **saga** for resilience (but eventual consistency) |

## A few sharp edges

Three classic follow-up questions:

- **Deadlocks (any locking approach).** Two transactions each hold a lock the other needs, and both wait forever — a hazard of pessimistic row locks and distributed locks alike. Prevent it by always acquiring locks in a **consistent global order** — sort the resources by a deterministic key (like primary key) before locking — so two transactions can never grab them in opposite orders. Keep database timeouts and deadlock detection as a backstop.
- **Coordinator crash (2PC).** The blocking problem above: databases left holding locks indefinitely. Production systems use coordinator **failover with persistent logs** to recover in-flight transactions — or switch to sagas to avoid holding cross-network locks at all.
- **The ABA problem (OCC).** This is the reason OCC validates on a version number and not on the value itself. Suppose you cut that corner and checked the business value instead — *"I read `seats_left = 5`; is it still `5`?"* Between your read and your write the count could slide 5 → 4 → 5: one person books the second-to-last seat, another cancels theirs. Your check sees `5`, concludes nothing changed, and overwrites a row that in fact moved twice — the value went from **A** to **B** and back to **A**, hence the name. A dedicated **version column that increments on every update** closes the gap: it climbs 5 → 6 → 7, so even when the seat count lands back on `5`, the version never repeats — and the stale write is correctly rejected.

---

The thread through all of it: a single database quietly gives you both **isolation** and **atomicity**, and distributing the data takes them away *separately*. The first mistake is treating them as one problem. Isolation is about collisions — locks and version checks, whether on a single row or across a fleet. Atomicity is about all-or-nothing across systems — 2PC's blocking or a saga's eventual consistency, each still needing an isolation tool nested inside it. Different problems, different tools, and the only free lunch is keeping the data together so you need neither.

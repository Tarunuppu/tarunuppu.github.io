---
sidebar_position: 5
title: Where data lives
sidebar_label: "Databases: Where data lives"
hide_table_of_contents: true
---

# Where data lives

<Topics tags={['ACID', 'Normalization', 'Relational / SQL', 'Document DBs', 'Key-value stores', 'Wide-column DBs', 'Graph DBs']} />

Once a request reaches a server, it almost always needs to read or write data — and "the database" is not one thing. Before picking one you answer three questions in order: what guarantees do you need when data changes (ACID), how should the data be shaped (normalized or not), and which family of store fits the way you'll actually read and write it. The last question is really a choice of trade-offs, which is why there are so many kinds.

## The guarantees: ACID

**ACID** is the set of promises a transaction makes — a transaction being a group of statements that should be treated as one unit of work.

- **Atomicity** — the whole transaction either succeeds completely or fails completely. If any statement in it fails, the entire transaction fails and the database is left unchanged, as if nothing happened.
- **Consistency** — a transaction can only move the database from one valid state to another, never leaving it in a state that breaks its rules or validations.
- **Isolation** — concurrent transactions shouldn't corrupt each other. Full isolation is expensive, though, so databases offer a ladder of **isolation levels** — each step up rules out one more way transactions can interfere, in exchange for some concurrency. From weakest to strongest:
    - **Read uncommitted** — a transaction can read another's uncommitted writes, which allows a **dirty read**: you act on a value that may later be rolled back and never truly existed.
    - **Read committed** — you only see committed data, so no dirty reads — but a **non-repeatable read** remains: read the same row twice and it can differ, because another transaction committed a change in between.
    - **Repeatable read** — a row you've already read won't change if you read it again,<Sidenote>How does the database hold that row steady? Two different tactics, depending on the engine. With **locking**, your transaction keeps a lock on every row it reads until it commits, so no one else is allowed to change those rows while you're still working. With **MVCC** (multi-version concurrency control — PostgreSQL, MySQL's InnoDB, Oracle), nothing is locked: your transaction reads from a snapshot of the data frozen at the moment it began, so other transactions can update the row freely and you simply keep seeing the older version. Same guarantee, opposite approach — one stops others from writing, the other just hides their writes from you. MVCC is the common default today. One wrinkle: because a snapshot also hides *newly inserted* rows, MVCC engines like these often prevent the phantom described below as well — which is why the textbook ladder and real databases don't line up exactly.</Sidenote> yet **phantom reads** still slip through. The guarantee protects rows that *already exist* — not the *set* of rows a condition matches. Run `SELECT … WHERE age > 30`, and while you work, another transaction can insert a new row that also matches and commit it, so re-running the exact same query returns an extra row that was never there before — a phantom.
    - **Serializable** — the strictest level: the outcome is guaranteed to match *some* order of running the transactions one at a time. No anomalies — and the most contention, so the slowest.
- **Durability** — once a transaction is committed, it stays committed, even through a crash or power loss, because the result is written to non-volatile storage.

## Shape: normalization vs denormalization

**Normalization** means keeping each piece of information in exactly one place. **Denormalization** means deliberately copying it to more than one place.

The trade is between clean writes and cheap reads. A user's display name, stored once (normalized), is trivial to change — one update. Copy that name onto every one of the user's posts (denormalized) and reads get faster (a post already carries the name, no lookup needed), but a single change now means rewriting every post record that copied it. Normalize for correctness and simple writes; denormalize to make a hot read path faster, knowing you're taking on duplicated, harder-to-change data.

## The families of store

Each family is tuned for a different access pattern. The question is never "which is best" but "which matches how this data is read and written."

| Family | Stores data as | Reach for it when | Example |
| --- | --- | --- | --- |
| **Relational (SQL)** | Tables and rows, with relationships | You have structured, related data that needs ACID guarantees and complex joins | PostgreSQL, MySQL |
| **Document** | JSON documents, flexible schema | The schema changes often, the data is deeply nested, or it's too irregular to fit a fixed schema | MongoDB |
| **Key-value** | A value looked up by a key | You need pure fast lookups with no queries or joins — often as a cache for hot or pre-computed values sitting in front of a durable store; it's fast but weak on consistency | Redis, DynamoDB |
| **Wide-column** | Columns, optimised for appends | Writes dominate: time-series data, event logs, IoT streams, append-and-aggregate analytics | Cassandra |
| **Graph** | Nodes and edges | Rarely — it's built for traversing relationships, but even large social networks model those in SQL instead | Neo4j, Neptune |

:::tip In an interview
SQL handles complex joins well, but reaching for heavy, reporting-style queries tends to raise performance flags. Be ready to say whether the query is actually fast enough, or whether you'd serve it from a denormalized view, a cache, or pre-computed results instead.
:::

:::note The espresso-shot version
In case it isn't obvious: databases are an entire universe. Storage engines, indexing, query planning, concurrency control, replication, distributed consensus — every one of those is a field with its own thick textbooks (and its own tenured professors). Everything on this page is the two-minute summary. Pull on any single line here and a whole book falls out.
:::

---
sidebar_position: 10
title: When the network splits
sidebar_label: "CAP theorem: When the network splits"
hide_table_of_contents: true
---

# When the network splits

<Updated date="2026-10-14" />

<Topics tags={['CAP theorem', 'Consistency', 'Availability', 'Partition tolerance', 'CP vs AP', 'Consistency models', 'Per-feature trade-offs']} />

Every distributed system in this arc — the sharded database, the replicated cache, the hash ring — is many machines pretending to be one. The **CAP theorem** is the law that says how far that pretence can go. It's short, famous, and the thing interviewers reach for to check whether you really understand the deepest trade-off in distributed systems. This lesson is what it actually says, and how to use it.

## The three properties

CAP is about three properties a distributed system might have, and its claim is that you can hold at most **two of the three** at the same time:

- **Consistency (C)** — every node sees the same data at the same moment. The instant a write lands on one node, every later read, from *any* node, returns that new value. No reader ever sees stale data.<Sidenote>This is "consistency" in the strict sense — the strongest form. As the end of this lesson shows, the word actually covers a whole spectrum of weaker guarantees; CAP's C means the strongest one.</Sidenote>
- **Availability (A)** — every request to a working node gets a response — just not necessarily the newest data. The system always answers; it never hangs or errors out because it's unsure.
- **Partition tolerance (P)** — the system keeps working even when the network between nodes fails: messages are dropped, or a group of nodes is cut off from the rest. (A **network partition** is exactly that — a split where the nodes can't all reach each other.) Note the word *tolerance*: it means **coping** with a partition when one strikes, not choosing whether one happens. Partitions arrive whether you want them or not — the only question is whether your system is built to survive them.

## Why it's really a choice between two

Here's the catch that turns "pick two of three" into a real decision: in a distributed system, **partition tolerance isn't optional**. Networks fail — cables get cut, packets get lost, a data centre loses its link — and when that happens your system still has to do *something*. Giving up partition tolerance would only be safe if the network never split in the first place — and no one can promise that, because failures are inevitable. So P is a given, and the genuine choice is between the other two: when a partition strikes, do you favour **consistency** or **availability**?<Sidenote>This is the sharper, modern reading of CAP. The "two of three" slogan makes it sound like you permanently give up one property. In reality the trade-off only bites *during a partition* — while the network is healthy, a well-built system delivers both C and A. CAP is about what you sacrifice in the moment the network splits.</Sidenote>

The dilemma is concrete. Suppose two nodes can no longer reach each other, a write (`x = 2`) has landed on one of them, and a read arrives at the other:

<figure className="diagram">
<svg viewBox="0 0 560 230" width="560" height="230" role="img" aria-label="Two database nodes, A and B, with the network link between them broken by a partition. Node A has received a new write x equals 2; Node B still holds the stale x equals 1. A write arrow points into A and a read arrow points into B.">
  <defs>
    <marker id="ch-arrow-cap" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <rect className="d-fill" x="60" y="80" width="130" height="80" rx="8" />
  <rect className="d-stroke" x="60" y="80" width="130" height="80" rx="8" strokeWidth="1.5" />
  <text className="d-text" x="125" y="108" fontSize="14" textAnchor="middle">Node A</text>
  <text className="d-label" x="125" y="132" fontSize="14" textAnchor="middle">x = 2</text>
  <text className="d-text" x="125" y="150" fontSize="10.5" textAnchor="middle">new write</text>
  <rect className="d-fill" x="370" y="80" width="130" height="80" rx="8" />
  <rect className="d-stroke" x="370" y="80" width="130" height="80" rx="8" strokeWidth="1.5" />
  <text className="d-text" x="435" y="108" fontSize="14" textAnchor="middle">Node B</text>
  <text className="d-label" x="435" y="132" fontSize="14" textAnchor="middle">x = 1</text>
  <text className="d-text" x="435" y="150" fontSize="10.5" textAnchor="middle">stale</text>
  <line className="d-stroke" x1="190" y1="120" x2="248" y2="120" strokeWidth="1.5" />
  <line className="d-stroke" x1="312" y1="120" x2="370" y2="120" strokeWidth="1.5" />
  <line className="d-accent-stroke" x1="273" y1="110" x2="287" y2="130" strokeWidth="2.5" />
  <line className="d-accent-stroke" x1="287" y1="110" x2="273" y2="130" strokeWidth="2.5" />
  <text className="d-text" x="280" y="100" fontSize="12" textAnchor="middle">partition</text>
  <line className="d-accent-stroke" x1="125" y1="44" x2="125" y2="76" strokeWidth="1.5" markerEnd="url(#ch-arrow-cap)" />
  <text className="d-text" x="125" y="36" fontSize="12" textAnchor="middle">writes x = 2</text>
  <line className="d-accent-stroke" x1="435" y1="44" x2="435" y2="76" strokeWidth="1.5" markerEnd="url(#ch-arrow-cap)" />
  <text className="d-text" x="435" y="36" fontSize="12" textAnchor="middle">reads x = ?</text>
</svg>
<figcaption>During a partition, Node A has the new value (<code>x = 2</code>) but can't reach Node B, which still holds <code>x = 1</code>. The read hitting B forces the choice: answer with stale data — stay <strong>available</strong>, lose consistency — or refuse to answer — stay <strong>consistent</strong>, lose availability.</figcaption>
</figure>

There's no third option while the partition lasts. You either sacrifice consistency to keep answering, or sacrifice availability to avoid answering wrongly. Systems that make the first choice are often called **AP** (available during a partition); those that make the second, **CP** (consistent during a partition).

:::note Refusing a request isn't the same as failing
If a CP system refuses to answer during a partition, it's tempting to think it hasn't really *tolerated* the partition either — the user got nothing. But availability and partition tolerance are different properties. Sacrificing **availability** means some requests get a safe error or timeout. Losing **partition tolerance** means something far worse: the system corrupts data, lets both sides accept conflicting writes and permanently diverge (**split-brain**), or falls over — damage that often outlives the partition.

A CP system returning "try again in a moment" is *coping*: it's alive, it's protecting your data, and it recovers cleanly the instant the network heals — so that deliberate refusal is a correct response, not a breakdown. (And it's usually only the cut-off minority side that refuses; the majority side keeps serving normally.) Think of the ATM: the one that says "can't withdraw right now" is the well-behaved, partition-tolerant one; the one that hands out the last $100 twice is the one that *failed* to tolerate the partition.
:::

## Which one to favour

Which side you take depends entirely on what the data is *for*.

- **Favour consistency** when stale or conflicting data would be genuinely harmful — a **financial application** (a balance must be exact; two ATMs must never both hand out the last $100) or a **ticket-booking app** (two people must never buy the same seat).
- **Favour availability** when being always-on matters more than being perfectly current — **social media** (a briefly wrong like-count harms no one, but the app must never feel down) or a **review site** (a slightly stale average rating is fine).

The whole decision collapses to a single question:

> **Would it be catastrophic if users briefly saw inconsistent data?** If yes, choose consistency. If no, choose availability.

## It isn't one global choice

One refinement separates a good answer from a great one: as a system grows, this stops being a single, system-wide verdict. Different features have different needs, so you decide **per feature**. The very same product might demand strong consistency for payments while settling for availability on its activity feed — both choices, side by side, in one app.

:::tip In an interview
Two moves mark a strong CAP answer. First, don't give one global verdict — say which features need consistency and which can take availability (payments → CP, feed → AP). Second, drive every choice from that one question: *would briefly inconsistent data be catastrophic here?* Naming a concrete CP example (bank balance, seat booking) and an AP one (like counts, reviews) shows you've actually reasoned with it, not just memorised the letters.
:::

## The flavours of consistency

And "consistency" itself isn't one thing — it's a spectrum, from ironclad-and-expensive to loose-and-cheap. The levels you'll hear named:

- **Strong consistency** — the strict version from the top of this lesson: once a write completes, every read everywhere sees it. Easiest to reason about, costliest to provide.
- **Eventual consistency** — if writes stop, all replicas *eventually* converge to the same value, but a read in the meantime may be stale, and updates can even surface *out of order* — a reply could briefly appear before the comment it answers. This is the default for AP systems, and the model behind the "accept eventual consistency" option back in [sharding](./splitting-the-data).
- **Read-your-own-writes consistency** — a weaker but very practical guarantee: *you* always see *your own* writes immediately, even if other users might not yet. Post a comment and it's instantly there for you, even as it takes a moment to reach everyone else.
- **Causal consistency** — a notch stronger: operations that are cause-and-effect related are seen in the same order everywhere, so — unlike plain eventual consistency — a reply never appears before the comment it answers. Only genuinely unrelated (concurrent) operations may still be seen in different orders.

---

CAP is the backbone under this whole cluster of lessons. The moment you keep more than one copy of data — a cache entry, a replica, a shard — you create the chance that two copies disagree, and CAP is the law that says what you may do about it when the network splits them apart. Nothing beats the theorem; there is only choosing, deliberately and per feature, which side of the trade you want. That closes out the **building blocks** — the primitives. Next come the **patterns**: the shapes real systems take when you combine these pieces under pressure.

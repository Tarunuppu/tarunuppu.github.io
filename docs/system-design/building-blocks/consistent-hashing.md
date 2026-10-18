---
sidebar_position: 9
title: The hash ring
sidebar_label: "Consistent hashing: The hash ring"
hide_table_of_contents: true
---

# The hash ring

<Updated date="2026-10-13" />

<Topics tags={['Consistent hashing', 'Hash ring', 'The rehashing problem', 'Virtual nodes', 'Load distribution', 'Hot keys', 'Read replicas / salting']} />

[Splitting the data](./splitting-the-data) ended on a cliffhanger. Hash-based sharding spreads data beautifully — until you add or remove a shard, and `shard = hash(key) % N` reshuffles almost *everything*, because `N` changed. For a system that's growing, that's a dealbreaker: every time you add capacity, nearly all your data has to move at once. **Consistent hashing** is the fix — a different way to map keys to shards that moves only a thin slice of the data when the shard count changes.

## The problem, precisely

Recall the formula: `shard = hash(key) % N`, where `N` is the number of shards. The `% N` is the weak point. Add one shard and `N` goes from, say, 4 to 5 — and because every key's shard is computed *modulo N*, changing `N` changes the answer for almost every key at once.<Sidenote>Concretely: a key with `hash = 10` lands on `10 % 4 = 2` with four shards; grow to five and it's `10 % 5 = 0` — a different shard. Do that for every key and almost none stay put.</Sidenote> Nearly all the data has to migrate, all at the same moment. Removing a shard does the same thing in reverse. The result is a storm of data movement — heavy load on the databases and a degraded experience for users — striking exactly when you're trying to grow.

## The fix: a ring

Consistent hashing's key insight is to stop treating shards as numbered slots and instead arrange **both the data and the shards on a circle** — the **hash ring**. The construction has three steps:

1. Take a big range of numbers — say 0 to 2³¹ − 1 (about two billion) — and bend it into a circle, so the largest number wraps back around to 0.
2. **Place each shard on the ring** by hashing something stable about it (its name or ID) to a point on that circle.
3. **Place each key** the same way: hash the key to a point on the ring, then walk **clockwise** until you hit a shard. That shard stores the key.

<figure className="diagram">
<svg viewBox="0 0 420 320" width="420" height="320" role="img" aria-label="A hash ring drawn as a circle. Four shards S1 to S4 sit at points around the circle. One key is hashed to a point on the ring and an arrow shows it walking clockwise to the next shard, S2.">
  <defs>
    <marker id="ch-arrow1" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <circle className="d-stroke" cx="210" cy="160" r="110" strokeWidth="1.5" fill="none" />
  <circle className="d-accent" cx="265" cy="65" r="9" />
  <circle className="d-accent" cx="305" cy="215" r="9" />
  <circle className="d-accent" cx="155" cy="255" r="9" />
  <circle className="d-accent" cx="115" cy="105" r="9" />
  <text className="d-text" x="276" y="44" fontSize="13" textAnchor="middle">S1</text>
  <text className="d-text" x="330" y="228" fontSize="13" textAnchor="middle">S2</text>
  <text className="d-text" x="142" y="276" fontSize="13" textAnchor="middle">S3</text>
  <text className="d-text" x="92" y="98" fontSize="13" textAnchor="middle">S4</text>
  <circle className="d-fill" cx="288" cy="82" r="7" />
  <circle className="d-stroke" cx="288" cy="82" r="7" strokeWidth="1.5" />
  <text className="d-text" x="305" y="80" fontSize="12" textAnchor="start">key</text>
  <path className="d-accent-stroke" d="M289,101 A98 98 0 0 1 300,199" strokeWidth="2" markerEnd="url(#ch-arrow1)" />
  <text className="d-text" x="326" y="150" fontSize="11" textAnchor="start">clockwise</text>
</svg>
<figcaption>Data and shards share one ring. A key is hashed to a point, then walks clockwise to the first shard it meets — here, S2. Because a key belongs to the next shard clockwise, adding or removing a shard only moves the keys in one arc; everything else stays exactly where it is.</figcaption>
</figure>

Now the payoff. Because each key belongs to the first shard clockwise of it, **adding or removing a shard only affects the keys in one arc** — the stretch of ring between the changed shard and its neighbour. Remove a shard, and only *its* keys move, passing to the next shard clockwise. Add a shard, and it takes over just the keys in the arc immediately counter-clockwise of its new position. Either way, every other key stays exactly where it was: instead of reshuffling everything, you move a single arc's worth of data — which is the whole point.

<figure className="diagram">
<svg viewBox="0 0 420 320" width="420" height="320" role="img" aria-label="The hash ring with shards S1, S3 and S4 in place and S2 removed. The arc from S1 to S2 is thickened to show the affected keys, and a dashed arrow shows them passing clockwise to S3.">
  <defs>
    <marker id="ch-arrow-rm" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" className="d-accent" /></marker>
  </defs>
  <circle className="d-stroke" cx="210" cy="160" r="110" strokeWidth="1.5" fill="none" />
  <path className="d-accent-stroke" d="M265,65 A110 110 0 0 1 305,215" strokeWidth="5" />
  <circle className="d-accent" cx="265" cy="65" r="9" />
  <circle className="d-accent" cx="155" cy="255" r="9" />
  <circle className="d-accent" cx="115" cy="105" r="9" />
  <circle className="d-fill" cx="305" cy="215" r="9" />
  <circle className="d-stroke" cx="305" cy="215" r="9" strokeWidth="1.5" />
  <path className="d-stroke" d="M299,209 L311,221" strokeWidth="1.5" />
  <path className="d-stroke" d="M311,209 L299,221" strokeWidth="1.5" />
  <path className="d-accent-stroke" d="M286,219 A96 96 0 0 1 177,250" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#ch-arrow-rm)" />
  <text className="d-text" x="276" y="44" fontSize="13" textAnchor="middle">S1</text>
  <text className="d-text" x="142" y="276" fontSize="13" textAnchor="middle">S3</text>
  <text className="d-text" x="92" y="98" fontSize="13" textAnchor="middle">S4</text>
  <text className="d-text" x="326" y="214" fontSize="12" textAnchor="start">S2 removed</text>
  <text className="d-text" x="338" y="120" fontSize="11" textAnchor="start">S2's keys</text>
  <text className="d-text" x="196" y="243" fontSize="11" textAnchor="middle">to S3</text>
</svg>
<figcaption><strong>Removing a shard.</strong> Only S2's own arc — the stretch from S1 up to S2 — is affected; those keys pass clockwise to the next shard, S3. Every other key on the ring stays exactly where it was.</figcaption>
</figure>

<figure className="diagram">
<svg viewBox="0 0 420 320" width="420" height="320" role="img" aria-label="The hash ring with shards S1 to S4 and a new shard S-star added between S1 and S2. The arc from S1 to S-star is thickened to show the slice of keys the new shard takes over.">
  <circle className="d-stroke" cx="210" cy="160" r="110" strokeWidth="1.5" fill="none" />
  <path className="d-accent-stroke" d="M265,65 A110 110 0 0 1 315,126" strokeWidth="5" />
  <circle className="d-accent" cx="265" cy="65" r="9" />
  <circle className="d-accent" cx="305" cy="215" r="9" />
  <circle className="d-accent" cx="155" cy="255" r="9" />
  <circle className="d-accent" cx="115" cy="105" r="9" />
  <circle className="d-accent" cx="315" cy="126" r="8" />
  <circle className="d-stroke" cx="315" cy="126" r="13" strokeWidth="1.5" fill="none" />
  <text className="d-text" x="276" y="44" fontSize="13" textAnchor="middle">S1</text>
  <text className="d-text" x="324" y="226" fontSize="13" textAnchor="middle">S2</text>
  <text className="d-text" x="142" y="276" fontSize="13" textAnchor="middle">S3</text>
  <text className="d-text" x="92" y="98" fontSize="13" textAnchor="middle">S4</text>
  <text className="d-text" x="334" y="150" fontSize="12" textAnchor="start">S* (new)</text>
  <text className="d-text" x="330" y="82" fontSize="11" textAnchor="start">taken by S*</text>
</svg>
<figcaption><strong>Adding a shard.</strong> S*, dropped between S1 and S2, carves out just one slice — the keys from S1 up to itself, which used to continue on to S2. S2 keeps the rest, and every other shard is untouched.</figcaption>
</figure>

## The catch: lopsided load

Consistent hashing kills the redistribution storm, but on its own it creates a different imbalance. When you remove a shard, *all* of its keys land on one shard — the next one clockwise — which suddenly inherits roughly double the load. Add a shard, and it relieves only its one clockwise neighbour, leaving every other shard as busy as before. Either way the change lands on a *single* neighbour rather than being shared out.<Sidenote>There's a quieter version of the same problem even when nothing changes: with only a few shards dropped at random points, the arcs between them come out uneven — one shard owns a big arc, another a sliver — so the load is lopsided from the start.</Sidenote> The result is uneven load across the cluster.

## The fix for that: virtual nodes

The trick is to stop giving each shard a **single** spot on the ring and instead scatter it across **many** spots. Each physical shard is represented by dozens or hundreds of **virtual nodes** — separate points on the ring that all route back to the same underlying machine.

Now each shard owns many small arcs sprinkled all around the ring instead of one big contiguous one. So when a shard is removed, its many little arcs are inherited by many *different* neighbours — the departed load is spread across the whole cluster rather than dumped on one machine. Adding a shard works the same way in reverse: the newcomer lifts a little load off many shards at once.

<figure className="diagram">
<svg viewBox="0 0 420 320" width="420" height="320" role="img" aria-label="A hash ring where three databases each appear at several points, interleaved around the circle. The points belonging to database 2 are highlighted, and arrows show each of its arcs passing to a different neighbouring database when it is removed.">
  <defs>
    <marker id="ch-arrow2" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 Z" className="d-accent" /></marker>
  </defs>
  <circle className="d-stroke" cx="210" cy="160" r="110" strokeWidth="1.5" fill="none" />
  <circle className="d-fill" cx="210" cy="50" r="9" />
  <circle className="d-stroke" cx="210" cy="50" r="9" strokeWidth="1.25" />
  <circle className="d-fill" cx="318" cy="141" r="9" />
  <circle className="d-stroke" cx="318" cy="141" r="9" strokeWidth="1.25" />
  <circle className="d-fill" cx="305" cy="215" r="9" />
  <circle className="d-stroke" cx="305" cy="215" r="9" strokeWidth="1.25" />
  <circle className="d-fill" cx="172" cy="263" r="9" />
  <circle className="d-stroke" cx="172" cy="263" r="9" strokeWidth="1.25" />
  <circle className="d-fill" cx="115" cy="215" r="9" />
  <circle className="d-stroke" cx="115" cy="215" r="9" strokeWidth="1.25" />
  <circle className="d-fill" cx="139" cy="76" r="9" />
  <circle className="d-stroke" cx="139" cy="76" r="9" strokeWidth="1.25" />
  <circle className="d-accent" cx="281" cy="76" r="10" />
  <circle className="d-accent" cx="248" cy="263" r="10" />
  <circle className="d-accent" cx="102" cy="141" r="10" />
  <text className="d-label" x="210" y="30" fontSize="12" textAnchor="middle">3</text>
  <text className="d-label" x="298" y="58" fontSize="12" textAnchor="middle">2</text>
  <text className="d-label" x="344" y="139" fontSize="12" textAnchor="middle">1</text>
  <text className="d-label" x="328" y="228" fontSize="12" textAnchor="middle">1</text>
  <text className="d-label" x="258" y="287" fontSize="12" textAnchor="middle">2</text>
  <text className="d-label" x="162" y="287" fontSize="12" textAnchor="middle">3</text>
  <text className="d-label" x="92" y="228" fontSize="12" textAnchor="middle">3</text>
  <text className="d-label" x="76" y="139" fontSize="12" textAnchor="middle">2</text>
  <text className="d-label" x="124" y="58" fontSize="12" textAnchor="middle">1</text>
  <path className="d-accent" d="M287,86 L311,129" fill="none" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#ch-arrow2)" />
  <path className="d-accent" d="M236,263 L186,263" fill="none" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#ch-arrow2)" />
  <path className="d-accent" d="M108,131 L132,88" fill="none" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#ch-arrow2)" />
</svg>
<figcaption>Virtual nodes: each database sits at several points on the ring (here the highlighted points all belong to DB2). Because its arcs are scattered, removing DB2 hands them to several different shards — some to DB1, some to DB3 — instead of dumping all of its load on one. Real systems use hundreds of points per node, so the spread comes out very even.</figcaption>
</figure>

## The last problem: hot keys

Virtual nodes even out the load **as long as every key gets roughly the same traffic**. Some keys don't. A single viral key — a celebrity account, a trending video — can be hit so hard that the one virtual node (and so the one machine) holding it is overwhelmed, however evenly the *keys* were spread. This is the **hot-key** problem again, the same one we met as [hot shards](./splitting-the-data) and [hot cache keys](./caching), and it's unavoidable here because a single key still lives on a single node.

Three standard fixes:

- **Read replicas** — copy the hot key onto several nodes and balance reads across them. The most common approach.
- **Key-space salting** — append a small random suffix to the hot key (`taylor-swift-0`, `taylor-swift-1`, … `taylor-swift-9`) so the ten variants hash to ten different nodes. Reads then fan out across them and the results are combined.<Sidenote>The cost is on the edges: a write has to update every salted copy, and a read has to query all the variants and merge them — so you salt only the few genuinely hot keys, not everything.</Sidenote>
- **Adaptive rebalancing** — watch traffic in real time and move hot key-ranges off overloaded nodes. Operationally complex, but some systems (DynamoDB) do it automatically.

:::tip In an interview
If you're asked how to grow a sharded database or a distributed cache *without downtime*, "consistent hashing with virtual nodes" is the headline answer — then show you understand *why*: the ring moves only one arc of data when the cluster changes, and virtual nodes keep that movement evenly spread. Naming the hot-key caveat on top signals real depth.
:::

---

That's the whole machine: data and shards on one circle, each key owned by the next shard clockwise, each shard scattered into many virtual nodes so the load stays even, and hot keys handled on top. It's what lets elastic distributed stores — DynamoDB from the section above, Cassandra, and others built on the same idea — add and remove nodes while live without reshuffling the world.

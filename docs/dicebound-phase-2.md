# Dicebound — Phase 2

Phase 1 shipped a game where a sentence becomes a character and a d20 decides
what happens. Phase 2 gives that game a world: things you carry, people who
remember you, time that passes, and abilities that arrive because the story
gave them to you.

Product direction is Nick's. This document is the model. Nothing here is built
yet, and the point of writing it down first is that six systems added
carelessly would turn a sentence-and-play game into a spreadsheet.

Phase 1's decisions still hold — read [`dicebound-design.md`](./dicebound-design.md)
first. One of them is repealed here, deliberately, and it is called out below.

---

## The rule that governs all of it

Phase 1's architecture is one sentence: **the model narrates, code owns the
numbers.** `roll_check` exists because a model asked to set a difficulty and
roll against it in the same breath will let the player win.

Phase 2 adds six ways to hand out bonuses. Every one of them obeys the same
split, borrowed from `tap-tap-adventure`'s class generator, which builds
mechanics in code and then asks the model for a name and a description that fit
— under the instruction _"DO NOT invent new mechanics"_
(`src/app/tap-tap-adventure/lib/classGenerator.ts`).

So: the generator can be as wild as the premise demands, as long as the numbers
come from a fixed menu.

## Three primitives

Everything in phase 2 compiles down to three things. Species, classes, spells
and equipment are packages of these with names on them; the resolver never
learns they exist.

| Primitive | What it is                                      | Example                                             |
| --------- | ----------------------------------------------- | --------------------------------------------------- |
| **Trait** | always-on, conditional, ±1 or ±2                | _Nightsight_ — +1 when the check involves seeing    |
| **Item**  | a carried thing holding 0–2 traits              | _Coil of rope_ — +0, but makes climbing attemptable |
| **Power** | costs a charge; either _permits_ or _advantage_ | _Ember Word_ — spend a charge to throw fire         |

Two consequences worth stating plainly, because they are what stop the die from
becoming decoration:

- **Most items are +0.** A rope is not a bonus, it is a permission — it turns
  "you can't" into a DC 15. If every item is +1, a well-packed character stops
  rolling. `tap-tap-adventure`'s rarity tables have the right instinct: common
  is 55% of drops and its multiplier is `1.0`.
- **Powers grant advantage, not flat bonuses.** Roll 2d20, keep the higher.
  It is the most exciting lever in tabletop, it is entirely code-owned, and it
  cannot inflate the arithmetic the way a stack of +2s does.

---

# The world model

## What is repealed

`campaign.ts` currently opens with:

> There is no world model behind it, no map, no inventory table — the story _is_
> the state, and the dungeon master reconstructs the situation each turn by
> reading it.

That is repealed. It was right when the only mechanical fact was a d20, and it
runs out the moment the DM says "you drop the lantern" and something other than
prose has to know.

What replaces it is narrower than it sounds: **the graph is an index of the
transcript, not a replacement for it.** The fiction stays authoritative. The
graph holds the handful of facts that need to be checkable — who is owed what,
what you are carrying, where the fire is — and everything else stays prose.

If the DM had to maintain a simulation every turn, latency and reliability would
both die. It doesn't. It touches the two or three things that mattered.

## Entities

```ts
interface Base {
  id: EntityId // stable slug, referenced by edges
  name: string
  note: string // one line of prose, the DM's
  state: string // short and mutable: "the bridge is burned"
  status: 'active' | 'dormant' | 'gone'
  firstTurn: number
  lastSeen: number // elapsed game-minutes, not turn index
}

type Entity =
  | (Base & { kind: 'place'; region?: string })
  | (Base & { kind: 'actor'; disposition: number; scale: 'person' | 'group' })
  | (Base & { kind: 'thing'; portable: boolean })
  | (Base & {
      kind: 'thread'
      threadKind: ThreadKind
      resolution: Resolution
      due: number | null
      pressure: Pressure
    })
```

Four kinds, and **the player is one of them** — entity id `'you'`. Every
relationship is then uniform instead of special-casing the protagonist.

- **actor** covers people _and_ groups. "The Harbour Guard hates you" must not
  require tracking forty guards.
- **thing** is a world object, not inventory. It becomes an `Item` when picked
  up and leaves its entity behind, so the world remembers where the thing came
  from — which matters for provenance, below.
- **thread** is deliberately not called "quest". It covers debts, promises,
  threats and mysteries. The interesting unfinished business in a story is
  rarely a fetch.
- `disposition` is −3..+3, clamped in code. The DM proposes a nudge; code
  applies it.

**Disposition is never shown as a number.** A visible +2 turns a person into a
stat to farm, and the moment a player is optimising an NPC rather than talking
to one, the game has lost the thing it is for. The sheet says "owes you for the
boat"; it does not say `+2`.

## Relationships

A flat edge list, not fields on entities.

```ts
interface Edge {
  from: EntityId
  to: EntityId
  kind: EdgeKind
  note: string // "for the boat he lost"
  since: number // elapsed game-minutes when it formed
}

type EdgeKind =
  | 'at'
  | 'holds'
  | 'guards' //  physical
  | 'knows'
  | 'kin'
  | 'part-of' //  social structure
  | 'owes'
  | 'wants'
  | 'fears' //  pressure
  | 'involves'
  | 'leads-to' //  threads, geography
```

Edges rather than fields, for three reasons: the connections are many-to-many,
they change constantly, and the fiction will keep inventing kinds of connection
that a field-per-relationship schema cannot absorb without a migration each
time. A flat list also serialises straight into the Firestore blob and renders
into prompt text in one pass.

**Edges are mechanically live, and that is the payoff.**
`owes(harbour-guard → you, "for the boat")` becomes a **+2 chip labelled "he
still owes you for the boat"** on the die card. A player who spent three turns
getting a guard on side watches that turn into two points, in the same place
they already learned that a wet floor costs them. The world is mechanical, and
the die card is where they find out.

---

# The clock

Each turn advances an in-fiction clock by an amount the DM declares. This is
the smallest addition in phase 2 and it does the most work: it makes thread
pressure real, it makes rest checkable, and it is a scalar that code
accumulates, so it cannot be argued with.

```ts
interface Clock {
  elapsed: number // minutes since the story began
  startHour: number // where on the day-cycle the story opened
}
```

## Rendering

Never as a wall-clock time. A world with digital precision is the wrong world.

Bands: _deep night, dawn, morning, midday, afternoon, dusk, evening, night_,
rendered with the day count — "Day 6, late afternoon". The player sees a phrase;
code holds an integer.

## Advancing

```ts
function advance(clock, minutes, threads): { clock: Clock; fired: EntityId[] }
```

Clamped per turn. A DM that skips three years every turn breaks every other
system in this document.

The important behaviour: **if a turn's elapsed time would cross an open thread's
due time, the clock stops at the fuse and the thread fires.** The remaining
minutes are simply not spent.

That reads oddly as an algorithm and perfectly as fiction. The player says "we
travel for a week"; four hours in, the thing they have been ignoring catches up
with them, and the week does not happen. Time cannot be used to outrun
consequences, and "it comes to find you" falls out of the model rather than
needing to be prompted for.

## Rest

`refresh: 'rest'` is meaningless if the model decides what a rest is. Code
decides, from the clock:

1. six or more hours elapsed in a single turn, **and**
2. the DM flagged the turn safe, **and**
3. no `threat` thread is currently at `urgent` pressure.

The third condition is the one the model cannot wave away.

## Later

The clock is also what would make Endurance, Stomach and Resolve mean something
— hours awake, days without food. Those skills exist today with nothing to do.
Not phase 2, but the clock is the prerequisite, which is part of why it is worth
building now.

---

# Threads

A thread is unfinished business with a fuse.

```ts
type ThreadKind = 'promise' | 'debt' | 'threat' | 'mystery' | 'goal'
type Resolution = 'open' | 'kept' | 'broken' | 'cold'
type Pressure = 'patient' | 'pressing' | 'urgent'
```

`due` is an absolute value on the clock. When it passes, the thread does not
auto-fail — **it makes a move.** The DM is handed _"the thread `harbour-debt` is
now pressing: [note]. Make a move,"_ and that is a Dungeon World hard move,
scheduled. This is how "think offscreen too" gets mechanised instead of hoped
for.

Default fuse windows, to be tuned:

| Pressure | Window  |
| -------- | ------- |
| patient  | 3 days  |
| pressing | 8 hours |
| urgent   | 1 hour  |

A thread that fires and is engaged with gets resolved or rescheduled by the
fiction. A thread that fires and is ignored escalates one step of pressure. After
three unengaged firings it goes **cold** — dormant, no more fuses, revivable
later as a surprise. Without that, a forgotten promise nags forever, which is the
one failure mode that would make the whole system feel like a chore.

**Loose ends** — the open-thread list — is the phase 2 feature most likely to
move daily return rate. You come back because something is unfinished, and now
something always is.

---

# Powers

**A power never resolves an outcome. It only makes an outcome available.**

Fireball does not kill the guard; it turns "you cannot hurt him from here" into a
Power check at DC 15, which can miss. Everything still lands on the one
resolution engine, which is the only reason adding abilities does not require
touching `dice.ts`.

```ts
interface Power {
  id: string
  name: string
  note: string // what it looks like when used
  tier: 1 | 2 | 3
  shape: 'permits' | 'advantage'
  permits?: string // plain language: "throw fire, at range"
  applies?: { attributes?: AttributeId[]; skills?: SkillId[] }
  charges: number
  max: number
  refresh: 'rest' | 'chapter'
  cost?: string // the price, if it has one
  source: EntityId // ← provenance. Required.
  gainedAt: number // clock
}
```

## Provenance

`source` being non-optional is the design. **A power must come from something
the world already knows about** — a person who taught you, a thing you found, a
place that changed you. The DM cannot conjure fireball out of nothing, because
"nothing" fails a type check.

This is where the world model earns its keep mechanically rather than
decoratively. Without entities there is no way to check that the salamander
keeper exists; with them, provenance is a lookup.

## Two paths in

**Granted.** The fiction hands it over — taught, found, bargained for, survived.
The DM calls `grant_power` naming an existing entity as the source. Code checks
the free slot, the tier against the level, and that the source is an entity the
player has actually encountered. Code then fixes charges and refresh from the
tier table; the model only names and describes.

**Emerged.** You did the thing enough times. A skill reaching rank 3 (18 uses)
opens a window, and the DM is _told_ — not instructed — that _"Ilda's Chemistry
has matured; if the fiction offers a moment, something may come of it."_ The
power arrives when the story has somewhere to put it.

Path 1 is how you get fireball in a world with wizards. Path 2 is how you get it
after twenty turns of throwing burning things.

## The gate

| Lever      | Rule                                        |
| ---------- | ------------------------------------------- |
| How many   | `maxPowers = 1 + floor(level / 2)`          |
| How strong | tier 1 at level 2, tier 2 at 4, tier 3 at 7 |
| Charges    | fixed by tier, not by the model             |
| Where from | an entity the player has met                |

Level is `1 + floor(earned ranks / 3)`, and ranks are earned on use, so power
acquisition inherits its anti-inflation property from the skill system instead
of needing its own. Tier 2 at level 4 is a starting guess and expected to move.

## Worked example

Turn 31. Level 4, one slot free. Three turns spent getting the salamander keeper
to trust you; the graph holds `owes(keeper-imra → you)` since turn 27.

`grant_power({ source: 'keeper-imra', tier: 2, shape: 'permits', permits: 'throw fire, at range' })`
→ code verifies slot, tier, and that `keeper-imra` is an actor the player has
met → code sets 2 charges, refresh on rest → the model names it _Ember Word_ and
writes what it looks like.

Turn 33, against a bridge troll: `use_power` spends the charge, then a normal
Power check at a DC the fiction sets. The die card shows the chips. It can miss.

---

# Species

Generated at creation from the premise, so "pirates but everyone is a cat"
produces cats. One package: an innate skill adjustment, one trait, **and one
drawback.**

The drawback is not flavour. `tap-tap-adventure`'s items carry one
(`models/item.ts`) for the same reason: a package that is purely upside reads as
a reward rather than as a thing that is true about you. Species without a cost
is a stat bonus with a name.

Fallback table for generation failure, following `FALLBACK_CLASSES`. Play never
blocks on a model call — phase 1's creation route already holds this line.

---

# Classes and levels

Chosen classes fight what makes this game good. Progression here is _emergent_:
the sheet is a record of what you actually did. "Pick Fighter or Wizard" replaces
that with a prescription and turns the first screen into a menu.

**Classes are discovered.** At level 2 the game reads the skill-use histogram,
notices what you have been doing, and the model _names the thing you already
are_. You did not pick Cat Burglar; you kept picking locks, and the cave formed
an opinion.

Same code-computes-shape / model-names-it split as everything else, and it costs
nothing in cold-start friction.

- **Level** = `1 + floor(earned ranks / 3)`, capped around 10.
- **Class abilities** at even levels — five powers over a long campaign, each
  generated from the class plus recent play.

---

# Inventory

Slots, not weight. A cap of around twelve, because a limit that forces a choice
makes a story and a limit that requires arithmetic does not.

An `Item` is a carried thing with 0–2 traits, optional charges, and an origin
pointing at the world entity it came from. The model names the thing and says where it came from;
code rolls the quality band from a provenance table adapted from
`itemRarityGenerator.ts`. There is no field for requesting a better item —
the provenance is the only input.

Items reach a check the same way situational modifiers do: the DM names which
ones it is using, and code looks up what they are actually worth. The model can
say _that the rope applies_; it cannot say _what the rope is worth_.

---

# The tool surface

Latency is the real cost of phase 2. Turns already do not stream, and every
extra round trip inside the 120s budget is felt.

**The turn ends with a forced `narrate` call carrying prose, clock and world
deltas together.** No separate bookkeeping pass, no extra round trip. This is
the shape `openStory` already uses — `begin_story` returns a title and an
opening scene in one forced tool call.

| Tool          | When                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `roll_check`  | unchanged from phase 1                                                    |
| `use_power`   | spend a charge, then roll                                                 |
| `recall`      | pull a dormant entity back into context                                   |
| `grant_power` | rare; gated on provenance and level                                       |
| `narrate`     | terminal. `{ text, elapsed, safe, touch[], edges[], items[], threads[] }` |

Passes 0..n−1 offer `[roll_check, use_power, recall, narrate]` on auto; the loop
ends when `narrate` is called. The final pass forces `narrate`.

This is strictly better than phase 1's trick of withdrawing the tool to force
prose: the terminal state becomes explicit rather than inferred from the absence
of tool calls.

---

# Reconciliation

The DM touches only what mattered this turn. **`condense` repairs the rest.**

It already runs roughly every twenty turns and already pays for a slow model
call, so it becomes the graph's garbage collector: rebuild entities the DM
mentioned but never registered, mark stale ones dormant, prune to the cap, fix
dangling edges, retire cold threads.

A rare latency cost, paid at a moment that already pays one.

It also fixes what phase 1 calls _"the only lossy thing in the game."_ Names,
debts and promises stop living in condensed prose and start living in a
structure that cannot silently drop them.

## What reaches the prompt

Sixty entities will not fit. A **relevance window**, capped near 20 entities and
30 edges:

- where you are, and what it connects to
- actors present, and actors named in the last few turns
- open threads
- anything the player just mentioned

Everything else goes dormant but stays retrievable via `recall`. That is how
_"wait — that's the man from the harbour"_ works twelve chapters later, which is
most of the reason for building any of this.

---

# Storage

Phase 1 stores one Firestore document per player at
`users/{uid}/dicebound/campaign`, as a single unindexed JSON string plus a few
readable scalars. That shape survives phase 2 unchanged. What changes is _who
holds the campaign_.

## Does it fit?

| Part                               | Est. size |
| ---------------------------------- | --------- |
| Entities (cap 200 × ~300 B)        | ~60 KB    |
| Edges (cap 400 × ~120 B)           | ~48 KB    |
| Inventory, powers, class, clock    | ~8 KB     |
| Transcript (capped at 120 entries) | ~60 KB    |
| Synopsis                           | ~8 KB     |
| **Total**                          | ~185 KB   |

Against a `MAX_CAMPAIGN_BYTES` of 700 KB and a Firestore document ceiling of
1 MiB. It fits with room, and the word budget from the Voice section makes the
transcript _smaller_ than it is today.

The caps are what keep that true. Entity and edge caps are not tidiness — they
are the reason a campaign 400 turns deep still writes.

## The change worth making: server-authoritative

Today the client holds the campaign and POSTs the whole thing to
`/api/v1/dicebound/turn`. `validateCampaign` treats that body as hostile and
clamps what it can.

Phase 2 breaks that, because **clamping cannot tell an earned Ember Word from a
fabricated one.** Attributes and ranks have legal ranges; an inventory does not.
Once items, powers and relationship bonuses exist, client-held state is a
cheating surface no validator can close — the client can mint the power _and_
the entity it claims to come from.

So the campaign moves server-side: **the client sends a token and an action, the
server loads, resolves, saves, and returns the new entries.** Three things fall
out of it at once —

- The cheating surface closes. Provenance means something because the client
  never authored it.
- The request stops carrying ~185 KB on every turn, which is a real cost on
  mobile. It carries a sentence.
- The client becomes a renderer, which is what it should have been.

The cost is one extra Firestore read per turn, at roughly $0.0000006. The
anonymous-uid path already exists and `firestore.rules` already denies direct
client access (`allow read, write: if false`), so this is a smaller change than
it sounds.

## Does it work for many players?

Yes, and it is not close.

A turn is one read and one write. Firestore's free tier is 20k writes a day —
about 800 sessions before anything is billed at all. At a scale this game will
not see for a long time, 250k turns a day:

| Line                         | Monthly |
| ---------------------------- | ------- |
| 7.5M reads                   | ~$4.50  |
| 7.5M writes                  | ~$13.50 |
| ~25 GB storage               | ~$4.50  |
| **Firestore total**          | ~$23    |
| Anthropic, at cents per turn | ~$300k  |

**Firestore is rounding error next to the model bill.** Any effort spent
optimising storage is effort not spent on the thing that actually costs money,
which is tokens per turn — and that is a reason to keep the relevance window
tight, not a reason to think about databases.

Two non-issues worth naming so they don't get raised later: a single document
sustains about one write per second, which no human turns faster than; and one
document per player means there is no hot partition, no fan-out, and nothing to
shard.

## Where it would actually break

The blob is opaque to queries. Phase 1 already handles this by mirroring a few
readable scalars alongside it (title, character name, turns, streak, bytes,
updated-at); phase 2 should extend that set with level, class name and story-day.
Anything a future home page, leaderboard or share card wants to read must be a
scalar, not something dug out of the blob.

The real ceiling is a campaign that runs forever. The escape hatch, when it is
needed:

- `campaign` — live state, bounded: graph, clock, character, recent transcript
- `chapters/{n}` — archived transcript, write-once, never read during a turn

Not worth building now. Worth _designing toward_: keep `transcript` a distinct
top-level key, and let nothing reference a transcript entry by index.

## One free improvement

`condense` currently compresses old entries into prose and **drops them
permanently** — phase 1 calls it "the only lossy thing in the game."

It already runs every twenty turns and already pays for a slow model call. Have
it write what it drops to `chapters/{n}` while it is there. One extra write per
twenty turns, and the story stops being destroyed to keep the prompt small. That
archive is also what share pages and heirlooms would later be built on.

---

# The rules that stop this becoming a fudge vector

Phase 2 hands the model six new ways to hand out bonuses.

1. **An edge must predate this turn to grant a bonus.** The DM cannot invent
   `owes(guard → you)` and cash it in the same breath — that is situational
   modifiers with extra steps. Relationship bonuses are earned in past play or
   they are not earned. This is what `Edge.since` is for.
2. **Kit and relationship bonuses share a +3 cap**, separate from the existing
   ±6 situational budget. Otherwise a well-equipped, well-connected character
   stops rolling.
3. **Provenance is type-enforced.** `Power.source` and item origins point at
   real entities.
4. **Time is clamped per turn**, and cannot skip a fuse.
5. **Rest is code-detected**, not model-asserted.

---

# Voice

The verbosity problem is not fixed by asking for brevity. Dungeon World's actual
mechanism is the **move list**: the GM does not improvise a paragraph, they make
a move and hand the ball back.

Wired to the existing outcome bands:

| Band                      | Move                                                                             |
| ------------------------- | -------------------------------------------------------------------------------- |
| critical / strong success | what they wanted, **and** an opportunity                                         |
| success                   | what they wanted, cleanly, in one sentence                                       |
| near miss                 | success with a cost, or tell them the consequence and ask                        |
| failure                   | a hard move: use up a resource, put someone in a spot, reveal an unwelcome truth |
| critical failure          | a hard move that changes the scene                                               |

Three principles do most of the anti-exposition work:

- **Never speak the name of your move.** Do not say "you fail". Do not name the
  DC. Do not announce a setback as a setback.
- **Ask questions and use the answers.** _"Which of these guards do you already
  owe money to?"_ — makes the player a co-author and is two lines instead of
  twelve. It also feeds the graph for free.
- **Begin and end with the fiction.** No recap, no summary, no meta.

Enforced structurally rather than politely: a hard word budget (~70 words unless
a roll happened), a lower `maxTokens` on the narration pass, and a throwaway
script that plays twenty turns and prints the word-count distribution, so we can
tell whether it took.

Dungeon World is CC-BY, so lifting is permitted, but the move list should be
paraphrased into this game's voice rather than pasted.

---

# Starting skills

The smallest change here and the largest first-session win. A blank sheet is the
current cold-start weakness.

The creation route already reads the concept sentence; it should also grant
**2–3 skills at rank 1**, with `uses` pre-seeded to `RANK_THRESHOLDS[0]` so the
next use advances normally. A locksmith starts with Hand/Eye. Species
contributes one more.

---

# Migration

`validateCampaign` refuses any version mismatch and returns `null`
(`campaign.ts`). Bumping `CAMPAIGN_VERSION` to 2 without a migration would
silently delete every existing campaign — the player would just find an empty
game.

The migration is easy and mostly free: **a v1 campaign starts with an empty
graph and a zeroed clock, and the first reconciliation pass populates the graph
from the transcript it already has.** The repair pass _is_ the migration. This
must land before the constant moves, not after.

---

# What the player sees

Same discipline as the phase 1 sheet: **nothing renders until it exists.** No
empty map, no zeroed quest log, no greyed-out spell slots. A new character must
not be able to tell that five of these systems are there.

| Surface                                    | Why                                                          |
| ------------------------------------------ | ------------------------------------------------------------ |
| **Loose ends** — open threads              | Return driver. You come back because something is unfinished |
| **People you know** — in prose             | Attachment, session length                                   |
| **Where you are**, and places you know     | A list, not cartography                                      |
| **Day 6, late afternoon**                  | Makes the clock legible; a good share sentence               |
| Relationship and kit chips on the die card | Teaches that the world is mechanical, not decorative         |

---

# Sequencing

Risk-descending, each step shippable on its own.

| #   | Sprint                      | Contains                                                                                                                                                          |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Voice**                   | GM moves, word budget, the `narrate` tool. No stored-schema change                                                                                                |
| 2   | **Starting skills**         | Creation route only                                                                                                                                               |
| 3   | **v2: clock + graph**       | Entities, edges, clock, reconciliation in `condense`, migration, **server-authoritative campaign**. No new player-facing mechanics — the DM just stops forgetting |
| 4   | **Threads**                 | Fuses, escalation, cold threads, the loose-ends panel                                                                                                             |
| 5   | **Kit**                     | Inventory, species, the trait primitive, rarity tables                                                                                                            |
| 6   | **Powers, classes, levels** | Needs everything above                                                                                                                                            |

Sprint 3 is the one with real architectural risk and no visible payoff, which is
exactly why it should not be bundled with anything else.

---

# Open, deliberately

- **Streaming.** Still the biggest felt improvement available, and phase 2 makes
  turns longer, not shorter. The `narrate` tool makes streaming _harder_
  (structured output streams badly); that trade is being accepted knowingly and
  should be revisited.
- **Hunger, exhaustion, wounds.** The clock makes these possible and Endurance,
  Stomach and Resolve are waiting for them. Not phase 2.
- **Heirlooms.** `tap-tap-adventure`'s best idea: a finished character leaves an
  object behind for the next one (`lib/heirloomGenerator.ts`). It is the answer
  to phase 1's open "no end-of-session ceremony" and "one campaign per player"
  at once. Phase 3, but the model should be built with it in view.
- **The name.** Still `Dicebound`, still a placeholder, now with a graph schema
  about to be named after it.

# Population Sim — Domain Model

**Status: approved by Nick, 2026-10-12.** This turns the concept-level
decisions in `SKILL.md` into concrete TypeScript types. Nothing here is code
yet; it is the blueprint for `types.ts`. Section 14 lists the choices this
model made beyond the conversation, all approved. Change this file when the
model changes, and record why in `SKILL.md` → Decisions.

Read in order. Each section opens by naming the decision it implements.

---

## 0. Conventions

```ts
// Every id is a branded string, prefixed by kind ("per_…", "evt_…") so logs
// and prose citations stay readable. Ids come from the world's seeded RNG,
// so the same seed produces the same ids.
type Id<K extends string> = string & { readonly __kind: K }
type PersonId = Id<'person'>
type OrgId = Id<'org'>
type PlaceId = Id<'place'>
type EventId = Id<'event'>
type ClaimId = Id<'claim'>
type BeliefId = Id<'belief'>
type SecretId = Id<'secret'>
type RumorId = Id<'rumor'>
type GoalId = Id<'goal'>
type CohortId = Id<'cohort'>
type RenderingId = Id<'rendering'>

// Content-pack ids are plain strings ("species:dwarf", "trait:oathbreaker").
type ContentId = string

// World time is one integer: minutes since the world's founding (year 0,
// day 0, 00:00). 100 years ≈ 52.6M, far inside safe-integer range. History
// mode moves in seasons, live mode in minutes, on the same clock. Months,
// seasons and year length come from the world's calendar (content).
type Instant = number
type Duration = number

// Anything an event, claim or feeling can point at.
type EntityRef =
  | { kind: 'person'; id: PersonId }
  | { kind: 'org'; id: OrgId }
  | { kind: 'place'; id: PlaceId }
  | { kind: 'cohort'; id: CohortId }

// Numbers that live on a bounded scale use -100..100 (feelings, indicators) or
// 0..100 (temperament, confidence, salience). The scale is stated per field.
```

**Determinism.** The RNG is stream-split. Each event draws from
`rng(worldSeed, eventSeq)`, never from a shared global stream. That way,
inserting a backdated event or materializing a cohort doesn't shift every
later random draw.

---

## 1. The world

```ts
interface World {
  id: string
  seed: string
  createdAt: number            // wall clock (ms); not world time
  settings: WorldSettings
  packs: ContentPackRef[]      // core library first, then the world's own pack
  // Only events are written. Everything else is derived (§2).
  log: EventLog
  snapshots: SnapshotRef[]
  renderings: Rendering[]      // cached prose (§11); not world truth
  budget: AiBudget             // §11
}

interface WorldSettings {
  size: 'hamlet' | 'village' | 'town' | 'city' | 'region'
  techLevel: ContentId         // "tech:early-iron", "tech:clockwork"
  government: ContentId        // an org kind (§8)
  economy: ContentId           // selects livelihood kinds and flows (§9)
  species: { id: ContentId; share: number }[]  // settler mix
  tone: ToneSettings
  storyteller: StorytellerSettings             // §10
  founding: { settlers: number; yearsOfHistory: number }
  // The creator's free-text premise ("a mining town under a sleeping dragon"),
  // kept verbatim because the AI pack (§10) is written from it.
  premise?: string
}

interface ToneSettings {
  // One dial from storybook to grimdark, plus hard switches that the dial
  // sets by default and the creator can tighten (never loosen past the dial).
  darkness: 0 | 1 | 2 | 3 | 4   // 0 = kids' storybook … 4 = hellscape
  allow: {
    death: 'offscreen' | 'onscreen' | 'violent'
    romance: 'none' | 'chaste' | 'adult'   // 'none' still allows marriage + family
    violence: 'none' | 'peril' | 'combat' | 'brutal'
    cruelty: boolean            // torture, abuse, atrocity
    vice: boolean               // drink, gambling, addiction
    crime: 'mischief' | 'theft' | 'any'
  }
  // Every template, AI output and creator text is checked against these (§12).
}
```

**Content packs.** Species, traits, drives, org kinds, livelihoods, event
templates, naming styles, calendars, feeling axes and tone rules are all pack
data. A world loads the core pack, then its AI-written pack, then optional
creator packs. Later packs can add entries; they can override an entry only by
id, and only within tone limits.

```ts
interface ContentPack {
  id: ContentId
  source: 'core' | 'ai' | 'creator'
  species?: SpeciesDef[]
  traits?: TraitDef[]
  drives?: DriveDef[]
  feelingAxes?: FeelingAxisDef[]
  tieKinds?: TieKindDef[]
  orgKinds?: OrgKindDef[]
  livelihoods?: LivelihoodDef[]
  placeKinds?: PlaceKindDef[]
  templates?: EventTemplate[]
  labels?: LabelRule[]          // §5
  naming?: NamingStyle[]
  calendar?: CalendarDef
}

interface SpeciesDef {
  id: ContentId
  name: string
  // Ages in years. The old prototype's `lifespan` splits into stages so
  // "elder", "child" and so on are data, not code.
  stages: { adult: number; elder: number; typicalDeath: number; maxAge: number }
  canHaveChildrenWith: ContentId[]
  // Child species for each pairing; omitted pairings default to either parent.
  offspring?: { with: ContentId; child: ContentId }[]
  fertility: { fromAge: number; toAge: number; perYear: number }
  temperamentBias?: Partial<Temperament>
  naming: ContentId
}
```

---

## 2. Events — the source of truth

*Decision: event sourcing.* The log is append-only, ordered by `seq`, not by
`at`. A backdated event gets a new, higher `seq` but an earlier `at`.

```ts
interface WorldEvent {
  id: EventId
  seq: number                  // position in the log; the replay order
  at: Instant                  // when it happened in the world
  recordedAt: number           // wall clock
  template: ContentId | null   // null for genesis and improvised events
  source: EventSource
  roles: Record<string, EntityRef>   // "master" → per_…, "apprentice" → per_…
  causes: Cause[]              // why it happened; the anti-noise backbone
  outcome?: string             // which weighted outcome fired
  effects: Effect[]            // RESOLVED effects, applied in order on replay
  gist: string                 // one-line plain summary from the template
  importance: 0 | 1 | 2 | 3    // storyteller weight; 3 = chronicle headline
  visibility: 'public' | 'witnessed' | 'private'  // who learns of it (§6)
  tone: ToneTag[]              // what tone gates it needed
}

type EventSource =
  | { kind: 'engine' }                     // core or pack template
  | { kind: 'ai'; call: string }           // improvised, AI pack, or backfill
  | { kind: 'creator'; nudge: NudgeKind }  // a nudge or a written-in character
  | { kind: 'genesis' }                    // settler seed, founding

type Cause =
  | { kind: 'event'; id: EventId }            // directly follows from
  | { kind: 'goal'; id: GoalId }              // pursued this goal
  | { kind: 'belief'; id: BeliefId }          // acted on what they believed
  | { kind: 'feeling'; from: EntityRef; to: EntityRef; axis: ContentId }
  | { kind: 'indicator'; place: PlaceId; key: IndicatorKey }  // bad harvest
  | { kind: 'secret'; id: SecretId }
  | { kind: 'rumor'; id: RumorId }

type NudgeKind = 'introduce' | 'rumor' | 'festival' | 'disaster' | 'arrival'
  | 'indicator' | 'custom'
```

**Effects, not templates, are replayed.** The log stores each effect as it
resolved, so editing a template later never rewrites the past, and an AI
event replays with no AI call. Effects are the write half of the fixed
vocabulary (§10). Every state change in the model is one of these:

```ts
type Effect =
  // people
  | { op: 'birth'; person: PersonSeed; parents: PersonId[] }
  | { op: 'death'; person: PersonId; cause: string }
  | { op: 'arrive'; person: PersonId | PersonSeed; from: PlaceId }
  | { op: 'depart'; person: PersonId; to: PlaceId; intent: 'visit' | 'move' | 'exile' | 'war' }
  | { op: 'move_home'; person: PersonId; to: PlaceId }
  | { op: 'promote'; person: PersonId; to: 'full' }
  | { op: 'materialize'; cohort: CohortId; person: PersonSeed }
  | { op: 'set_fact'; target: EntityRef; key: string; value: string }  // flavor canon
  // ties and feelings
  | { op: 'add_tie'; tie: TieSeed }
  | { op: 'end_tie'; tie: TieRef; reason: string }
  | { op: 'add_reason'; reason: ReasonSeed }
  | { op: 'drop_reason'; from: EntityRef; reasonOf: EventId }
  // inner life
  | { op: 'add_trait'; person: PersonId; trait: ContentId }
  | { op: 'remove_trait'; person: PersonId; trait: ContentId }
  | { op: 'shift_drive'; person: PersonId; drive: ContentId; by: number }
  | { op: 'add_goal'; goal: GoalSeed }
  | { op: 'resolve_goal'; goal: GoalId; status: 'achieved' | 'failed' | 'abandoned' }
  // knowledge
  | { op: 'add_claim'; claim: Claim }
  | { op: 'learn'; belief: BeliefSeed }                 // includes witnessing
  | { op: 'revise_belief'; belief: BeliefId; confidence: number }
  | { op: 'create_secret'; secret: SecretSeed }
  | { op: 'secret_status'; secret: SecretId; status: SecretStatus }
  | { op: 'start_rumor'; rumor: RumorSeed }
  | { op: 'spread_rumor'; rumor: RumorId; from: PersonId; to: PersonId; distortion?: ClaimId }
  // orgs
  | { op: 'found_org'; org: OrgSeed }
  | { op: 'dissolve_org'; org: OrgId }
  | { op: 'join_org'; org: OrgId; person: PersonId; role: string }
  | { op: 'leave_org'; org: OrgId; person: PersonId; why: 'quit' | 'expelled' | 'died' | 'succeeded' }
  | { op: 'set_role'; org: OrgId; person: PersonId; role: string }
  | { op: 'org_relation'; a: OrgId; b: OrgId; kind: string | null }
  // places and economy
  | { op: 'build'; place: PlaceSeed }
  | { op: 'alter_place'; place: PlaceId; change: 'damaged' | 'destroyed' | 'rebuilt' | 'repurposed'; fn?: ContentId }
  | { op: 'transfer'; asset: AssetRef; from: EntityRef | null; to: EntityRef | null }
  | { op: 'wealth'; who: EntityRef; by: number; why: string }
  | { op: 'indicator'; place: PlaceId; key: IndicatorKey; by: number }
  | { op: 'set_livelihood'; person: PersonId; livelihood: LivelihoodRef | null }
```

**Derived state.** `WorldState` is what replaying the log gives you. It's
never edited directly.

```ts
interface WorldState {
  asOf: { seq: number; at: Instant }
  people: Map<PersonId, Person>
  cohorts: Map<CohortId, Cohort>
  ties: TieIndex                // by person, by kind, by org
  feelings: FeelingIndex        // (from, to) → axis → reasons
  claims: Map<ClaimId, Claim>
  beliefs: Map<BeliefId, Belief>
  secrets: Map<SecretId, Secret>
  rumors: Map<RumorId, Rumor>
  goals: Map<GoalId, Goal>
  orgs: Map<OrgId, Org>
  places: Map<PlaceId, Place>
  indicators: Map<PlaceId, Record<IndicatorKey, number>>
}

interface SnapshotRef { seq: number; at: Instant; key: string }  // storage key
```

**Point-in-time queries** ("who was guildmaster in year 30?") replay up to
the last event with `at ≤ t` from the nearest snapshot. Backdated events make
"nearest snapshot" mean the nearest one taken *after* the backdated event's
`seq`. Snapshots taken before a backfill are invalidated.

---

## 3. People

*Decisions: layered personality; three levels of detail.*

```ts
interface Person {
  id: PersonId
  tier: 'full' | 'sketched'    // aggregate people are Cohorts (§3.3)
  name: PersonName
  species: ContentId
  sex: string                  // from species data; drives fertility only
  gender: string               // identity; drives pronouns and prose
  pronouns: { subject: string; object: string; possessive: string }
  attractedTo: string[]        // genders; empty = not interested
  bornAt: Instant
  diedAt?: Instant
  birthPlace: PlaceId
  home: PlaceId | null         // a building (dwelling) or an elsewhere node
  whereabouts: PlaceId         // home settlement, or an elsewhere node while away
  temperament: Temperament
  traits: TraitHold[]
  livelihood: LivelihoodRef | null
  wealth: number               // personal purse, separate from household
  facts: Record<string, Fact>  // flavor canon: a limp, a lullaby, a scar
  // full-tier only (absent on sketched)
  inner?: InnerLife
}

interface PersonName {
  given: string
  family?: string
  epithet?: string             // earned by events: "the Unlucky"
  style: ContentId             // naming style used to make it
}

// Fixed at birth, partly inherited (mean of parents ± noise, tilted by
// species bias). 0..100. Axes are engine-defined so templates can rely on them.
interface Temperament {
  boldness: number      // timid ↔ daring
  warmth: number        // cold ↔ warm
  discipline: number    // impulsive ↔ steady
  curiosity: number     // conventional ↔ curious
  volatility: number    // even ↔ quick to anger or tears
}

interface TraitHold {
  trait: ContentId
  origin: 'innate' | { kind: 'acquired'; event: EventId }   // traceable
  since: Instant
}

interface InnerLife {
  drives: DriveHold[]          // 2–4 per person
  goals: GoalId[]              // current, open goals
  // beliefs, memories and secrets are indexed in WorldState, keyed by holder
}

interface DriveHold {
  drive: ContentId             // "drive:belonging", "drive:status", "fear:abandonment"
  strength: number             // 0..100; shifts slowly via shift_drive
}

interface Goal {
  id: GoalId
  holder: PersonId
  kind: ContentId              // "goal:win-heart", "goal:avenge", "goal:own-shop"
  targets: Record<string, EntityRef>
  arose: Cause[]               // the drive and event(s) that produced it
  openedAt: Instant
  status: 'open' | 'achieved' | 'failed' | 'abandoned'
  closedBy?: EventId
  visibility: 'creator' | 'hidden'   // creator-visible by default
}
```

### 3.1 Tiers

| Tier | Has | Lacks |
|---|---|---|
| **full** | Everything above, plus beliefs, memories, secrets, reasoned feelings, goals | — |
| **sketched** | Name, species, ages, home, livelihood, temperament, a few traits, ties | `inner`, beliefs, feelings toward anyone (ties still exist) |
| **aggregate** | A count inside a `Cohort` | Individual identity until materialized |

Promotion (`promote` effect) only adds. When a sketched person becomes
full, their drives, goals and feelings are generated *consistent with* their
existing ties and traits, then backfilled as gap-filling events (§11). Phase 1:
everyone is full.

### 3.2 Who gets promoted

A promotion is triggered when someone is inspected, gets bonded (tie or
feeling) to a full person, takes a leadership role, becomes a secret keeper,
or is in the watched area during live mode. This is the rule, not a setting.

### 3.3 Cohorts

```ts
interface Cohort {
  id: CohortId
  place: PlaceId               // usually an elsewhere node or an unwatched district
  species: ContentId
  // Counts by age band and livelihood; enough to answer "how many" questions.
  counts: { ageBand: [number, number]; livelihood: ContentId | null; n: number }[]
  materialized: PersonId[]     // individuals already drawn out; never redrawn
}
```

Materializing person *k* from a cohort uses `rng(worldSeed, cohortId, k)`, so
the same person appears no matter when or why they are first looked at.

---

## 4. Ties

*Decision: ties are structural facts created by events.*

```ts
interface Tie {
  id: string                   // `${kind}:${a}:${b}:${startedBy}`
  kind: ContentId              // "tie:parent-of", "tie:married", "tie:apprentice-of", "tie:owes"
  a: EntityRef                 // direction matters for asymmetric kinds
  b: EntityRef
  startedBy: EventId
  startedAt: Instant
  endedBy?: EventId
  endedAt?: Instant
  endReason?: string           // "widowed", "divorced", "repaid", "broken"
  data?: Record<string, number | string>   // e.g. owes: { amount: 40 }
  secret?: SecretId            // a tie can itself be a hidden fact
}

interface TieKindDef {
  id: ContentId
  symmetric: boolean
  between: ['person' | 'org', 'person' | 'org']
  kinship?: boolean            // walked for family queries; must stay acyclic
  exclusive?: number           // max concurrent per person (married: 1 in most packs)
  endsOnDeath: boolean
  // Inherited reasons: starting a married tie, for example, seeds affection.
  onStart?: ReasonSeed[]
}

type TieRef = { id: string }
```

Family is ties (`parent-of`), not a separate tree, so step-parents, adoption
and fosterage are just more tie kinds. Grandparent, cousin and sibling are
derived by walking kinship ties.

---

## 5. Feelings

*Decision: directional feelings on data-defined axes, each a sum of reasons.*

```ts
interface FeelingAxisDef {
  id: ContentId                // core: affection, respect, trust, attraction, fear
  range: [number, number]      // -100..100 for most; fear and attraction 0..100
  gatedBy?: keyof ToneSettings['allow']   // attraction is gated by romance
}

interface Reason {
  from: EntityRef              // the one who feels (a person; orgs don't feel)
  to: EntityRef                // a person or an org
  axis: ContentId
  amount: number               // signed contribution at full strength
  event: EventId               // what caused it
  restsOn?: BeliefId           // the belief it depends on (§6)
  decay: Decay
  note: string                 // short, specific: "took the blame for the fire"
}

type Decay =
  | { kind: 'never' }
  | { kind: 'halfLife'; years: number }
  | { kind: 'until'; event: ContentId }   // until something resolves it

// A feeling's value at time t = Σ amount × decayFactor(t) over live reasons,
// clamped to the axis range. Reasons whose `restsOn` belief has collapsed
// (confidence < 20, or replaced by a contradicting belief) count as zero, and
// a 'reconsidered' event is emitted so the shift appears in the chronicle.
```

### Labels are derived

A label rule maps ties, feelings and history to a word. The old prototype's
relationship phrases become label rules.

```ts
interface LabelRule {
  id: ContentId
  label: string                // "rivals", "secret admirer", "were expected to be married"
  when: Condition[]            // §10 vocabulary, with roles 'a' and 'b'
  symmetric: boolean
  priority: number             // the highest matching label wins the edge name
  tone?: ToneTag[]             // "had an affair together" requires romance: adult
}
```

Example: `secret admirer` is `feeling_above(a→b, attraction, 60)`
∧ `belief_absent(b, claim: a attracted to b)` ∧ `no_tie(a, b, courting)`. Since
it's derived, it stops being true the moment the claim is learned.

---

## 6. Knowledge

*Decision: claims, beliefs, secrets and rumors. Proposed here: a memory is a
belief.*

```ts
interface Claim {
  id: ClaimId
  // A claim is a Condition from the vocabulary, evaluated at a time. The same
  // machinery that gates templates decides whether a claim is true, so truth
  // is never a stored flag that can drift.
  about: Condition
  at?: Instant | [Instant, Instant]   // when it holds; omitted = now
  subject: EntityRef[]                // who it's about, for indexing
  gist: string                        // "Mara is Tobin's father"
  // Rumors distort claims; this links a distortion to its original.
  distortionOf?: ClaimId
}
// isTrue(claim, state) = evaluate(claim.about, stateAt(claim.at))

interface Belief {
  id: BeliefId
  holder: PersonId             // full tier only
  claim: ClaimId
  confidence: number           // 0..100
  source: BeliefSource
  learnedAt: Instant
  learnedBy: EventId
  // Present when this belief is a memory: first-hand, of an event.
  memory?: Memory
}

type BeliefSource =
  | { kind: 'witnessed' }
  | { kind: 'told'; by: PersonId; rumor?: RumorId }
  | { kind: 'deduced'; from: BeliefId[] }
  | { kind: 'deceived'; by: PersonId }   // told something false on purpose
  | { kind: 'common' }                   // public event; everyone present knows

interface Memory {
  event: EventId
  feeling: { axis: ContentId; toward: EntityRef; amount: number }[]
  salience: number             // 0..100; fades, but traumatic ones don't
  // Misremembering is a belief whose claim differs from what happened:
  // the claim says the event had a different cause or a different actor.
}

type SecretStatus = 'kept' | 'exposed' | 'lost' | 'moot'

interface Secret {
  id: SecretId
  claim: ClaimId               // must be true when created
  keepers: PersonId[]          // who actively hides it
  subject: EntityRef[]         // whom it would hurt or concern
  stakes: 0 | 1 | 2 | 3        // 3 = ruinous if exposed
  method: string               // "a forged deed", "never speaks of the war"
  createdBy: EventId
  status: SecretStatus         // lost = all keepers dead; moot = no longer matters
  // Who knows = holders of a belief in `claim` with confidence ≥ 50. Derived.
}

interface Rumor {
  id: RumorId
  claim: ClaimId               // may be true, false, or a distortion of a true one
  origin:
    | { kind: 'person'; id: PersonId; motive: string }
    | { kind: 'event'; id: EventId }
    | { kind: 'nudge' }
  startedAt: Instant
  spread: { from: PersonId; to: PersonId; at: Instant; claim: ClaimId }[]
  // Each hop can swap in a distorted claim, so the rumor is a tree, not a fact.
  heat: number                 // 0..100; decays; drives further spreading
}
```

**How people learn.** An event's `visibility` decides who gets a belief:
*public* means everyone present in the settlement learns it with `common`;
*witnessed* means everyone listed under the template's `witnesses` roles gets
`witnessed`; *private* means only the roles do. Everything else spreads by
`spread_rumor` and `learn` effects from conversation templates.

**Why this matters for the NPC use case.** "What does she know?" is beliefs
by holder. "What is she hiding?" is secrets where she's a keeper. "Which of
those is true?" is `isTrue(claim)`, shown only in GM view.

---

## 7. Places

*Decision: hierarchy with travel edges and a coarse footprint.*

```ts
interface Place {
  id: PlaceId
  kind: ContentId              // "place:region", "place:settlement", "place:district",
                               // "place:tavern", "place:forge", "place:dwelling",
                               // "place:elsewhere"…
  name: string
  parent: PlaceId | null
  position: { x: number; y: number }   // map units inside the parent
  footprint?: { x: number; y: number; w: number; h: number }  // grid cells, buildings only
  function?: ContentId         // what the building is used for now; may differ from kind
  capacity?: number            // residents or workers
  owner?: EntityRef            // derived from the latest transfer
  state: 'standing' | 'damaged' | 'ruined'
  builtBy?: EventId
  facts: Record<string, Fact>
  // elsewhere only
  offmap?: { distance: Duration; danger: number; cohort?: CohortId }
}

interface TravelEdge {
  a: PlaceId
  b: PlaceId
  time: Duration
  mode: ContentId              // "road", "river", "sea", "portal"
}

interface PlaceKindDef {
  id: ContentId
  level: 'region' | 'settlement' | 'district' | 'building' | 'room' | 'elsewhere'
  functions: ContentId[]       // what it can serve as
  size: [number, number]       // footprint w, h
  capacity: number
  tech?: ContentId[]           // only at these tech levels
}
```

**Leaving and returning.** `depart` sets `whereabouts` to an elsewhere node.
While someone is away, nothing is simulated for them per tick. On return, an
*away stint* is resolved: elsewhere templates (war, trade, study, prison) pick
what happened, at the elsewhere's danger level, and are backfilled as events
dated across the absence. They return with traits, wealth, ties and secrets
from it. One rule makes this coherent: **an away stint may only add ties to
people who were also away** or who are cohort members of that elsewhere.

---

## 8. Organizations

*Decision: one generic org; kinds are data.*

```ts
interface Org {
  id: OrgId
  kind: ContentId              // "org:household", "org:smithy", "org:council",
                               // "org:thieves-guild", "org:noble-house"
  name: string
  foundedBy: EventId
  dissolvedBy?: EventId
  places: PlaceId[]            // seat, workshop, chapterhouse
  // Members are `member-of` ties carrying data.role; listed here for speed only.
  members: { person: PersonId; role: string; since: Instant }[]
  wealth: number
  assets: AssetRef[]
  facts: Record<string, Fact>
}

interface OrgKindDef {
  id: ContentId
  name: string
  roles: {
    id: string                 // "head", "journeyman", "apprentice"
    max?: number
    eligible: Condition[]      // age, trait, kinship, prior role
    authority: number          // ranks roles for succession and decisions
  }[]
  joining: 'birth' | 'marriage' | 'apply' | 'invite' | 'appointment' | 'oath' | 'election'
  leaving: ('quit' | 'expelled' | 'death')[]
  succession: 'eldest-child' | 'chosen-heir' | 'election' | 'seniority' | 'strongest' | 'appointment'
  layeredOnKinship?: boolean   // households, noble houses
  needs?: { place?: ContentId; minMembers?: number; indicator?: { key: IndicatorKey; min: number } }
  livelihoods?: ContentId[]    // jobs this org provides
  templates?: ContentId[]      // its own event templates
}
```

A household is an org with `layeredOnKinship` and `joining: 'birth' | 'marriage'`.
It shares a dwelling and a purse (`Org.wealth`). Government is the org whose
kind is `settings.government`. Org-to-org relations are ties between orgs, so
an alliance can be started, strained and broken by events like any other tie.
People feel toward orgs with ordinary reasons (`to: { kind: 'org' }`).

---

## 9. Economy

*Decision: livelihoods plus a coarse settlement economy.*

```ts
type LivelihoodRef =
  | { kind: 'org-role'; org: OrgId; role: string }
  | { kind: 'trade'; def: ContentId; place?: PlaceId }      // independent smith
  | { kind: 'land'; def: ContentId; place: PlaceId }
  | { kind: 'patronage'; patron: EntityRef }
  | { kind: 'service'; def: ContentId; employer: EntityRef }
  | { kind: 'crime'; def: ContentId }
  | { kind: 'charity'; from: EntityRef | null }

interface LivelihoodDef {
  id: ContentId                // "trade:blacksmith", "land:farmer", "crime:fence"
  name: string
  minAge: number
  needs?: { place?: ContentId; tie?: ContentId; trait?: ContentId }
  income: { base: number; indicator?: IndicatorKey; sensitivity: number }
  demand: { per: number; indicator?: IndicatorKey }   // one per N residents, scaled
  tech?: ContentId[]
  routine?: ContentId          // daily schedule (live mode)
  tone?: ToneTag[]
}

type IndicatorKey = 'harvest' | 'trade' | 'craftDemand' | 'prosperity'
// -100..100 each, per settlement. Pack flows and world templates move them.

type AssetRef =
  | { kind: 'place'; id: PlaceId }
  | { kind: 'land'; place: PlaceId; acres: number }
  | { kind: 'heirloom'; name: string; holder?: EntityRef }

interface FlowDef {
  id: ContentId                // "flow:tithe", "flow:rent", "flow:wages"
  from: Condition[]            // who pays
  to: 'government' | 'owner' | 'employer' | { org: ContentId }
  amount: { share?: number; flat?: number }
  every: 'season' | 'year'
}
```

Debts are `tie:owes` ties with `data.amount`, so a debt has feelings attached
and can be forgiven, inherited, or called in by a template.

**How many taverns can the town support** = population ÷ `demand.per`, scaled
by the indicator. When supply is below demand, an opening exists. That
opening is a requirement on "found a business" templates, so new businesses
come from people who want them, not from a quota.

---

## 10. Event templates and selection

*Decisions: templates are data over a fixed verb vocabulary; selection is
character-driven plus a storyteller.*

```ts
interface EventTemplate {
  id: ContentId
  name: string
  scope: 'person' | 'pair' | 'org' | 'settlement' | 'elsewhere' | 'world'
  mode: ('history' | 'live')[]
  // Roles are bound in order; later roles can refer to earlier ones.
  roles: {
    id: string                 // "instigator" is special: the chooser (§10.2)
    kind: 'person' | 'org' | 'place'
    where: Condition[]
    optional?: boolean
  }[]
  requires: Condition[]        // across roles, after binding
  weight: { base: number; modifiers: WeightModifier[] }
  cooldown?: { per: 'role' | 'world'; years: number }
  outcomes: {
    id: string
    weight: { base: number; modifiers: WeightModifier[] }
    effects: EffectTemplate[]
    followUps?: { template: ContentId; after: [Duration, Duration]; chance: number; bind: Record<string, string> }[]
  }[]
  visibility: 'public' | 'witnessed' | 'private'
  importance: 0 | 1 | 2 | 3
  tone: ToneTag[]
  gist: string                 // "{apprentice} walked out on {master}"
  // Declared by the validator from the conditions and effects; not hand-written.
  reads?: string[]
  writes?: string[]
}

interface WeightModifier {
  when: Condition
  multiply: number
}

// EffectTemplate is an Effect whose fields may be role refs ("$master"),
// ranges, or picks from content; binding resolves it to a concrete Effect.
type EffectTemplate = { op: Effect['op'] } & Record<string, unknown>
```

### 10.1 The condition vocabulary (read half)

Engine-defined. Templates, label rules, claims, org eligibility and flows all
use it. Adding one is a code change, written once.

```ts
type Condition =
  // logic
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  // person
  | { age_between: [Role, number, number] }            // in years
  | { life_stage: [Role, 'child' | 'adult' | 'elder'] }
  | { alive: Role }
  | { species: [Role, ContentId] }
  | { has_trait: [Role, ContentId] }
  | { temperament_above: [Role, keyof Temperament, number] }
  | { drive_above: [Role, ContentId, number] }
  | { has_goal: [Role, ContentId, Role?] }             // optional target
  | { livelihood: [Role, ContentId | 'none'] }
  | { lives_in: [Role, Role] }                         // person, place
  | { away: Role }
  | { wealth_above: [Role, number] }
  // ties
  | { has_tie: [Role, ContentId, Role?] }
  | { had_tie: [Role, ContentId, Role?] }              // ever, including ended
  | { kin_within: [Role, Role, number] }               // degrees of kinship
  // feelings
  | { feeling_above: [Role, Role, ContentId, number] }
  | { feeling_below: [Role, Role, ContentId, number] }
  | { has_reason_from: [Role, Role, ContentId] }       // a reason caused by template X
  // knowledge
  | { believes: [Role, ClaimPattern, number?] }        // min confidence
  | { keeps_secret: [Role, Role?] }                    // optionally about someone
  | { knows_secret_of: [Role, Role] }
  | { heard_rumor: [Role, Role?] }
  // history
  | { happened: [ContentId, Record<string, Role>?, number?] }   // within N years
  | { not_happened: [ContentId, Record<string, Role>?, number?] }
  // orgs, places, economy
  | { member_of: [Role, Role, string?] }               // optional role
  | { org_kind: [Role, ContentId] }
  | { place_kind: [Role, ContentId] }
  | { opening: [Role, ContentId] }                     // place supports another X
  | { indicator_below: [Role, IndicatorKey, number] }
  | { indicator_above: [Role, IndicatorKey, number] }
  // world
  | { season: string }
  | { tone_allows: ToneTag }
  | { chance: number }                                 // seeded

type Role = string            // "$master", "$apprentice"; "$self" in label rules
type ClaimPattern = { about: Condition }   // matches beliefs whose claim unifies
```

The write half is the `Effect` union in §2. Its template-facing names are the
verbs in the Decisions (`end_tie`, `add_reason`, `add_goal`,
`spread_knowledge` → `start_rumor`/`spread_rumor`/`learn`, `create_secret`).

### 10.2 Worked example: The Broken Apprenticeship

```ts
const brokenApprenticeship: EventTemplate = {
  id: 'evt:broken-apprenticeship',
  name: 'The Broken Apprenticeship',
  scope: 'pair',
  mode: ['history', 'live'],
  roles: [
    { id: 'instigator', kind: 'person',
      where: [{ age_between: ['$instigator', 14, 25] },
              { has_tie: ['$instigator', 'tie:apprentice-of'] }] },
    { id: 'master', kind: 'person',
      where: [{ has_tie: ['$instigator', 'tie:apprentice-of', '$master'] }] },
    { id: 'witness', kind: 'person', optional: true,
      where: [{ member_of: ['$witness', '$master_org'] }] },
  ],
  requires: [{ feeling_below: ['$instigator', '$master', 'respect', -30] }],
  weight: { base: 1, modifiers: [
    { when: { temperament_above: ['$instigator', 'boldness', 70] }, multiply: 2 },
    { when: { drive_above: ['$instigator', 'drive:independence', 60] }, multiply: 2 },
    { when: { has_goal: ['$instigator', 'goal:own-shop'] }, multiply: 3 },
    { when: { feeling_above: ['$master', '$instigator', 'affection', 40] }, multiply: 0.5 },
  ]},
  outcomes: [
    { id: 'storms-out', weight: { base: 3, modifiers: [] }, effects: [
        { op: 'end_tie', tie: 'tie:apprentice-of($instigator,$master)', reason: 'broken' },
        { op: 'add_reason', from: '$master', to: '$instigator', axis: 'respect',
          amount: -40, decay: { kind: 'halfLife', years: 10 }, note: 'walked out mid-commission' },
        { op: 'add_trait', person: '$instigator', trait: 'trait:oathbreaker' },
      ],
      followUps: [{ template: 'evt:rival-shop-opens', after: [1, 6], chance: 0.4,
                    bind: { founder: '$instigator', rival: '$master' } }] },
    { id: 'takes-the-secret', weight: { base: 1, modifiers: [
        { when: { keeps_secret: ['$master'] }, multiply: 4 } ] }, effects: [
        { op: 'end_tie', tie: 'tie:apprentice-of($instigator,$master)', reason: 'broken' },
        { op: 'learn', holder: '$instigator', claim: 'secret_of($master)', source: 'witnessed' },
        { op: 'add_goal', holder: '$instigator', kind: 'goal:leverage', targets: { over: '$master' } },
      ] },
  ],
  visibility: 'witnessed',
  importance: 2,
  tone: [],
  gist: '{instigator} walked out on {master}',
}
```

Its `causes` on firing: the respect reasons behind the `feeling_below`, the
goal behind any goal modifier that applied, and the secret if that outcome
fires. That is how "noise" is measured: count events whose causes point back
to an earlier event.

### 10.3 Selection

```ts
// Each history step (one season) or live tick:
// 1. For each full-tier person: bind instigator-scoped templates where they
//    are $instigator, keep those whose requires pass, score each = weight with
//    modifiers. Sample at most one per person per step (seeded), after the
//    storyteller multiplier.
// 2. World and settlement templates are scored once per step.
// 3. The storyteller multiplies each candidate (never zeroes, never forces).

interface StorytellerSettings {
  pace: 'gentle' | 'steady' | 'dramatic'
  bigBeatSpacing: [number, number]   // years between importance-3 events
  threadBias: number                  // 1 = neutral, 2–4 = strongly prefer open threads
  cruelty: number                     // 0..1, how often misfortune finds the content
}

interface StorytellerState {
  tension: number                     // 0..100; rises with importance, falls with time
  lastBigBeat: Instant
  // Open threads are derived each step: open goals, kept secrets with
  // stakes ≥ 2, unresolved strong negative feelings, hot rumors. A candidate
  // touching one gets × threadBias.
}
```

---

## 11. AI layer

*Decisions: canon first, then prose; the AI authors and improvises events on
a budget.*

```ts
// Every call returns this shape, validated before anything is accepted.
interface AiResult {
  call: string                 // id, stored on any events it produces
  purpose: 'world-pack' | 'improvise' | 'backfill' | 'portrait' | 'voice'
    | 'describe-character' | 'interpret-nudge'
  canon: CanonAddition[]
  prose?: { target: EntityRef | EventId; kind: RenderingKind; text: string }[]
  rejected?: { addition: CanonAddition; reason: string }[]   // filled by the validator
}

type CanonAddition =
  | { kind: 'flavor'; target: EntityRef; key: string; value: string }   // → set_fact
  | { kind: 'event'; event: Omit<WorldEvent, 'id' | 'seq' | 'recordedAt'> }  // backdated or now
  | { kind: 'template'; template: EventTemplate }                       // world pack, or one-off
  | { kind: 'content'; pack: Partial<ContentPack> }                     // new trait, org kind…

type RenderingKind = 'bio' | 'chronicle' | 'portrait' | 'thoughts' | 'dialogue'

interface Rendering {
  id: RenderingId
  target: EntityRef | { kind: 'event'; id: EventId }
  kind: RenderingKind
  text: string
  basedOn: number              // log seq it was written from
  dependsOn: EntityRef[]       // whose later events make it stale
  // stale = any event after basedOn whose roles or effects touch dependsOn
}

interface AiBudget {
  improvisations: { used: number; perYear: number; perWorld: number }
  renderings: { used: number; cap: number }
  // dollar figures are TBD with the cost decision (SKILL.md → Open decisions)
}
```

**Validation, in order.** (1) Schema: is it valid vocabulary? (2) Tone: are
all the tags allowed? (3) Reference: do the ids exist and are they alive at
the event's `at`? (4) Coherence: replay the event on a copy of state at its
`at`, then check the invariants (§12) on the copy and on every later event's
preconditions. Backdated events that break a later event are rejected.
(5) Gap rule: a backdated event may add ties, beliefs, secrets, traits and
facts. It may not end a tie, kill someone, or move someone if a later event
assumes otherwise.

---

## 12. Invariants

The headless harness checks these after every step. Each is a function of
`WorldState` plus the log.

- **Time:** every event's roles were alive and born at `at`, except the
  `death` subject at the moment of death and `birth` children.
  Nobody exceeds `species.maxAge`.
- **Kinship:** `parent-of` ties are acyclic. Biological parents were fertile
  and of compatible species at conception. A person has ≤ 2 biological parents.
- **Exclusivity:** concurrent ties never exceed `TieKindDef.exclusive`.
- **Orgs:** every role holder meets `eligible` at the time they took the
  role (the 12-year-old guildmaster check). `max` is respected.
- **Places:** residents ≤ capacity × slack. Nobody lives in a ruin.
- **Knowledge:** a secret's claim was true when created. Keepers believe it.
  A `lost` secret has no living keepers.
- **Feelings:** every reason's event exists and preceded or equals the
  reason's start. Every `restsOn` belief exists and belongs to `from`.
- **Tone:** no event, template, label, fact or rendering carries a tag the
  world's tone forbids.
- **Tiers:** sketched people have no `inner`, beliefs or reasons-from.
  Cohort counts minus materialized ≥ 0.
- **Causality:** every non-genesis event has ≥ 1 cause, or comes from a
  template marked `scope: 'world'`. Reported as a ratio, not a hard failure.

---

## 13. Derived views and queries (phase 1)

Every reference question is one of these, answered from state:

```ts
interface Queries {
  personAt(id: PersonId, t?: Instant): Person
  lifeStory(id: PersonId): WorldEvent[]          // events with them in a role
  edges(id: PersonId, t?: Instant): { to: EntityRef; ties: Tie[]; feelings: Record<ContentId, number>; label?: string }[]
  why(from: EntityRef, to: EntityRef, axis: ContentId): Reason[]   // "why does she hate him?"
  whoWorksAt(place: PlaceId, t?: Instant): PersonId[]
  count(placeKind: ContentId, within: PlaceId, t?: Instant): number   // "how many taverns"
  roleHolder(org: OrgId, role: string, t: Instant): PersonId | null   // guildmaster in year 30
  npcSheet(id: PersonId, gm: boolean): {
    secretsKept: Secret[]
    secretsKnown: Secret[]      // via beliefs
    rumorsHeard: { rumor: Rumor; believed: number; true?: boolean }[]   // true only if gm
    goals: Goal[]
  }
  chronicle(filter: { from?: Instant; to?: Instant; minImportance?: number; about?: EntityRef }): WorldEvent[]
  threads(t?: Instant): { kind: string; ref: string; openedBy: EventId; events: EventId[] }[]
}
```

The graph view is `edges` for everyone. The map is `places` with positions
and footprints.

---

## 14. Choices made in this model (all approved 2026-10-12)

Decided in conversation: everything that §§0–13 says it implements. These
were added in the draft and approved by Nick as written:

1. **A memory is a belief** (§6). Misremembering and believing a false rumor
   are one mechanism. *Consequence:* simpler model and consistent
   behavior; a memory can't carry more than one claim, so a rich memory is
   several beliefs about the same event.
2. **Effects, not templates, are replayed** (§2). *Consequence:* the
   log is bigger, but editing or deleting a template never changes the past,
   and AI events replay free. The alternative (replay templates and RNG) has
   a smaller log, but any content change rewrites history.
3. **Claims are conditions** (§6). Truth is computed with the same vocabulary
   templates use, never stored. *Consequence:* only things the vocabulary can
   express can be secret or rumored. "She killed the old miller" works.
   "She is secretly sad" needs a fact or a trait to point at.
4. **Time is integer minutes on one clock** (§0). *Consequence:* history and
   live mode share it with no conversion, and the calendar can be anything a
   pack defines.
5. **Five fixed temperament axes** (§3), unlike feeling axes, which are data.
   *Consequence:* templates can rely on them across all packs. A world can't
   add its own temperament axis, but it can add traits and drives.
6. **One tone dial plus hard switches** (§1). *Consequence:* the creator
   picks one word ("storybook", "grim") and can tighten individual switches,
   but can't loosen them past what the dial allows. A kid-safe world can't
   have adult romance even if a creator asks.
7. **Away stints are resolved on return, not simulated while away** (§7).
   *Consequence:* cheap, and stays coherent through the only-other-travelers
   rule. You can't check in on someone mid-war; they're simply "away at the
   war" until they come back.
8. **Gender, sex and attraction are separate fields** (§3). Sex comes from
   species data and only affects fertility. *Consequence:* same-sex couples,
   adoption and nonbinary people are first-class, and species with unusual
   reproduction are pure data.
9. **One instigated event per person per season** (§10.3). *Consequence:*
   200 people × 400 seasons caps 100 years at ~80k events. Most are minor
   (importance 0–1), and the chronicle shows importance ≥ 2 by default. If
   stories feel thin, raise the cap rather than loosening templates.

---
name: population-sim
description: Working on the fantasy population simulator — a living, configurable world of generated people (Sims / Tomodachi Life feel) that creators generate, watch, nudge, and use as a worldbuilding reference. Load before designing or changing its domain model, world generation, history or live simulation, events, relationships, AI character writing, nudges, or its graph/map views, and before proposing scope for any phase. Covers the agreed outcomes, the three failures that matter most, the design rules that follow from them, the phase plan, and the decisions still open.
---

# Population Sim — Skill Document

## Status

**Design stage. No code yet.** Outcomes are agreed and the domain model is
decided at the concept level (both 2026-10-12, see Decisions). The concrete
types are in `references/domain-model.md`, approved 2026-10-12. Next: settle
the architecture questions under Open decisions (where it runs, storage, AI
cost budget, live tick), then implement phase 1.

Working name only — the product name, route and directory are not decided.
When they are, update this file's paths and description.

Keep this file current. When a decision in "Open decisions" is made, move it to
"Decisions" with the date and the reason. A future session should be able to
pick up from this file alone.

## What it is

A living fantasy population simulation on CometCave. A creator configures a
world, it generates settlers and runs history forward, and then the world keeps
living while they watch. They explore people and their connections, ask it
reference questions, write new characters into it, and nudge it — and the world
decides what comes of the nudge.

The richer, deeper and more complex, the better. Heavy LLM use is fine.

## Who it's for

Any CometCave creator, not just Nick. Shared multi-user worlds may come later —
don't build them, but don't make them impossible (no single-owner assumptions
baked into world state). Worlds can persist for months or be thrown away.

Because it is a CometCave product, the UX principles in `CLAUDE.md` apply:

- **Anonymous-first.** Generating and exploring a world must work with no
  account. An account buys persistence and depth, not access.
- **AI is invisible.** Heavy LLM use in the pipeline is fine and expected; the
  player-facing framing still sells the world, not the model. No "AI-generated
  townsfolk" as the hook.
- **Plain language in the chrome, game voice inside.** World UI chrome is plain;
  the voice of the world and its people can be whatever the world's tone is.
- **Cost per world matters.** Many creators means LLM calls are multiplied.
  Prefer generating text on demand (when someone is looked at or spoken to) over
  pre-writing everyone, and cache what's written as canon.

## The outcomes

What a creator does with it:

1. **Explore and be entertained** — browse people, follow connections, find
   unexpected stories and imagine more.
2. **Use it as a reference** — "Who works at the blacksmith? How many taverns
   are there?" must have concrete, correct answers. Includes pulling a
   character out as a tabletop NPC: the secrets they keep, the secrets and
   rumors they know, and (GM view) which of those are true.
3. **Write characters in** — describe who someone is and how they arrived (or
   why they have no history); AI fills the rest. The creator confirms or picks
   where they live, influences or picks their relationships, and how they make
   a living. They may arrive with preexisting relationships; the world reacts
   to them over time.
4. **Nudge** — plant an introduction, a rumor, a festival, a bad harvest. The
   creator is a **nudger**: not an observer, not a director, not possessing
   anyone. The surprise has to be real, so outcomes belong to the simulation.

How the world behaves:

- **Living, with a speed control.** Time runs while you watch.
- **People leave and come back.** There is a world beyond the settlement;
  people go, things happen to them off-screen, and they may return changed.
- **Configurable at generation:** tech level, government, economy, fantasy
  species, **tone** (from a dark hellish landscape to a fun world for kids, and
  everything between), **size** (hamlet → town → city → region), and more.
  Every dimension is a setting, not a hardcoded assumption.
- **Depth per person — all of these:** history (a life story), inner life
  (personality, desires, fears, secrets, ambitions), opinions of specific
  others, a social web (family, friends, guilds, factions, debts), daily life
  (routine, job, home, what they're doing now), and voice (you can talk to them
  or read their thoughts).

Presentation:

- **Headless engine first**, minimal text UI on top.
- **Early views:** a node graph of the population and a map. These are not
  decoration — they require relationships to be explicit edges and locations to
  be real places, not tags.
- Animated people and generated art are later, not phase 1.

## The three failures that matter

Nick named these as the biggest letdowns. Judge every design and every change
against them. Repetitiveness and AI over-writing matter less (still avoid them).

| Failure | What it looks like | The rule it implies |
|---|---|---|
| **Incoherent** | Contradictions; a 12-year-old guildmaster; a dead man at the wedding | The simulation owns facts; AI writes prose |
| **Flat** | "Bob married Alice." Statistics without texture | Every relationship and event carries a specific reason and feeling |
| **Noise** | Lots happens, nothing connects | Events have causes and leave consequences later events read |

## Design rules

These follow from the outcomes and hold under the approved domain model. If a
later decision changes one, update it here.

1. **The simulation owns the facts; the LLM writes the prose.** Ages, dates,
   births, deaths, jobs, homes, family links and relationship state live in
   deterministic, seeded state. The LLM reads that state and writes from it; it
   never silently invents a fact. Anything it does invent (a secret, a backstory
   detail, a grudge) is validated against state and written back as canon, so
   it is never contradicted later.
2. **Events have causes and leave memories.** Every event records why it
   happened (the state that made it eligible, the prior events it follows from)
   and what it changed. Later events select on that history — "a rival of the
   deceased", "the disinherited child" — so causal chains form. Unconditioned
   random events are the failure mode of the original prototype; avoid them.
3. **Relationships have texture.** A relationship is not just a type; it holds
   a history of shared events and each side's own view of the other (they can
   disagree).
4. **Content is data.** Species, traits, professions, institutions, events,
   naming styles and tone rules are data packs, not code. This is what makes
   worlds customizable and lets the LLM extend a world at runtime. No
   per-species or per-world branching in engine code.
5. **One model, two speeds.** A coarse history mode (years/seasons) runs the
   settler seed forward through generations; a fine live mode (hours/days)
   runs daily life. Both read and write the same people, relationships,
   organizations and memories.
6. **Level of detail.** Size goes up to regions, so not everyone can be fully
   simulated. People who matter right now (being looked at, leaders, connected
   to drama) get full simulation; others are simulated coarsely but exist and
   stay consistent. Promotion to full detail must not contradict what the
   coarse layer already decided.
7. **Tone is a hard limit, not a vibe.** Tone gates which events, relationships
   and descriptions can occur, and it constrains every LLM prompt. A kid-safe
   world must stay kid-safe, including generated text and anything a creator
   types in.
8. **Nudges create conditions, not outcomes.** A nudge changes state (two
   people meet, a rumor exists, a harvest fails); the event system decides what
   follows. A nudge that guarantees its own result is a director feature, which
   is out of scope.
9. **Everything is answerable.** Reference questions ("how many taverns")
   are answered from state, not from LLM recall. If the state can't answer it,
   the model is missing something.

## Phase plan

**Phase 1 — the story mine.** Generate a ~200-person town with ~100 years of
history from a settler seed. Explore it in a minimal text UI for an hour and
find several stories worth writing down. Success is judged by that hour, not by
feature count. Needs: world config, settler generation, history-mode
simulation with causal events, the chronicle, person/relationship/place
inspection, and AI-written texture on demand.

Later phases, roughly in order (not committed): live mode with speed control;
nudges; writing in new characters; leaving and returning; talking to people;
population graph and map views; persistence and accounts; other sizes; shared
worlds.

Phase 1 must be built on the full domain model so later phases extend it rather
than rewrite it.

## How to verify (once there is code)

Like Micro Land, the real test is headless. Expect a harness that generates
worlds from fixed seeds and checks:

- **Coherence:** invariants hold (ages consistent with dates, no posthumous
  events, kinship acyclic, jobs fit age and tech level, tone limits never
  breached).
- **Population health:** the town neither dies out nor explodes over 100 years.
- **Connectedness:** what share of events reference earlier events; how long
  the causal chains are. This measures the "noise" failure directly.
- **Variety:** how often the same event shapes repeat across families. This
  measures repetitiveness.

Unit tests that pass while these drift are not evidence the world is good.

## Decisions

- **2026-10-12 — Outcomes agreed** (the sections above), via a one-question-
  at-a-time interview with Nick.
- **2026-10-12 — Prior prototype is reference only.**
  `../fantasy-population-generator` is ~500 lines of Python 2 on Mongo from a
  single commit; the seed-to-history loop was never built. Worth carrying over:
  the settler-seed idea, the race data shape (`lifespan`, `can_mate_with`) in
  `json-data/fantasy_races.json`, the relationship phrases in
  `json-data/relationship-statuses.json` (good story seeds), and a 9,257-name
  list in `json-data/names.json`. The code itself is not worth porting.

- **2026-10-12 — The event log is the source of truth (event sourcing).**
  Events are the only thing written; current state is derived by replaying
  them, with cached snapshots for speed. Chosen because it makes every fact
  traceable to the event that caused it (coherence, and "why is this true?"),
  gives point-in-time queries for free ("who was guildmaster in year 30?"), and
  leaves branching and shared worlds open. Cost accepted: every state change
  needs an event type, and long-lived worlds need snapshots.

- **2026-10-12 — Bonds are ties plus feelings made of reasons.** *Ties* are
  structural facts created by events (parent of, married to, works for, sworn
  to, owes). *Feelings* are directional (A→B and B→A are separate), on a small
  set of axes; each axis value is the sum of *reasons*, and each reason points to
  the event that caused it and has its own decay (some never fade). *Labels*
  ("rival", "secret admirer", "were expected to be married") are derived from
  ties + feelings + history, never stored as the truth. Chosen because reasons
  are what defeat flatness: inspection can show why someone feels what they
  feel, the LLM writes from real causes, and events can select on reasons,
  which builds causal chains. Default axes: affection, respect, trust,
  attraction, fear — defined as data so a world can change them.
- **2026-10-12 — Knowledge: beliefs, with secrets and rumors as entities.**
  A hybrid of "secrets with knowers" and "beliefs that can be false".
  *Claim*: a statement about the world, true (backed by events) or false.
  *Belief*: a person's hold on a claim — confidence, source, when learned.
  *Secret*: a true claim someone actively conceals — keepers, subject, stakes,
  how it's hidden; who knows is derived from beliefs; it can be exposed, die
  with its keepers, or stop mattering. *Rumor*: a claim in circulation — origin
  (person, event, or creator nudge), spread path, distortion; can be true,
  false or partly true. Feelings' reasons rest on beliefs, not on events
  directly, so a revealed truth re-evaluates them. Learning, hearing and being
  deceived are events. Chosen for dramatic irony, meaningful rumor nudges, and
  the NPC use case ("what does this character know?" is one query).
- **2026-10-12 — Personality is layered.** *Temperament*: a few numeric
  axes, fixed from birth with some inheritance, tilting everyday choices.
  *Traits*: tags from content packs, innate or acquired from events
  ("widowed young", "oathbreaker"), each acquired trait traceable to its
  cause. *Drives*: fundamental wants and fears, slow to change. *Goals*:
  concrete current aims that arise from drives and events and themselves cause
  events. Chosen for richness; goals are the main defence against noise because
  a long-lived goal threads many events into one story. Goals default to
  visible to the creator (reference and NPC use); a hide option is a later UI
  choice.
- **2026-10-12 — AI-written canon: canon first, then prose.** Each LLM call
  returns structured canon additions plus prose. *Flavor* additions (a limp, a
  lullaby) attach to entities as facts. *Consequential* additions (a secret
  child, an old debt) become backdated events in the log; the engine rejects
  any that conflict with existing history. Backdating may only fill gaps, never
  rewrite what already happened. Prose is written only from state plus accepted
  additions, stored as a rendering of a specific state, and flagged for
  regeneration when later events make it stale. Chosen so the LLM can be
  inventive while everything it invents becomes buildable canon and the engine
  stays the authority on truth.
- **2026-10-12 — Three levels of detail.** *Full*: the whole model (beliefs,
  secrets, goals, reasoned feelings, memories). *Sketched*: a real individual
  with name, ties, job, home, temperament, a few traits; coarse life events,
  no beliefs or detailed feelings. *Aggregate*: counts and distributions, not
  individuals; materialized on inspection, deterministically from the world
  seed, with backstory backfilled under the gap-filling rule. Promotion happens
  when someone matters (inspected, bonded to a full person, leader, secret
  keeper, in the watched area) and never contradicts what the lower tier
  decided — it only adds. Phase 1 keeps all ~200 people at full detail, but the
  tiers exist in the model from day one. Accepted consequence: in large worlds,
  unwatched individuals are generated when first looked at, then permanent.
- **2026-10-12 — Places are a hierarchy with a coarse footprint.** Region ›
  settlement › district › building (› optional rooms), each node positioned for
  a map, with travel edges and times. Buildings are entities with event-sourced
  history (built, owned, inherited, burned, rebuilt) and a function and
  capacity; reference questions query them. Buildings carry a footprint on a
  coarse grid so a tile layer can sit under them later without changing the
  model. *Elsewhere* is the same graph: named off-map places (the capital, the
  war, the sea) with distance and travel time, simulated at the aggregate tier,
  so leavers go somewhere real and return with consequences.
- **2026-10-12 — One generic organization, kinds defined as data.** An org
  kind (in a content pack) defines roles and eligibility, how members join and
  leave, succession, resources and places, and its own event templates. Orgs
  relate to each other (alliance, rivalry, branch-of, sworn-to). People hold
  reasoned feelings toward orgs, same model as toward people. Government is an
  org whose kind comes from the world's government setting; a household is an
  org of co-residents sharing a home and budget; a noble house or dynasty is an
  org layered on kinship ties. Chosen because it keeps worlds customizable
  (thieves' guilds, covens, merchant republics without code) and lets the LLM
  define new org kinds.
- **2026-10-12 — Event templates are data over a fixed verb vocabulary.**
  A template declares roles (with eligibility), requirements, weight
  modifiers, weighted outcomes, effects and follow-ups. Conditions and effects
  may only use engine-defined verbs (`has_tie`, `feeling_below`, `has_trait`,
  `age_between`, `end_tie`, `add_reason`, `add_goal`, `spread_knowledge`,
  `create_secret`, …); a new need means a new verb, written once. Chosen so
  packs, creators and the LLM can all author templates, LLM templates can be
  schema- and tone-validated, and each template declares what it reads and
  writes — causal links come for free and the harness can find templates that
  never fire or never connect.
- **2026-10-12 — Selection is character-driven with a storyteller.** Full-tier
  people score templates where they'd be the instigator by goals, drives,
  temperament and feelings; world templates (plague, harvest, war) cover the
  rest. A storyteller reweights for pacing: tracks tension and spaces big
  beats, and **prefers continuing open threads** (unresolved secrets, active
  goals, grudges) over fresh unconnected events. Storyteller has its own
  settings, chosen with tone. It only reweights — never forces an outcome.
  Thread continuation is the main anti-noise mechanism.
- **2026-10-12 — The LLM authors and improvises events, on a budget.** A
  hand-written core library covers universal life. At world creation the LLM
  writes a world-specific template pack from the settings, validated against
  the vocabulary and tone limits. During the run it may propose one-off events
  at high-salience moments (storyteller wants a twist, a thread stalls, no
  template fits), validated and competing like any other; the same path turns
  creator descriptions and nudges into vocabulary. Improvisation is rationed
  per world (budget TBD with the cost decision). Everything the LLM produces is
  written to the event log, so replay never calls the LLM again.
- **2026-10-12 — Economy is livelihoods plus a coarse settlement economy.**
  *Livelihoods* (org role, trade, land, patronage, service, crime, charity)
  are defined as data from the economy and tech settings. *Wealth and assets*
  are tracked for people, households and orgs; property, land and buildings
  are owned; **debts are ties**, so they carry feelings. A few
  *settlement indicators* (harvest, trade, craft demand, prosperity) move with
  world events and the economy setting and drive incomes, openings and how many
  businesses the town supports. *Flows* (taxes, tithes, rent, wages) are data.
  No goods-level market. Chosen because it yields the economy's stories (ruin,
  fortune, debt, inheritance, emigration), keeps business counts believable,
  and stays tunable.
- **2026-10-12 — Domain model types approved.** `references/domain-model.md`
  is the blueprint. Nick approved all nine choices in its §14 as written:
  a memory is a belief; the log replays resolved effects, not templates;
  claims are vocabulary conditions, so truth is computed, never stored; one
  integer-minute clock for history and live mode; five fixed temperament axes
  (feeling axes stay data); tone is one dial plus switches that can only be
  tightened; away stints are resolved on return, not simulated while away;
  sex, gender and attraction are separate fields; at most one instigated
  event per person per season.

## Open decisions

- Product name, route and directory.
- Where the simulation runs (client, server, or both) and how a long-lived world
  is stored as its history grows.
- Which LLM calls happen at generation versus on demand, and the cost budget
  per world.
- The tick model for live mode and how history mode hands off to it.

## Working with Nick on this

Nick wants to discuss and decide before implementing: approaches, then
outcomes, then the domain model, then code. Don't skip ahead to code. When
eliciting requirements he liked being interviewed one question at a time. When
offering design choices, use plain language but make each option a real
decision with a stated consequence.

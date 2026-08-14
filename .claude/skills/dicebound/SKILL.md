---
name: dicebound
description: Working on Dicebound (src/app/dicebound) — the storytelling dice game at /dicebound where an AI dungeon master runs a campaign and code rolls the dice. Load before changing its turn loop, DM prompt, dice resolution, character sheet, world graph, clock, inventory, powers, campaign storage or Firestore records, and before picking up any issue under the phase 2 epic #3516. Covers the one rule the whole game rests on — the model narrates, code owns the numbers — plus the invariants that keep the dice honest, the issue workflow, and the hazards that make a change look fine and quietly let the DM cheat.
---

# Dicebound — Skill Document

## What this covers

Dicebound is a storytelling game at `/dicebound`. The player writes one line
about who they are and one line about where their story begins; a dungeon master
model puts them in a scene; they say what they attempt; the dice decide whether
it works. Everything lives under `src/app/dicebound`, plus three API routes
(`src/app/api/v1/dicebound/{character,turn,campaign}`) and two server modules
(`src/lib/dicebound/{anthropic,campaign-store}.ts`).

- `references/architecture.md` — file map, the turn loop, data flow, what each
  domain module owns.
- `references/workflow.md` — where the issue tree stands, how lanes are drawn by
  file ownership, and why PRs are never stacked.
- `docs/dicebound-design.md` — phase 1's load-bearing decisions.
- `docs/dicebound-phase-2.md` — the phase 2 spec. Every open issue points here.

## Whose game this is

Product direction is Nick's. When a change is a design decision rather than a
repair, offer real options back rather than picking one — plain language, but
each option has to change what actually gets built and say what the consequence
is.

Three things are still explicitly undecided and should not be quietly settled by
a PR:

- **The name.** "Dicebound" is a placeholder, now committed to a route, a
  lint-checked constant and two Firestore collections. Renaming is cheap today
  and a data migration later.
- **The tier/level table** for powers. Tier 2 at level 4 is a starting guess and
  it sets how long a campaign takes to feel powerful.
- **How the player gets an item.** Granting is currently its own `grant_item`
  tool rather than a field on `narrate`, on the reasoning that a field gets
  filled in passing while a tool has to be reached for. That was decided in a PR
  rather than by Nick, is flagged as such, and is one edit to reverse.

## The game in one paragraph

Eight attributes, chosen once from a sentence a model reads. Forty skills
beneath them, none of which exist on a new sheet — they are earned by being
called on, at 3, 8 and 18 uses, and they advance on _use_, not on success. Each
turn the player writes what they attempt; the DM decides whether it is uncertain,
and if it is, names the attribute, the skill, a DC from a fixed table, and
whatever in the scene helps or hurts. Then it stops, and code rolls a d20. Six
outcome bands key off the margin, with natural 20 and natural 1 beating the
arithmetic in both directions. The campaign is its transcript, condensed into a
synopsis once it outgrows a prompt. Phase 2 adds a world graph indexed over that
transcript — places, actors, things and threads, joined by a flat edge list — an
in-fiction clock that stops when it runs into a thread's fuse, and a kit of
items, powers and species that all compile down to three primitives.

## Invariants

1. **The model narrates; code owns every number.** This is the whole
   architecture. `roll_check` exists so the DM commits to a DC _before_ it learns
   the die, and then narrates around a fact it cannot edit. A model asked to set
   a difficulty and roll against it in the same breath will let the player win —
   not out of malice, out of helpfulness. Any change that lets the model see or
   choose an outcome before committing to its difficulty is wrong even if it
   works. The same split governs everything phase 2 adds: the model may say _that
   the rope applies_, never _what the rope is worth_.

2. **Narration written before a fact it depends on is discarded, never kept.**
   This started as one rule about dice and turned out to be three. A `narrate`
   sent in the same message as a `roll_check` was written before the die existed.
   A `narrate` sent alongside a `recall` was written before the lookup answered.
   And on a turn that runs into a fuse, the model has already described the whole
   span the player asked for — one live run read "dawn finds you still moving, by
   the second afternoon" and then stopped the clock forty-five minutes in, which
   would have given the player two days of walking followed by an ambush that
   happened before breakfast. In every case the model could not have known, so it
   does not get to describe it. Discard and ask again. Expect this rule to apply
   to the next fact the model cannot see in advance, too.

3. **The turn loop must terminate.** `playTurn` runs at most `MAX_CHECKS` passes
   and the final pass withdraws the tool (phase 1) or forces `narrate` (phase 2).
   A turn that never stops rolling is a turn that never comes back. There is also
   a fallback narration for the case where even the forced call returns nothing —
   the player is owed a turn either way.

4. **`applicableSkill` is not optional.** A skill only adds its rank when it
   actually sits beneath the attribute being tested. Engineering must not help
   you jump a fence, however the DM labelled it. Mismatches are dropped, not
   rejected — the check still happens, it just runs on the attribute alone.

5. **The DM cannot grant progression.** Ranks come from `RANK_THRESHOLDS`, level
   from `levelFor(totalRanks(...))`, power charges from `TIER_CHARGES`. All in
   code, all the same for everyone. A generous model handing out +3s in the first
   ten minutes ends the game by the second session.

6. **The clamps are load-bearing, and they scale rather than truncate.** ±4 per
   situational modifier, ±6 across the set, and a separate +3 ceiling on kit and
   relationships. Three plausible +3s are how a DC 18 silently becomes a coin
   flip without anyone deciding it should. `clampSituational` scales the set so
   every reason the player was _shown_ still appears on the die card.

7. **Negative ranks are legal and must survive every round-trip.** An innate Size
   of −2 is subtracted from every Size check. This has now been broken twice: once
   by four `rank > 0` filters, and once by `Math.max(0, …)` in `validateCharacter`,
   which repealed the first fix on the first save. Both produced the same
   symptom — the character is described as very small, the sheet says −2, and the
   die quietly disagrees with both. Filter on `!== 0`, clamp to `±MAX_SKILL_RANK`.

8. **Validators never throw, and never refuse more than they must.**
   `validateCampaign` reads a hostile wire: wrong types, missing keys, a
   transcript of a hundred thousand entries. It repairs what it can and refuses
   only a campaign missing something genuinely load-bearing. `validateWorld` never
   refuses at all — an unreadable world is an empty world, and reconciliation
   rebuilds it from the transcript. Losing the index must never cost the player
   the story.

9. **Version bumps migrate, they do not refuse.** `SUPPORTED_VERSIONS` is the
   list of readable versions; a v1 campaign is read as valid with an empty world
   and a zeroed clock. The old behaviour — refuse on any mismatch — would have
   deleted every campaign in existence the moment the constant moved.

10. **The world graph is an index of the transcript, not a replacement for it.**
    The fiction stays authoritative. The DM does not maintain a simulation; it
    touches the two or three things that mattered this turn, and `condense`
    repairs the rest. If a change requires the DM to emit a full world state every
    turn, it is the wrong change.

11. **`Edge.since` is stamped by the server, never read from the model.** It is
    what makes "an edge must predate this turn to grant a bonus" enforceable.
    Without it the DM could invent `owes(guard → you)` and cash it in the same
    breath, which is situational modifiers with extra steps.

12. **`Power.source` is required, and provenance is checked.** A power must come
    from an entity the world already knows about. `validatePower` drops a power
    with no source rather than repairing it with a placeholder — the whole point
    is that "nothing" fails a lookup.

13. **A power never resolves an outcome, it only makes one available.** Fireball
    does not kill the guard; it turns "you cannot hurt him from here" into a Power
    check that can still miss. This is the only reason abilities can be added
    without touching `dice.ts`.

14. **The clock stops at a fuse.** `advance` never steps over an open thread's
    due time. The player says "we travel for a week", and four hours in the thing
    they have been ignoring catches up. Time cannot be used to outrun
    consequences, and "it comes to find you" falls out of the model rather than
    needing to be prompted for.

15. **Domain code is pure.** No `Math.random()`, no `Date.now()`, no `new Date()`
    in `src/app/dicebound/domain/`. Pass them in — that is why `withVisit` takes
    `today` and `yesterday`, and why `advance` takes minutes rather than reading a
    clock. It is also an ESLint error in this repo.

16. **Anonymous-first (CLAUDE.md #1).** `useAuth` mints an anonymous uid on
    arrival. Play never blocks on an account, and never blocks on a model call:
    character creation falls back to a playable character rather than an error,
    and a safety refusal returns an in-voice narration rather than a policy
    notice. Being told "the cave could not imagine you" and dumped at an empty
    field is worse than a slightly generic hero.

17. **Nothing renders until it exists.** No empty inventory grid, no zeroed quest
    log, no greyed-out spell slots. A new character must not be able to tell that
    five of these systems are there. The world panel on the sheet returns null
    section by section for this reason, and a component test guards it — it is a
    rule with no other protection and exactly the kind a later change breaks
    without anyone noticing.

18. **Most items are +0.** A rope is a permission, not a bonus — it turns "you
    cannot climb that" into a DC 15. A +0 trait is still _named on the die card_,
    because the reason is real even when the number is nothing. If every item
    carried a +1 a well-packed character would stop rolling, and the die is the
    game. `QUALITY_BANDS` buys rarity mostly in extra traits rather than a bigger
    number, for the same reason.

19. **What the model is told about a number changes how it narrates.** A DM
    handed a sword and told nothing calls it mighty; told the sword is plain and
    worth nothing on the die, it describes a sword. So every tool result that
    assigns a value says what the value is — `grant_item` reports the worth back,
    `roll_check` reports the band and its move. Writing the number without
    reporting it produces prose that quietly disagrees with the sheet.

## Verifying a change

```
npm run typecheck                               # see the note below
npx vitest run src/app/dicebound
npx eslint src/app/dicebound src/lib/dicebound
npm run lint:routes
npx prettier --write <files you touched>
```

**`npm run typecheck` has ~11 pre-existing errors** in `micro-land` and
`scripts/`. They are not yours and must not be fixed here — but do not let them
hide a new one:

```
npx tsc --noEmit 2>&1 | grep dicebound      # must be empty
```

**Repo-wide `npm run lint` fails for unrelated reasons.** Scope it to the
dicebound paths.

**A green test suite does not mean the DM behaves.** Anything touching the prompt,
the tool schemas or the turn loop needs at least one real turn against the API:
`npm run dev`, open `/dicebound`, create a character, and play until you have seen
a check resolve. Look at the die card — the modifiers on it are the contract
between the fiction and the arithmetic, and a bug there is invisible in prose.

## Known hazards

- **A damaged measurement looks exactly like a result.** A harness run reported a
  check rate of 17%, in the expected direction, from a change that had just
  targeted it — and it nearly got the change softened. That run had lost 8 of its
  20 turns to `anthropic 529` overloads, and the survivors were not a
  representative sample; the rerun read 50%. `npm run voice:dicebound` prints a
  `turns that failed` row for exactly this, and it prints even at zero. Read it
  before you read anything else in the table, and rerun rather than reasoning
  about a run that lost turns.

- **Two numbers in that table are not independent.** A turn with no check gets
  the shorter word budget, so anything that lowers the check rate lowers the
  median narration length as a side effect. Reporting both as if they were two
  wins is double-counting one change.

- **The DM invents a second id for something it already named.** Live runs have
  produced `iron-spike` and `sconce-spike` for one spike, and this is the normal
  case rather than a slip. The world graph survives it because `condense`
  reconciles entities from the transcript; the **kit has no equivalent**, so a
  pack accumulates duplicates. Anything new that the model gets to name needs an
  answer to this before it ships.

- **A tool can fail silently behind good prose.** The first `recall` searched for
  `cassa,` with the comma attached, found nothing, and told the DM to invent
  someone the story already contained. The narration read perfectly, because the
  player had supplied the details in their own message. Instrument the call and
  look at what it returned; do not infer that a tool worked from output that
  reads correctly.

- **Persistence fails silently by design.** Every error in `accountBackend` is
  swallowed, so a missing rules/index deploy, an expired token or a dropped
  connection looks exactly like a working game that quietly stops saving. After
  touching storage, confirm the write landed in Firestore rather than trusting the
  absence of an error. `firestore.rules` and the `dicebound.blob` /
  `diceboundChapters.blob` index exemptions need deploying with
  `firebase deploy --only firestore:rules,firestore:indexes`.

- **An unexempted blob field breaks writes, it does not merely slow them.**
  Firestore caps a single index entry around 7.5 KiB. Campaign and chapter blobs
  are far larger, so a new blob-bearing collection without a `"indexes": []`
  field override in `firestore.indexes.json` fails on write with
  `INVALID_ARGUMENT`. That is what those two entries are for.

- **`src/app/api/v1/dicebound/turn/route.ts` is the contention point.** Seven of
  the eleven open phase 2 issues touch it. Do not run those in parallel — see
  `references/workflow.md` for the lane split.

- **The Anthropic API is called directly on purpose.** The AI SDK's
  `generateObject` hard-codes `temperature: 0`, which Opus 5 rejects outright, so
  moving this back to the SDK can only work by downgrading the model.
  `toolSchema` also strips the `$schema` key that `zodSchema` emits, because
  Anthropic rejects it on `input_schema`.

- **Adding a field to `Campaign` breaks every constructor.** That is what
  `newCampaign` is for. `world`, `kit` and `chapters` each broke two call sites
  the moment they landed; use the factory rather than an object literal.

- **Entity ids come from a model and are used as object keys and edge
  endpoints.** Always `slug()` them. An entity whose id normalises to nothing is
  dropped, not given a generated id — an entity nobody can name is an entity no
  edge can point at.

- **`condense` is the only lossy operation in the game**, which is why phase 2
  has it archive what it drops to `diceboundChapters` instead of destroying it.
  It is also where reconciliation runs, because it is the one moment the game can
  already afford a slow call. A failure there must stay survivable: the turn
  proceeds on the previous synopsis and reads as a slightly forgetful DM.

- **`MAX_CHECKS` is a design number, not a safety valve.** Three is enough for
  "you leap the gap, catch the ledge, and haul yourself up" to be three real
  rolls. Raising it lets one player action swallow a whole scene and robs the
  player of the decisions in between.

## House style

Prettier: no semicolons, single quotes, 2-space, 100 cols, `arrowParens: avoid`.
ESLint enforces grouped + alphabetized imports and `@/…` aliases over `../…` —
parent-relative imports are an error, including in tests.

Comments in this codebase explain _why_, at length, and are load-bearing
documentation — several are the only record of a bug that took a day to find.
Match that register. Test names are prose that states the rule being protected
("advances on use, not on success — failing still teaches"), not
`it('works correctly')`.

Commit messages follow the same standard: `feat(dicebound): <lowercase phrase>`
with a body that explains the reasoning, not the diff.

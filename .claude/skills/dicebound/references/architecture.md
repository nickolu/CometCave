# Dicebound — architecture

## File map

```
src/app/dicebound/
  page.tsx              route entry
  DiceboundGame.tsx     assembly; no threshold screen, shell stays visible
  store.ts              zustand; the only place turns are sequenced
  api.ts                the two model calls the client makes
  backend.ts            localBackend / nullBackend / accountBackend behind one interface
  domain/               pure, tested, no I/O and no clock
    attributes.ts       8 attributes, 40 skills, applicableSkill
    dice.ts             DC table, bands, clamps, resolveCheck  ← the trust boundary
    character.ts        ranks, thresholds, recordSkillUse, totalRanks
    campaign.ts         the save shape, validation, migration, Chapter
    turn.ts             applyTurn, creditSkills, tallyChecks
    validate.ts         shared coercion primitives for hostile input
    world.ts            entities, edges, clock, advance, fireThreads, pruneWorld   (phase 2)
    kit.ts              Trait / Item / Power / Species, levels, tiers, rest        (phase 2)
  components/           creation, transcript, die-card, composer, sheet, share, sign-in-invite

src/app/api/v1/dicebound/
  character/            sentence → character sheet (falls back rather than failing)
  turn/                 the DM loop, where the dice are rolled
  campaign/             GET / PUT / DELETE, own-uid only

src/lib/dicebound/
  anthropic.ts          the one place this game talks to the model
  campaign-store.ts     Firestore: the live campaign and the chapter archive
```

## The turn loop

`POST /api/v1/dicebound/turn` is the heart of the game and the reason the route
is a loop rather than a single call.

```
player action
      │
      ▼
load campaign for the caller's uid   ← the body is a sentence, not a save file
      │
      ▼
build prompt ── sheet + world window + premise + synopsis + recent transcript
      │
      ▼
┌─► call model with [roll_check, recall, grant_item, narrate]   pass 0 … MAX_CHECKS-1
│         │
│         ├── narrate ──► apply world delta, save, turn ends
│         │                 └─ unless a fuse fired: discard that narration and
│         │                    give the DM a hard move to make (once per turn)
│         │
│         ├── roll_check ──► rollFor(): attribute rank, applicableSkill rank,
│         │                  kitModifiers (capped separately), clamped situational,
│         │                  resolveCheck() rolls the d20
│         │
│         ├── recall ──► findEntities(): searches dormant entities too
│         │
│         └── grant_item ──► itemFromGrant(): code prices it, and the reply
│                            tells the DM what it turned out to be worth
│                                  │
└──────────────── tool_result ◄────┘

final pass: only narrate is offered, and it is forced — the model must finish
```

The model commits to the DC before it learns the number. That is the entire
design. `resolveCheck` lives in `domain/dice.ts`, is pure, and is tested
exhaustively.

`rollFor` builds the modifier list in a fixed order — attribute, then the
applicable skill if its rank is non-zero, then situational — and every entry
appears on the die card as a labelled chip. The die card is the contract between
the fiction and the arithmetic; if a bonus is applied and not shown, that is a
bug even when the number is right.

## Data flow

**Today (phase 1):** the client holds the campaign and POSTs the whole thing on
every turn. `validateCampaign` treats that body as hostile and clamps what it
can. Saves are fire-and-forget after each turn; the backend swallows its own
failures, so a save that does not land costs nothing — the next turn sends the
whole campaign again.

**After #3530:** the client sends a token and an action. The server loads,
resolves, saves, and returns the new entries. This is not an optimisation — once
items and powers exist, validation cannot tell an earned power from a fabricated
one, because an inventory has no legal range the way an attribute does.

## Storage

```
users/{uid}/dicebound/campaign        the live game, one JSON string + readable scalars
users/{uid}/diceboundChapters/{n}     transcript condense archived, write-once
```

A campaign is read whole and written whole and never queried, so it is a blob.
As nested maps Firestore would index every paragraph of narration on every write.
Both `blob` fields are exempted in `firestore.indexes.json`; without the
exemption, writes fail outright once a blob exceeds the ~7.5 KiB index-entry cap.

The scalars beside each blob (title, character name, turns, streak, level, class,
species, story day, entity count, bytes) exist so anything that needs to ask a
question about players does not have to parse every story to answer it. Anything
a future home page or share card needs must become a scalar here.

## Memory, and the one lossy thing

A campaign is its transcript. Past `CONDENSE_AT` (60) entries the oldest are
compressed into `synopsis` and dropped, leaving `TRANSCRIPT_WINDOW` (40) behind.

`condense` is asked for _continuity_ rather than summary — names, debts,
promises, wounds, how things stand — because those are what a player notices
going missing, and a synopsis that reads like a plot outline loses exactly them.

Phase 2 gives `condense` two more jobs, because it is already the one moment the
game pays for a slow call: it archives what it drops to `diceboundChapters`, and
it reconciles the world graph (rebuild missed entities, mark stale ones dormant,
prune to caps, drop dangling edges, retire cold threads). That reconciliation is
also the v1 → v2 migration in practice — a campaign that predates the graph gets
one built from the transcript it already has.

## The world graph (phase 2)

Four entity kinds — `place`, `actor`, `thing`, `thread` — in a `Record` keyed by
id, plus a flat `Edge[]`. The player is an entity (`PLAYER_ID = 'you'`) so that
every relationship is uniform.

Edges rather than fields on entities because the connections are many-to-many,
they change constantly, and the fiction keeps inventing kinds of connection a
field-per-relationship schema cannot absorb without a migration each time.

Caps (`MAX_ENTITIES` 200, `MAX_EDGES` 400) are not tidiness — they are why a
campaign four hundred turns deep still writes. `pruneWorld` drops by `lastSeen`,
scored so the player and open threads outrank mere recency, then drops any edge
whose endpoints did not survive.

Only a relevance window reaches the prompt (~20 entities, ~30 edges): where you
are, what it connects to, actors present or recently named, open threads.
Everything else is dormant and retrievable via `recall`.

## The clock (phase 2)

`Clock` is `{ elapsed, startHour }` in minutes, rendered as a phrase — "Day 6,
late afternoon" — never as a wall-clock time.

`advance(clock, minutes, world)` clamps to `MAX_TURN_MINUTES` and **stops at the
first open thread's due time it would cross**, returning the fired ids.
`fireThreads` then escalates pressure and re-arms; after `MAX_FIRINGS` unengaged
firings the thread goes cold — dormant, no more fuses, revivable later.

`isRest` decides charge refresh from the clock rather than the model's word: six
hours elapsed, the turn flagged safe, and no urgent threat open. The third
condition is the one the model cannot wave away.

## The kit (phase 2)

Three primitives, and everything else is a package of them with a name on it:

- **Trait** — always-on, conditional, ±1 or ±2
- **Item** — a carried thing holding 0–2 traits; _most items are +0_, because a
  rope is a permission, not a bonus
- **Power** — costs a charge, and either `permits` something or grants
  `advantage` (2d20 keep highest)

Species, classes and spells all compile to these, so the resolver never learns
they exist. Level is `1 + floor(totalRanks / 3)`, capped at 10 — un-grantable by
construction, because ranks are earned on use.

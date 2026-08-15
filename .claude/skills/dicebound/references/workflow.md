# Working through the phase 2 issues

The tree is [#3516](https://github.com/nickolu/CometCave/issues/3516) — one
parent, six sprint epics. `docs/dicebound-phase-2.md` is the spec every issue
points at.

## Where the tree stands

All eleven original child issues are merged, and four of the six sprint epics are
closed: #3517 (GM moves and a word budget), #3518 (a sheet that isn't blank),
#3519 (the world model, the clock, server-authoritative campaigns) and #3520
(threads, fuses and loose ends).

Two remain. Neither had child issues written for it at first, deliberately —
their shape depended on what the graph looked like once real campaigns had run
through it. That gate has now cleared: the graph populates from play, reconciles
from prose, and survives a campaign deep enough to condense.

- **#3521 inventory, species and traits.** Six child issues written (#3552–#3557),
  and `f6c4df21` landed a chunk of the middle of them before they were written —
  `grant_item` is a real tool, `kitModifiers` reaches the die, and items survive
  the round-trip. What has _not_ landed is the decision those issues exist to
  encode: `QUALITY_BANDS` is still keyed on a band **the model names**, and
  `Provenance` does not exist. #3552 is the correction and it is still the entry
  point. Species at creation (#3555) is untouched.

  This bullet has now been wrong in both directions — it once claimed granting
  had landed when it had not, and then claimed nothing was wired a day after it
  was. The lesson is not a better status line, it is that there is no such thing:
  **grep the code for the symbol before you plan around it.** `git log --oneline
-S <symbol>` answers in one command what this file can only ever guess at.

- **#3522 powers, classes and levels.** Nine child issues (#3558–#3566), in
  progress. Both gates have cleared. The tier table is settled — kept as
  `{ 1: 2, 2: 4, 3: 7 }`, with #3566 measuring whether tier 3 is reachable at all
  before anyone moves it. #3558 came first and had to: seeded starting ranks
  counted toward level, so `levelFor` returned 2 for a character who had not
  rolled a die, which made tier 1 grantable on turn 1 and fired class discovery
  on an empty histogram. `earnedRanks` is now the only thing `levelFor` should
  ever be fed. #3559 followed in the kit lane — advantage exists in the resolver
  and on the die card, with **nothing able to trigger it** until `use_power`.

Both of the problems that measurement found rather than reading — turns timing
out around turn 14, and the DM calling for a roll on turns nobody would call
uncertain — are fixed and closed. There are no open dicebound bugs as of August
2026: everything open is the two epics and their fifteen children. Run
`gh issue list --search dicebound` anyway before assuming a bug is new, and note
that both of those were found by running the harness rather than by reading the
code.

## Picking one up

```
gh issue view <n>                 # the issue
gh issue view <its epic>          # the rules and the ordering
```

Then read `docs/dicebound-phase-2.md` and `docs/dicebound-design.md`. Both are
short. Read the SKILL.md invariants too — most of them exist because something
plausible-looking broke the game once already.

Check the epic's sub-issue list for ordering. Several issues say "depends on X";
those are real, not advisory.

## Lanes — draw them by file, not by theme

`src/app/api/v1/dicebound/turn/route.ts` is where nearly all the subtle logic
lives, and nearly every server-side issue wants it. That file is the constraint,
so lanes are drawn around **who owns which files** rather than around what the
work is about.

| Lane        | Owns                                                    | Runs beside                                |
| ----------- | ------------------------------------------------------- | ------------------------------------------ |
| **UI**      | `components/*.tsx`, `DiceboundGame.tsx`                 | anything                                   |
| **Turn**    | `turn/route.ts`, `domain/turn.ts`                       | UI only — one issue at a time              |
| **Kit**     | `domain/kit.ts`, `domain/dice.ts`, `character/route.ts` | UI; contends with Turn when it adds a tool |
| **Harness** | `scripts/`, `lib/dicebound/`                            | anything                                   |

The sustainable shape of a batch is therefore **two issues, not four**: one from
the UI lane, one from whichever server lane is active.

### Both epics are live at once, so lanes now cross them

Fifteen children are open across #3521 and #3522, and the lane rule is about
**files, not epics** — an issue from the kit epic and an issue from the powers
epic that both want `turn/route.ts` collide exactly as hard as two from the same
epic. Every child issue states its own lane at the bottom; the contention that
exists today is:

| File                   | Wanted by                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `turn/route.ts`        | #3553, #3554, #3557, #3560, #3561, #3562, #3563 — **one at a time, across both epics** |
| `domain/kit.ts`        | #3553, #3554, #3557, #3560, #3564                                                      |
| `domain/dice.ts`       | #3559 (advantage), and #3553 reads its clamps                                          |
| `components/sheet.tsx` | #3556 (the pack), #3565 (powers, level, class)                                         |
| `domain/character.ts`  | #3558 — touches nothing else, which is why it is safe to run first and beside anything |
| `character/route.ts`   | #3555 (species) — uncontended, the easiest thing to put in a parallel slot             |
| `scripts/`             | #3566 — harness lane, runs beside anything                                             |

Two entry points, one per epic, and they are not interchangeable. **#3552** is
pure domain and blocks the granting issue. **#3558** must land before anything
else in the powers epic, because seeded starting ranks currently count toward
level — `levelFor` returns 2 for a character who has not rolled a die, which
makes tier 1 grantable on turn 1.

A good batch today is one turn-lane issue, one of #3552/#3555/#3558, and at most
one of the two sheet issues.

## Never stack PRs

Branch every issue off `main`. Not off the branch before it, however tempting the
dependency makes it look.

Four stacked PRs were once merged seven seconds apart, which is faster than
GitHub retargets a stacked PR's base after its base branch merges. All four
reported MERGED; three had gone into intermediate branches and only the first
reached `main`, so the game shipped without its narrate tool, its measurement
harness or its word budget until someone noticed. Recovering it meant
cherry-picking three commits and proving the result byte-identical to the
reviewed stack tip.

If two issues genuinely cannot be parallel, do them in sequence off `main` and
merge each before starting the next. Waiting is cheaper than that recovery.

## Doing the work

- **One issue, one PR.** Branch `feat/dicebound-<slug>`. Do not bundle, and do
  not opportunistically refactor `turn/route.ts` beyond what the issue names.
- **Domain first.** If a change has any logic in it, that logic belongs in
  `src/app/dicebound/domain/`, pure and tested, before it is wired into a route
  or a component. The domain modules are where this game is actually specified.
- **Write the test as a sentence about the rule.** `it('advances on use, not on
success — failing still teaches')`, not `it('works')`. Several existing tests
  are the only record of why a number is what it is.
- **If the issue contradicts the design doc, say so.** Do not silently pick one.
  An issue that fights an invariant is a bug in the issue.

## Verifying

```
npm run typecheck && npx tsc --noEmit 2>&1 | grep dicebound   # second must be empty
npx vitest run src/app/dicebound
npx eslint src/app/dicebound src/lib/dicebound
npm run lint:routes
npx prettier --write <files you touched>
```

`npm run typecheck` has ~11 pre-existing errors in micro-land and `scripts/`.
Not yours, do not fix them, do not let them hide a new one. Repo-wide
`npm run lint` fails for unrelated reasons — scope it.

**Anything touching the prompt, a tool schema or the turn loop also needs a real
turn.** `npm run dev`, play until a check resolves, and read the die card. A DM
that has started fudging is invisible to the test suite.

For the voice epic specifically, `#3526` adds a script that measures narration
length over ~20 real turns. Run it before and after and paste both tables — "it
feels shorter" is not a measurement, and brevity is the entire claim.

## Opening the PR

```
gh pr create --title 'feat(dicebound): <lowercase phrase>' --body "$(cat <<'EOF'
Closes #<n>.

<why this change, not what the diff does>

## Verification
<paste the actual command output, including anything that failed>
EOF
)"
```

Report honestly. If a check failed, say so with the output. If something in the
issue was left undone, say which part and why — scaling the work down is Nick's
call, not the agent's.

## Deploying Firestore config

There is no CI for this. After touching `firestore.rules` or
`firestore.indexes.json`:

```
firebase deploy --only firestore:rules,firestore:indexes
```

Two cautions. `--only firestore:indexes` offers to **delete** any index present
in the console but absent from the file — read the prompt, do not auto-confirm.
And because `accountBackend` swallows every persistence error, a missing deploy
looks exactly like a working game that has quietly stopped saving: confirm the
write landed in Firestore rather than trusting the absence of an error.

## The two remaining sprints

[#3521](https://github.com/nickolu/CometCave/issues/3521) was exploded with Nick
in August 2026, once the graph had run through real campaigns and its shape was
knowable. Six children, #3552–#3557, ordered and lane-tagged in the epic body.
Two decisions were settled at the same time and are recorded there: granting is
its own `grant_item` tool rather than a field on `narrate`, and **code rolls an
item's quality band** — the model names the thing and where it came from, and
never proposes a band, because a DM that wants the player to have a good sword
says "legendary".

[#3522](https://github.com/nickolu/CometCave/issues/3522) was exploded with Nick
in August 2026, in the same week. Nine children, #3558–#3566, ordered and
lane-tagged in the epic body. Three decisions were settled at the same time and
are recorded there: **level counts only ranks earned in play** (seeded starting
skills stop counting, which is #3558 and comes first); the **tier table stays at
`{ 1: 2, 2: 4, 3: 7 }` and gets measured** rather than adjusted on feel, because
nobody yet knows whether level 7 is reachable in a campaign anyone finishes; and
**class abilities at even levels are cut** — a class is not an entity, so a
class-granted power has no source that survives a provenance lookup, and the two
paths in stay granted and emerged.

The two epics overlap in exactly one file. #3556 (the pack on the sheet) and
#3565 (powers, level and class on the sheet) both edit `components/sheet.tsx`.
Land one before starting the other.

#3520 closed without ever needing children: two of its three scope items arrived
as a side effect of the world epic, and the third was a UI job. Check whether an
epic is already built before writing issues for it.

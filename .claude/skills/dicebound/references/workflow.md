# Working through the phase 2 issues

The tree is [#3516](https://github.com/nickolu/CometCave/issues/3516) — one
parent, six sprint epics. `docs/dicebound-phase-2.md` is the spec every issue
points at.

## Where the tree stands

All eleven original child issues are merged, and four of the six sprint epics are
closed: #3517 (GM moves and a word budget), #3518 (a sheet that isn't blank),
#3519 (the world model, the clock, server-authoritative campaigns) and #3520
(threads, fuses and loose ends).

Two remain, and neither had child issues written for it, deliberately — their
shape depended on what the graph looked like once real campaigns had run through
it. That gate has now cleared: the graph populates from play, reconciles from
prose, and survives a campaign deep enough to condense.

- **#3521 inventory, species and traits.** Item granting and the kit ceiling have
  landed. Species at creation and the inventory UI have not.
- **#3522 powers, classes and levels.** Not started. Blocked on the tier/level
  table, which is Nick's to settle.

Two problems found by measurement rather than by reading are still open, and
neither is fixed by anything above: run `gh issue list --search dicebound` before
assuming a bug is new.

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

[#3521](https://github.com/nickolu/CometCave/issues/3521) and
[#3522](https://github.com/nickolu/CometCave/issues/3522) still have **no child
issues**, and the original reason has expired — the graph has now run through
real campaigns, so their shape is knowable.

What has not expired is who writes them. Do not invent children for either
without Nick, and #3522 in particular cannot start until the tier/level table is
settled, because that number decides how long a campaign takes to feel powerful.

#3520 closed without ever needing children: two of its three scope items arrived
as a side effect of the world epic, and the third was a UI job. Check whether an
epic is already built before writing issues for it.

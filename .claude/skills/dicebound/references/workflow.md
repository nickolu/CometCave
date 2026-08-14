# Working through the phase 2 issues

The tree is [#3516](https://github.com/nickolu/CometCave/issues/3516) — one
parent, six sprint epics, eleven child issues. `docs/dicebound-phase-2.md` is the
spec every issue points at.

## Before anything: is Dicebound on `main`?

```
git ls-tree -r HEAD --name-only | grep -c dicebound
```

If that returns `0`, **stop**. The whole game lived only in a working tree at the
time this skill was written, and every issue in the tree assumes code that is not
there. Landing it is issue
[#3529](https://github.com/nickolu/CometCave/issues/3529), and nothing else can
start until it does.

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

## Lanes — what may run in parallel

`src/app/api/v1/dicebound/turn/route.ts` is touched by seven of the eleven
issues. Running those concurrently spends the parallelism on merge conflicts in
the file where all the subtle logic lives.

| Lane | Issues | Rule |
| --- | --- | --- |
| **A** | #3523, #3524, #3525, #3530, #3531, #3532, #3533 | strictly serial, in that order |
| **B** | #3526 (voice harness), #3527 + #3528 (starting skills) | safe alongside lane A |

Lane B touches `scripts/`, `character/route.ts` and `sheet.tsx` only.

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

## Sprints 4–6

[#3520](https://github.com/nickolu/CometCave/issues/3520),
[#3521](https://github.com/nickolu/CometCave/issues/3521) and
[#3522](https://github.com/nickolu/CometCave/issues/3522) deliberately have **no
child issues yet**. Their shape depends on what the world graph is like once real
campaigns have run through it, and writing fifteen detailed issues against a
schema that has never run produces fifteen issues that need rewriting. Do not
start them. Do not invent children for them without Nick.

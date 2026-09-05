# Comet Cards: 70 failing tests

**Status:** open, pre-existing on `main`. Not caused by PR #4001 — that PR left the count
unchanged (it fixed one of them as a side effect of correcting an assertion).

## The facts

```
npx vitest run src/app/comet-cards
Tests  70 failed | 741 passed (811)
```

Stable across runs. 70 failures across 31 files, **all one root cause**.

Every failing file matches the same shape:

```ts
const game: GameState = structuredClone(defaultGameState)
game.jokers = [initializeJoker(jokers.egg, game)]
const started = reduceGame(game, { type: 'GAME_START' })   // ← wipes game.jokers

const afterRound = reduceGame(started, { type: 'ROUND_END' })
expect(afterRound.jokers.find(j => j.jokerId === 'egg')?.bonusSellValue).toBe(3)
//     ^ undefined: there is no Egg. There are no jokers at all.
```

Verified mechanically: all 70 failures are in files containing both `.jokers =` and
`{ type: 'GAME_START' }`. No failure falls outside that shape.

The symptoms vary (`expected undefined to be 3`, `expected +0 to be 4`,
`Cannot read properties of undefined`) but they are all the same thing: the joker under
test no longer exists by the time the assertion runs.

## Why

`e42b9b83` — *"fix: reset game state on restart so player returns to blind selection (#1642)"* —
made `GAME_START` reset the whole run:

```ts
// src/app/comet-cards/domain/game/reduce-game.ts
case 'GAME_START': {
  const freshState = createGameStateWithDeck(draft.selectedDeck)
  Object.assign(draft, structuredClone(freshState))
  handleGameStart(draft, event)
  return
}
```

That is correct product behaviour — restarting should not keep your old jokers. The tests
were written against the older `GAME_START`, which only moved `gamePhase` to
`blindSelection` and left state alone. They used it as "begin a run", and it now means
"throw the run away and begin a new one".

## The bigger question this exposes

**All 12 joker `GAME_START` effects are unreachable in production.** They are written as:

```ts
{
  event: { type: 'GAME_START' },
  apply: ctx => {
    if (ctx.game.jokers.some(j => j.jokerId === 'stuntmanJoker')) {
      ctx.game.handSizeModifier -= 2
    }
  },
}
```

The guard can never be true. `createGameStateWithDeck` always produces `jokers: []`, and
`DeckModifiers` has no `startingJokers` field, so no deck can seed one. Every one of these
handlers is dead code, duplicating what the joker's `JOKER_ADDED` effect already does.

Affected: `fourFingersJoker`, `turtleBeanJoker`, `toTheMoonJoker`, `rocketJoker`,
`weeJokerJoker`, `stuntmanJoker`, `spareTrousersJoker`, `merryAndyJoker`, `flashCardJoker`,
`drunkardJoker`, `jugglerJoker`, `pareidolia`.

So this is not purely a test problem. Decide the code question first, then the tests follow.

## Two directions

**A. The tests are stale; the code is right.** Stop using `GAME_START` as run setup. Add a
shared helper — something like `startedRunWithJokers(['egg'])` that runs `GAME_START`
*first* and attaches jokers to the resulting state — and rewrite the 31 files against it.
Then delete the 12 dead `GAME_START` joker effects, since nothing reaches them.

Mechanical, ~31 files, no product change. This is the likely answer.

**B. `GAME_START` should not wipe jokers.** Only plausible if jokers are ever meant to
survive a restart or be granted at run start (a future deck with a starting joker, a
"keep your build" mode). Nothing in the code wants that today. If you pick this, #1642's
actual bug comes back and needs a different fix.

Recommendation: **A**. Confirm with the repo owner before touching 31 test files, since the
tests encode intent and rewriting them in bulk is exactly where a real regression can hide.

## Watch out for

- **Tests can encode the bug.** `oops-all-6s.test.ts` asserted `probabilityMultiplier` reached
  ×8 for two copies, with a comment explaining that each purchase re-triggers every held
  copy — it was documenting a bug as expected behaviour. PR #4001 corrected it to ×4. Assume
  others in this set may do the same. Read what each test *means* before making it green.
- **Green is not the goal.** Deleting the `GAME_START` assertions would clear the board and
  test nothing. Each rewritten test must still fail if its joker's effect is removed.
- Run from the repo root; `vitest run src/app/comet-cards` silently matches zero files from a
  subdirectory.

## Related

- PR #4001 — `JOKER_ADDED` was broadcast to every held joker; fixed, with the reasoning in
  the PR body. Same area of the code, different bug.

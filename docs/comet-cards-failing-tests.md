# Comet Cards: the 70 failing tests (resolved)

**Status:** fixed. `npx vitest run src/app/comet-cards` → 810 passing, 0 failing.

## What was wrong

31 test files installed a joker and *then* dispatched `GAME_START`:

```ts
game.jokers = [initializeJoker(jokers.egg, game)]
const started = reduceGame(game, { type: 'GAME_START' })   // ← wipes game.jokers
```

Since `e42b9b83` (#1642), `GAME_START` deals a fresh run and discards whatever state it
was handed — correct behaviour for a restart, but it means the tests asserted against a
run with no jokers in it. All 70 failures were that one thing.

## The decision: the tests were stale, the code was right

All 12 joker `GAME_START` effects were unreachable. `createGameStateWithDeck` always
returns `jokers: []`, `DeckModifiers` has no `startingJokers` field, and no deck defines
`effects`, so the guard `if (ctx.game.jokers.some(j => j.jokerId === 'x'))` could never be
true. Every one of the 12 had a `JOKER_ADDED` twin doing the same work — usually a better
version of it, since the `JOKER_ADDED` handlers claim their effect once per copy via
`metadata.onAddApplied` (see PR #4001) while the `GAME_START` ones did not.

So they were deleted. Nothing was lost: `startRunWithJokers` reproduces every value the
deleted handlers used to produce (Turtle Bean +5, Stuntman −2, To the Moon 105, Rocket
payout 1, Four Fingers 4, Wee Joker `chipsBonus: 0`, and the rest).

## What replaced them

- `dispatchJokerAdded(draft, joker)` in `domain/game/utils.ts` — the one place a joker's
  arrival is announced. Both shop paths (purchase, booster pack) now call it, instead of
  each assembling the same dispatch by hand.
- `domain/game/__tests__/helpers/start-run.ts` — `startRun`, `addJoker`,
  `startRunWithJokers`, `inGameplay`. A test now starts the run *first* and then acquires
  jokers through the same `JOKER_ADDED` path a purchase uses, which is the only order the
  real game can produce.

## Verifying the rewrite

Green was not the goal, so each of the 70 was checked by mutation: gut the joker under
test (`effects: []`), re-run its file, confirm the test fails. **All 70 fail under
mutation.** Two needed a control added to get there — "selling Invisible Joker before 2
rounds does not duplicate" and "To Do List earns no money on a non-target hand" both
passed happily against a joker that did nothing, so each now also asserts the positive
case from the same state.

Other tests in those files still survive mutation, by their nature and not by accident:

- Pure negative assertions that were already passing before this work ("adds 0 Mult when
  money is less than $5", "earns nothing if no 9s in deck", and similar). Their positive
  counterpart in the same file is the control, and that one dies.
- The three `JOKER_ADDED`-scope tests from PR #4001 (Flash Card, Spare Trousers, Wee
  Joker). They guard against a *re-run* effect, so removing the effect cannot fail them.
- Four Luchador tests that set `staticRules.bossBlindDisabled` directly and never hold the
  joker.

Two tests that had been passing vacuously — Ice Cream and Popcorn "self-destructs" — now
run against a real joker for the first time and still pass.

One test was merged rather than kept: "Invisible Joker counter starts at 0" asserted a
value that `initializeJoker` sets, not an effect, so it can never fail under mutation. It
is now the opening assertion of "counter starts at 0 and increments by 1 on each
ROUND_END". That is why the suite reports 810 tests rather than 811.

## Note for later

`handleGameStart` still dispatches `GAME_START` to `collectEffects`. Nothing listens to it
today. It is kept as the extension point for decks, vouchers and tags, which — unlike
jokers — do exist at the moment a run begins.

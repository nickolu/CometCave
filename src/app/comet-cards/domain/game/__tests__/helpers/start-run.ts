import { produce } from 'immer'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { dispatchJokerAdded } from '@/app/comet-cards/domain/game/utils'
import type { JokerDefinition } from '@/app/comet-cards/domain/joker/types'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

/**
 * Build a run the way the game builds one.
 *
 * `GAME_START` deals a brand new run and throws away whatever it was handed —
 * that is what restarting means — so a test cannot install a joker and then
 * start the game; the joker leaves with the old run. A player only ever gets a
 * joker mid-run, out of a shop or a booster pack, and it does its one-time
 * "on acquire" work when it hears `JOKER_ADDED`.
 *
 * So these helpers start the run first and then hand it jokers, which is the
 * order the real game uses.
 */
export function startRun(deckId?: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  if (deckId) game.selectedDeck = deckId
  return reduceGame(game, { type: 'GAME_START' })
}

/** Give a run one more joker, announced the way a purchase announces it. */
export function addJoker(game: GameState, definition: JokerDefinition): GameState {
  return produce(game, draft => {
    const joker = initializeJoker(definition, draft)
    draft.jokers.push(joker)
    dispatchJokerAdded(draft, joker)
  })
}

/** A started run holding the given jokers, acquired one at a time. */
export function startRunWithJokers(
  definitions: JokerDefinition[],
  deckId?: string
): GameState {
  return definitions.reduce((game, definition) => addJoker(game, definition), startRun(deckId))
}

/**
 * Put a started run into the middle of a hand: small blind in progress,
 * gameplay phase. This is where scoring events are dispatched from.
 */
export function inGameplay(game: GameState): GameState {
  return produce(game, draft => {
    draft.rounds[draft.roundIndex].smallBlind.status = 'inProgress'
    draft.gamePhase = 'gameplay'
  })
}

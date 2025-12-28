import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'

import type { GameState } from './types'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

interface ScoreHandOptions {
  getGameState: () => GameState
}

let isScoringInProgress = false

/**
 * Orchestrates the hand scoring sequence by emitting events at appropriate intervals.
 * This moves the scoring coordination logic out of UI components and into the domain.
 *
 * The sequence:
 * 1. HAND_SCORING_START - Initializes scoring, calculates hand, sets up cards to score
 * 2. CARD_SCORED (per card) - Each card is scored individually with a delay for animation
 * 3. HAND_SCORING_DONE_CARD_SCORING - All cards have been scored, joker effects apply
 * 4. HAND_SCORING_FINALIZE - Final cleanup, determines if blind is complete or game continues
 */
export async function scoreHand({ getGameState }: ScoreHandOptions): Promise<void> {
  const game = getGameState()
  const { selectedCardIds } = game.gamePlayState

  // Guard: don't start if already scoring
  if (isScoringInProgress) return

  // Guard: need cards selected to score
  if (selectedCardIds.length === 0) return

  isScoringInProgress = true

  try {
    // Start the scoring sequence
    eventEmitter.emit({ type: 'HAND_SCORING_START' })

    // Get updated state after HAND_SCORING_START to know how many cards to score
    const updatedGame = getGameState()
    const cardsToScoreCount = updatedGame.gamePlayState.cardsToScore.length

    // Score each card with animation delay
    for (let i = 0; i < cardsToScoreCount; i++) {
      await sleep(250)
      eventEmitter.emit({ type: 'CARD_SCORED' })
    }

    // Brief pause before joker/effect phase
    await sleep(750)
    eventEmitter.emit({ type: 'HAND_SCORING_DONE_CARD_SCORING' })

    // Brief pause before finalization
    await sleep(250)
    eventEmitter.emit({ type: 'HAND_SCORING_FINALIZE' })
  } finally {
    isScoringInProgress = false
  }
}

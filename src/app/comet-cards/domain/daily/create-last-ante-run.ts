import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import {
  buildSeedString,
  getCurrentDayAsSeedStringPST,
  getRandomChoiceWithSeed,
} from '@/app/comet-cards/domain/randomness'
import { initializeRounds } from '@/app/comet-cards/domain/round/rounds'

import {
  LAST_ANTE_DRAFT_SHOP_CARDS,
  LAST_ANTE_MEMORY_BUDGET,
  LAST_ANTE_ROUND_INDEX,
  LAST_ANTE_STARTING_MONEY,
} from './constants'

/**
 * Decks The Last Ante draws from.
 *
 * Erratic is excluded because its cards are randomised, which turns the memory
 * phase from a coherence puzzle into a guess. Plasma is excluded because it
 * both doubles blind requirements and replaces the scoring formula — at ante 8
 * that is a different game, not a different day.
 */
const LAST_ANTE_DECKS = [
  'pokerDeck',
  'redDeck',
  'blueDeck',
  'yellowDeck',
  'blackDeck',
  'checkeredDeck',
  'paintedDeck',
  'greenDeck',
  'nebulaDeck',
  'magicDeck',
  'zodiacDeck',
  'ghostDeck',
  'anaglyphDeck',
  'abandonedDeck',
] as const

/** The Last Ante runs on its own seed, so the two dailies never share a boss. */
export function getLastAnteSeed(day: string = getCurrentDayAsSeedStringPST()): string {
  return buildSeedString([day, 'last-ante'])
}

export function getLastAnteDeck(seed: string): string {
  return (
    getRandomChoiceWithSeed({ seed: `${seed}-deck`, choices: [...LAST_ANTE_DECKS] }) ?? 'pokerDeck'
  )
}

/**
 * Build a Last Ante run: one round of three blinds, a hand of free packs, a
 * purse to draft with, and the boss already named.
 *
 * The player is not starting a run — they are arriving at the end of one. The
 * deck is dealt by the day, not chosen, so everyone is solving the same puzzle.
 */
export function createLastAnteRun(day?: string): GameState {
  const seed = getLastAnteSeed(day)
  const deckId = getLastAnteDeck(seed)

  const base = createGameStateWithDeck(deckId)

  // The rounds array is one round long, so `roundIndex` is 0 and every "round
  // N of M" readout in the UI reports 1/1 without needing to know about modes.
  const rounds = [initializeRounds(seed)[LAST_ANTE_ROUND_INDEX]]

  return {
    ...base,
    gameSeed: seed,
    gamePhase: 'opening',
    mode: 'lastAnte',
    lastAnte: {
      openingResolved: false,
      memoryBudget: LAST_ANTE_MEMORY_BUDGET,
      allocation: {},
      discardsRemembered: 0,
      draftResolved: false,
      memoriesResolved: false,
      outcome: null,
    },
    money: LAST_ANTE_STARTING_MONEY,
    rounds,
    roundIndex: 0,
    shopState: {
      ...base.shopState,
      // Shop 0 is the draft, so it is wider than the two shops inside the run.
      maxCardsForSale: LAST_ANTE_DRAFT_SHOP_CARDS,
    },
  }
}

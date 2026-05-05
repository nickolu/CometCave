import { TarotCardDefinition, TarotCardState } from '@/app/comet-cards/domain/consumable/types'
import {
  buildSeedString,
  getRandomNumberWithSeed,
  uuid,
} from '@/app/comet-cards/domain/randomness'

const TAROT_TYPES: TarotCardDefinition['tarotType'][] = [
  'theFool', 'theMagician', 'theHighPriestess', 'theEmpress',
  'theEmperor', 'theHierophant', 'theLovers', 'theChariot',
  'strength', 'theHermit', 'wheelOfFortune', 'justice',
  'theHangedMan', 'death', 'temperance', 'theDevil',
  'theTower', 'theStar', 'theMoon', 'theSun',
  'judgement', 'theWorld',
]

/**
 * Generates starting tarot cards for deck initialization.
 * Uses seeded randomness for deterministic results.
 */
export function generateStartingTarotCards(
  gameSeed: string,
  randomCount: number,
  specificTypes?: TarotCardDefinition['tarotType'][],
): TarotCardState[] {
  const cards: TarotCardState[] = []

  // Add specific tarot types if requested
  if (specificTypes) {
    for (const tarotType of specificTypes) {
      cards.push({ id: uuid(), consumableType: 'tarotCard', tarotType })
    }
  }

  // Add random tarot cards
  for (let i = 0; i < randomCount; i++) {
    const seed = buildSeedString([gameSeed, 'startingTarot', i.toString()])
    const idx = getRandomNumberWithSeed(seed, 0, TAROT_TYPES.length - 1)
    cards.push({ id: uuid(), consumableType: 'tarotCard', tarotType: TAROT_TYPES[idx] })
  }

  return cards
}

import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'

import { CelestialCardDefinition } from './types'

const handIdToName: Record<PokerHandDefinition['id'], string> = {
  highCard: 'High Card',
  pair: 'Pair',
  twoPair: 'Two Pair',
  threeOfAKind: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  fullHouse: 'Full House',
  fourOfAKind: 'Four of a Kind',
  straightFlush: 'Straight Flush',
  flushHouse: 'Flush House',
  fiveOfAKind: 'Five of a Kind',
  flushFive: 'Flush Five',
}

const getDefaultCelestialCardDefinition = (
  handId: CelestialCardDefinition['handId']
): CelestialCardDefinition => {
  return {
    price: 2,
    type: 'celestialCard',
    handId,
    name: handIdToName[handId],
    description: 'Increases the level of ' + handIdToName[handId] + ' by 1',
    isPlayable: () => true,
    effects: [
      {
        event: { type: 'CELESTIAL_CARD_USED' },
        priority: 1,
        apply: (ctx: EffectContext) => {
          ctx.game.pokerHands[handId].level++
        },
      },
    ],
  }
}

export const celestialCards: Record<CelestialCardDefinition['handId'], CelestialCardDefinition> = {
  highCard: getDefaultCelestialCardDefinition('highCard'),
  pair: getDefaultCelestialCardDefinition('pair'),
  twoPair: getDefaultCelestialCardDefinition('twoPair'),
  threeOfAKind: getDefaultCelestialCardDefinition('threeOfAKind'),
  straight: getDefaultCelestialCardDefinition('straight'),
  flush: getDefaultCelestialCardDefinition('flush'),
  fullHouse: getDefaultCelestialCardDefinition('fullHouse'),
  fourOfAKind: getDefaultCelestialCardDefinition('fourOfAKind'),
  straightFlush: getDefaultCelestialCardDefinition('straightFlush'),
  flushHouse: getDefaultCelestialCardDefinition('flushHouse'),
  fiveOfAKind: getDefaultCelestialCardDefinition('fiveOfAKind'),
  flushFive: getDefaultCelestialCardDefinition('flushFive'),
}

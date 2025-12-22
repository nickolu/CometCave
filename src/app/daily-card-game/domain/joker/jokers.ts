import type { EffectContext } from '@/app/daily-card-game/domain/events/types'

import { JokerDefinition } from './types'

export const jokerJoker: JokerDefinition = {
  id: 'jokerJoker',
  name: 'Joker',
  description: '+4 Mult',
  effects: [
    {
      event: { type: 'HAND_SCORING_END' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.score.mult += 4
      },
    },
  ],
  flags: {
    isRentable: false,
    isPerishable: false,
    isEternal: false,
    isHolographic: false,
    isFoil: false,
    isNegative: false,
  },
  rarity: 'common',
}

export const greedyJoker: JokerDefinition = {
  id: 'greedyJoker',
  name: 'Greedy Joker',
  description: 'Played cards with Diamond suit give +3 Mult when scored',
  effects: [
    {
      event: { type: 'CARD_SCORED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const scoredCard = ctx.scoredCards?.[0]
        if (scoredCard?.suit === 'diamonds') {
          ctx.game.gamePlayState.score.mult += 3
        }
      },
    },
  ],
  flags: {
    isRentable: false,
    isPerishable: false,
    isEternal: false,
    isHolographic: false,
    isFoil: false,
    isNegative: false,
  },
  rarity: 'common',
}

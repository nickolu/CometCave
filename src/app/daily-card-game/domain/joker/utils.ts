import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import type { PokerHand } from '@/app/daily-card-game/domain/hand/types'

export const bonusOnCardScored = ({
  ctx,
  suit,
  type,
  value,
  source,
}: {
  ctx: EffectContext
  suit: 'hearts' | 'diamonds' | 'spades' | 'clubs'
  type: 'mult' | 'chips'
  value: number
  source: string
}) => {
  const scoredCard = ctx.scoredCards?.[0]
  if (scoredCard?.suit === suit) {
    ctx.game.gamePlayState.scoringEvents.push({
      id: crypto.randomUUID(),
      type,
      value,
      source,
    })
    ctx.game.gamePlayState.score[type] += value
  }
}

export const bonusOnHandPlayed = ({
  ctx,
  hand,
  type,
  value,
  source,
}: {
  ctx: EffectContext
  hand: PokerHand
  type: 'mult' | 'chips'
  value: number
  source: string
}) => {
  const scoredHand = ctx.game.gamePlayState.selectedHand?.[0]
  if (scoredHand?.id === hand.id) {
    ctx.game.gamePlayState.scoringEvents.push({
      id: crypto.randomUUID(),
      type,
      value,
      source,
    })
    ctx.game.gamePlayState.score[type] += value
  }
}

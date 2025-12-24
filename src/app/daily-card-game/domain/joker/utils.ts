import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { uuid } from '@/app/daily-card-game/domain/randomness'

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
  if (scoredCard && playingCards[scoredCard.playingCardId].suit === suit) {
    ctx.game.gamePlayState.scoringEvents.push({
      id: uuid(),
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
  hand: PokerHandDefinition
  type: 'mult' | 'chips'
  value: number
  source: string
}) => {
  const scoredHand = ctx.game.gamePlayState.selectedHand?.[1]
  if (
    scoredHand &&
    scoredHand.every(card => playingCards[card.playingCardId].suit === playingCards[hand.id].suit)
  ) {
    ctx.game.gamePlayState.scoringEvents.push({
      id: uuid(),
      type,
      value,
      source,
    })
    ctx.game.gamePlayState.score[type] += value
  }
}

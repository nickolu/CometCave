import { GameState } from '@/app/daily-card-game/domain/game/types'
import { ScoreState } from '@/app/daily-card-game/domain/game/types'
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import { RoundDefinition } from '@/app/daily-card-game/domain/round/types'
import { BossBlindDefinition } from '@/app/daily-card-game/domain/round/types'

export type GameEvent =
  | HandDealtEvent
  | HandScoringStartEvent
  | HandScoringEndEvent
  | CardScoredEvent
  | CardSelectedEvent
  | CardDeselectedEvent
  | RoundStartEvent
  | RoundEndEvent
  | DiscardSelectedCardsEvent

export type HandDealtEvent = {
  type: 'HAND_DEALT'
}

export type HandScoringStartEvent = {
  type: 'HAND_SCORING_START'
}

export type HandScoringEndEvent = {
  type: 'HAND_SCORING_END'
}

export type CardScoredEvent = {
  type: 'CARD_SCORED'
}

export type RoundStartEvent = {
  type: 'ROUND_START'
}

export type RoundEndEvent = {
  type: 'ROUND_END'
}

export type CardSelectedEvent = {
  type: 'CARD_SELECTED'
  id: string
}

export type CardDeselectedEvent = {
  type: 'CARD_DESELECTED'
  id: string
}

export type DiscardSelectedCardsEvent = {
  type: 'DISCARD_SELECTED_CARDS'
}
export interface EffectContext {
  event: GameEvent
  game: GameState
  score: ScoreState
  playedCards?: PlayingCard[]
  scoredCards?: PlayingCard[]
  jokers?: JokerDefinition[]
  round?: RoundDefinition
  bossBlind?: BossBlindDefinition
}

export interface Effect {
  event: GameEvent
  priority: number
  condition?: (ctx: EffectContext) => boolean
  apply: (ctx: EffectContext) => void
}

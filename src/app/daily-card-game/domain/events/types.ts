import type { GameState, ScoreState } from '@/app/daily-card-game/domain/game/types'
import type { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import type { BossBlindDefinition, RoundDefinition } from '@/app/daily-card-game/domain/round/types'

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
  | SmallBlindSelectedEvent
  | BigBlindSelectedEvent
  | BossBlindSelectedEvent

export type SmallBlindSelectedEvent = {
  type: 'SMALL_BLIND_SELECTED'
}

export type BigBlindSelectedEvent = {
  type: 'BIG_BLIND_SELECTED'
}

export type BossBlindSelectedEvent = {
  type: 'BOSS_BLIND_SELECTED'
}

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
  id: string
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

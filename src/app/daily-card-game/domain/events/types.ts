import type { GameState, ScoreState } from '@/app/daily-card-game/domain/game/types'
import type { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import type { BossBlindDefinition, RoundDefinition } from '@/app/daily-card-game/domain/round/types'

export type GameEvent =
  | BigBlindSelectedEvent
  | BigBlindSkippedEvent
  | BlindRewardsEndEvent
  | BlindRewardsStartEvent
  | BlindSelectionBackToMenuEvent
  | BossBlindSelectedEvent
  | CardDeselectedEvent
  | CardScoredEvent
  | CardSelectedEvent
  | DiscardSelectedCardsEvent
  | HandDealtEvent
  | HandScoringEndEvent
  | HandScoringStartEvent
  | PackOpenBackToShopEvent
  | RoundEndEvent
  | RoundStartEvent
  | ShopOpenPackEvent
  | ShopSelectBlindEvent
  | SmallBlindSelectedEvent
  | SmallBlindSkippedEvent

export type SmallBlindSelectedEvent = {
  type: 'SMALL_BLIND_SELECTED'
}

export type SmallBlindSkippedEvent = {
  type: 'SMALL_BLIND_SKIPPED'
}

export type BigBlindSelectedEvent = {
  type: 'BIG_BLIND_SELECTED'
}

export type BigBlindSkippedEvent = {
  type: 'BIG_BLIND_SKIPPED'
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

export type BlindRewardsStartEvent = {
  type: 'BLIND_REWARDS_START'
}

export type BlindRewardsEndEvent = {
  type: 'BLIND_REWARDS_END'
}

export type ShopSelectBlindEvent = {
  type: 'SHOP_SELECT_BLIND'
}

export type ShopOpenPackEvent = {
  type: 'SHOP_OPEN_PACK'
}

export type PackOpenBackToShopEvent = {
  type: 'PACK_OPEN_BACK_TO_SHOP'
}

export type BlindSelectionBackToMenuEvent = {
  type: 'BLIND_SELECTION_BACK_TO_MENU'
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

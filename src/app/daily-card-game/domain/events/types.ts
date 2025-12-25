import type { GameState, ScoreState } from '@/app/daily-card-game/domain/game/types'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import type { BlindState, RoundState } from '@/app/daily-card-game/domain/round/types'
import { ConsumableDefinition, TarotCardState } from '../consumable/types'

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
  | DisplayJokersEvent
  | HandDealtEvent
  | HandScoringEndEvent
  | HandScoringStartEvent
  | JokerAddedEvent
  | JokerRemovedEvent
  | PackOpenBackToShopEvent
  | RoundEndEvent
  | RoundStartEvent
  | ShopOpenPackEvent
  | ShopSelectBlindEvent
  | SmallBlindSelectedEvent
  | SmallBlindSkippedEvent
  | TarotCardUsedEvent
  | ConsumableSelectedEvent
  | ConsumableDeselectedEvent

export type BigBlindSelectedEvent = {
  type: 'BIG_BLIND_SELECTED'
}
export type BigBlindSkippedEvent = {
  type: 'BIG_BLIND_SKIPPED'
}
export type BlindRewardsEndEvent = {
  type: 'BLIND_REWARDS_END'
}
export type BlindRewardsStartEvent = {
  type: 'BLIND_REWARDS_START'
}
export type BlindSelectionBackToMenuEvent = {
  type: 'BLIND_SELECTION_BACK_TO_MENU'
}
export type BossBlindSelectedEvent = {
  type: 'BOSS_BLIND_SELECTED'
}
export type CardDeselectedEvent = {
  type: 'CARD_DESELECTED'
  id: string
}
export type CardScoredEvent = {
  type: 'CARD_SCORED'
}
export type CardSelectedEvent = {
  type: 'CARD_SELECTED'
  id: string
}
export type ConsumableSelectedEvent = {
  type: 'CONSUMABLE_SELECTED'
  id: string
}
export type ConsumableDeselectedEvent = {
  type: 'CONSUMABLE_DESELECTED'
  id: string
}
export type DiscardSelectedCardsEvent = {
  type: 'DISCARD_SELECTED_CARDS'
}
export type DisplayJokersEvent = {
  type: 'DISPLAY_JOKERS'
}
export type HandDealtEvent = {
  type: 'HAND_DEALT'
}
export type HandScoringEndEvent = {
  type: 'HAND_SCORING_END'
}
export type HandScoringStartEvent = {
  type: 'HAND_SCORING_START'
}
export type JokerAddedEvent = {
  type: 'JOKER_ADDED'
}
export type JokerRemovedEvent = {
  type: 'JOKER_REMOVED'
}
export type PackOpenBackToShopEvent = {
  type: 'PACK_OPEN_BACK_TO_SHOP'
}
export type RoundEndEvent = {
  type: 'ROUND_END'
}
export type RoundStartEvent = {
  type: 'GAME_START'
}
export type ShopOpenPackEvent = {
  type: 'SHOP_OPEN_PACK'
}
export type ShopSelectBlindEvent = {
  type: 'SHOP_SELECT_BLIND'
}
export type SmallBlindSelectedEvent = {
  type: 'SMALL_BLIND_SELECTED'
}
export type SmallBlindSkippedEvent = {
  type: 'SMALL_BLIND_SKIPPED'
}
export type TarotCardUsedEvent = {
  type: 'TAROT_CARD_USED'
}

export interface EffectContext {
  bossBlind?: BlindState
  event: GameEvent
  game: GameState
  jokers?: JokerState[]
  playedCards?: PlayingCardState[]
  round?: RoundState
  score: ScoreState
  scoredCards?: PlayingCardState[]
  tarotCards?: TarotCardState[]
}

export interface Effect {
  event: GameEvent
  priority: number
  condition?: (ctx: EffectContext) => boolean
  apply: (ctx: EffectContext) => void
}

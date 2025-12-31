import { TarotCardState } from '@/app/daily-card-game/domain/consumable/types'
import type { GameState, ScoreState } from '@/app/daily-card-game/domain/game/types'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import type { BlindState, RoundState } from '@/app/daily-card-game/domain/round/types'
import type { TagState } from '@/app/daily-card-game/domain/tag/types'
import type { VoucherState, VoucherType } from '@/app/daily-card-game/domain/voucher/types'

export type GameEvent =
  | BigBlindSelectedEvent
  | BlindSkippedEvent
  | BlindRewardsEndEvent
  | BlindRewardsStartEvent
  | BackToMenuEvent
  | BossBlindSelectedEvent
  | CardDeselectedEvent
  | CardScoredEvent
  | CardSelectedEvent
  | CelestialCardUsedEvent
  | ConsumableDeselectedEvent
  | ConsumableSelectedEvent
  | ConsumableSoldEvent
  | DiscardSelectedCardsEvent
  | DisplayJokersEvent
  | HandDealtEvent
  | HandScoringDoneCardScoringEvent
  | HandScoringFInalizeEvent
  | HandScoringStartEvent
  | JokerAddedEvent
  | JokerRemovedEvent
  | JokerSelectedEvent
  | JokerDeselectedEvent
  | JokerSoldEvent
  | RoundEndEvent
  | RoundStartEvent
  | ShopSelectBlindEvent
  | ShopSelectCardEvent
  | ShopDeselectCardEvent
  | SmallBlindSelectedEvent
  | SpectralCardUsedEvent
  | TarotCardUsedEvent
  | ShopOpenEvent
  | ShopBuyCardEvent
  | ShopBuyAndUseCardEvent
  | ShopRerollEvent
  | ShopBuyVoucherEvent
  | DisplayBossBlindsEvent
  | DisplayCelestialsEvent
  | DisplaySpectralCardsEvent
  | DisplayTagsEvent
  | DisplayTarotCardsEvent
  | DisplayVouchersEvent
  | DisplayJokersEvent
  | ShopOpenPackEvent
  | ShopSelectPlayingCardFromPackEvent
  | ShopSelectJokerFromPackEvent
  | ShopUseTarotCardFromPackEvent
  | ShopUseCelestialCardFromPackEvent
  | ShopUseSpectralCardFromPackEvent
  | PackOpenSkipEvent

export type ShopBuyCardEvent = {
  type: 'SHOP_BUY_CARD'
}
export type ShopSelectPlayingCardFromPackEvent = {
  type: 'SHOP_SELECT_PLAYING_CARD_FROM_PACK'
  id: string
}
export type ShopSelectJokerFromPackEvent = {
  type: 'SHOP_SELECT_JOKER_FROM_PACK'
  id: string
}
export type ShopUseTarotCardFromPackEvent = {
  type: 'SHOP_USE_TAROT_CARD_FROM_PACK'
  id: string
}
export type ShopUseCelestialCardFromPackEvent = {
  type: 'SHOP_USE_CELESTIAL_CARD_FROM_PACK'
  id: string
}
export type ShopUseSpectralCardFromPackEvent = {
  type: 'SHOP_USE_SPECTRAL_CARD_FROM_PACK'
  id: string
}
export type PackOpenSkipEvent = {
  type: 'PACK_OPEN_SKIP'
}
export type ShopBuyAndUseCardEvent = {
  type: 'SHOP_BUY_AND_USE_CARD'
}
export type BigBlindSelectedEvent = {
  type: 'BIG_BLIND_SELECTED'
}
export type BlindSkippedEvent = {
  type: 'BLIND_SKIPPED'
}
export type BlindRewardsEndEvent = {
  type: 'BLIND_REWARDS_END'
}
export type BlindRewardsStartEvent = {
  type: 'BLIND_REWARDS_START'
}
export type BackToMenuEvent = {
  type: 'BACK_TO_MAIN_MENU'
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
export type CelestialCardUsedEvent = {
  type: 'CELESTIAL_CARD_USED'
}
export type ConsumableSelectedEvent = {
  type: 'CONSUMABLE_SELECTED'
  id: string
}
export type ConsumableDeselectedEvent = {
  type: 'CONSUMABLE_DESELECTED'
  id: string
}
export type ConsumableSoldEvent = {
  type: 'CONSUMABLE_SOLD'
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
export type HandScoringDoneCardScoringEvent = {
  type: 'HAND_SCORING_DONE_CARD_SCORING'
}
export type HandScoringFInalizeEvent = {
  type: 'HAND_SCORING_FINALIZE'
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
export type JokerSelectedEvent = {
  type: 'JOKER_SELECTED'
  id: string
}
export type JokerDeselectedEvent = {
  type: 'JOKER_DESELECTED'
  id: string
}
export type JokerSoldEvent = {
  type: 'JOKER_SOLD'
}
export type RoundEndEvent = {
  type: 'ROUND_END'
}
export type RoundStartEvent = {
  type: 'GAME_START'
}
export type ShopOpenEvent = {
  type: 'SHOP_OPEN'
}
export type ShopSelectBlindEvent = {
  type: 'SHOP_SELECT_BLIND'
}
export type ShopSelectCardEvent = {
  type: 'SHOP_SELECT_CARD'
  id: string
}
export type ShopDeselectCardEvent = {
  type: 'SHOP_DESELECT_CARD'
  id: string
}
export type SmallBlindSelectedEvent = {
  type: 'SMALL_BLIND_SELECTED'
}
export type TarotCardUsedEvent = {
  type: 'TAROT_CARD_USED'
}
export type SpectralCardUsedEvent = {
  type: 'SPECTRAL_CARD_USED'
}
export type ShopRerollEvent = {
  type: 'SHOP_REROLL'
}
export type ShopOpenPackEvent = {
  type: 'SHOP_OPEN_PACK'
  id: string
}
export type ShopBuyVoucherEvent = {
  type: 'SHOP_BUY_VOUCHER'
  id: VoucherType
}
export type DisplayBossBlindsEvent = {
  type: 'DISPLAY_BOSS_BLINDS'
}
export type DisplayCelestialsEvent = {
  type: 'DISPLAY_CELESTIALS'
}
export type DisplayTarotCardsEvent = {
  type: 'DISPLAY_TAROT_CARDS'
}
export type DisplayVouchersEvent = {
  type: 'DISPLAY_VOUCHERS'
}
export type DisplaySpectralCardsEvent = {
  type: 'DISPLAY_SPECTRAL_CARDS'
}
export type DisplayTagsEvent = {
  type: 'DISPLAY_TAGS'
}
export interface EffectContext {
  bossBlind?: BlindState
  event: GameEvent
  game: GameState
  tags: TagState[]
  jokers?: JokerState[]
  playedCards?: PlayingCardState[]
  round?: RoundState
  score: ScoreState
  scoredCards?: PlayingCardState[]
  tarotCards?: TarotCardState[]
  vouchers: VoucherState[]
}

export interface Effect {
  event: GameEvent
  priority: number
  condition?: (ctx: EffectContext) => boolean
  apply: (ctx: EffectContext) => void
}

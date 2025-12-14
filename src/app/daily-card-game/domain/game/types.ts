import { Consumable } from '@/app/daily-card-game/domain/consumable/types'
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { PokerHandsState } from '@/app/daily-card-game/domain/hand/types'
import { RoundDefinition } from '@/app/daily-card-game/domain/round/types'
import { ShopState } from '@/app/daily-card-game/domain/shop/types'
import { TagDefinition } from '@/app/daily-card-game/domain/consumable/types'
import { VoucherDefinition } from '@/app/daily-card-game/domain/consumable/types'
import { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'

export interface GameState {
  consumables: Consumable[]
  discardsPlayed: number
  fullDeck: PlayingCard[]
  gamePhase: GamePhase
  gamePlayState: GamePlayState
  handsPlayed: number
  maxConsumables: number
  maxJokers: number
  money: number
  pokerHands: PokerHandsState
  rounds: RoundDefinition[]
  shopState: ShopState
  stake: Stake
  tags: TagDefinition[]
  ouchersUsed: VoucherDefinition[]
}

export type GamePhase = 'mainMenu' | 'shop' | 'blindSelection' | 'gameplay' | 'packOpening'

export interface GamePlayState {
  jokers: JokerDefinition[]
  dealtCards: PlayingCard[]
  selectedCardIds: string[]
  remainingDeck: PlayingCard[]
  score: ScoreState
  remainingHands: number
  remainingDiscards: number
}

export interface ScoreState {
  chips: number
  mult: number
}

export interface Stake {
  disableSmallBlindReward: boolean
  enableScaleFaster1: boolean
  enableEternalJokers: boolean
  enableFewerDiscards: boolean
  enableScaleFaster2: boolean
  enablePerishableJokers: boolean
  enableRentableJokers: boolean
}

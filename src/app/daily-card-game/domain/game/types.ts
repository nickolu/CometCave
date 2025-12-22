import type {
  Consumable,
  TagDefinition,
  VoucherDefinition,
} from '@/app/daily-card-game/domain/consumable/types'
import type { PokerHand, PokerHandsState } from '@/app/daily-card-game/domain/hand/types'
import type { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import type { RoundDefinition } from '@/app/daily-card-game/domain/round/types'
import type { ShopState } from '@/app/daily-card-game/domain/shop/types'

export interface GameState {
  defaultNumberOfHands: number
  gameSeed: string
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
  roundIndex: number
  shopState: ShopState
  stake: Stake
  tags: TagDefinition[]
  vouchersUsed: VoucherDefinition[]
  totalScore: number
}

export type GamePhase =
  | 'mainMenu'
  | 'shop'
  | 'blindSelection'
  | 'gameplay'
  | 'packOpening'
  | 'gameOver'
  | 'blindRewards'
export interface GamePlayState {
  cardsToScore: PlayingCard[]
  playedCardIds: string[]
  isScoring: boolean
  jokers: JokerDefinition[]
  dealtCards: PlayingCard[]
  selectedCardIds: string[]
  selectedHand?: [PokerHand, PlayingCard[]]
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

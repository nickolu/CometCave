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
  consumables: Consumable[]
  discardsPlayed: number
  fullDeck: PlayingCard[]
  gamePhase: GamePhase
  gamePlayState: GamePlayState // values which reset between hands, blinds, or rounds
  gameSeed: string
  handsPlayed: number
  jokers: JokerDefinition[]
  maxConsumables: number
  maxDiscards: number
  maxHands: number
  maxJokers: number
  money: number
  pokerHands: PokerHandsState
  roundIndex: number
  rounds: RoundDefinition[]
  shopState: ShopState
  stake: Stake
  staticRules: StaticRulesState
  tags: TagDefinition[]
  totalScore: number
  vouchersUsed: VoucherDefinition[]
}

export interface StaticRulesState {
  numberOfCardsRequiredForFlushAndStraight: number
}

export type GamePhase =
  | 'mainMenu'
  | 'jokers'
  | 'shop'
  | 'blindSelection'
  | 'gameplay'
  | 'packOpening'
  | 'gameOver'
  | 'blindRewards'

export interface GamePlayState {
  cardsToScore: PlayingCard[]
  dealtCards: PlayingCard[]
  isScoring: boolean
  playedCardIds: string[]
  remainingDeck: PlayingCard[]
  remainingDiscards: number
  remainingHands: number
  score: ScoreState
  scoringEvents: (ScoringEvent | CustomScoringEvent)[]
  selectedCardIds: string[]
  selectedHand?: [PokerHand, PlayingCard[]]
}

export interface ScoringEvent {
  id: string
  type: 'mult' | 'chips'
  operator?: 'x' | '+'
  value: number
  source: string
}

export interface CustomScoringEvent {
  id: string
  message: string
}

export function isCustomScoringEvent(
  event: ScoringEvent | CustomScoringEvent
): event is CustomScoringEvent {
  return 'message' in event
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

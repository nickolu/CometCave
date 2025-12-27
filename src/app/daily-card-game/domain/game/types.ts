import type {
  CelestialCardState,
  TarotCardState,
} from '@/app/daily-card-game/domain/consumable/types'
import type { PokerHandDefinition, PokerHandsState } from '@/app/daily-card-game/domain/hand/types'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import type { RoundState } from '@/app/daily-card-game/domain/round/types'
import type { ShopState } from '@/app/daily-card-game/domain/shop/types'

export interface GameState {
  consumables: (CelestialCardState | TarotCardState)[]
  consumablesUsed: (CelestialCardState | TarotCardState)[]
  discardsPlayed: number
  fullDeck: PlayingCardState[]
  gamePhase: GamePhase
  gamePlayState: GamePlayState // values which reset between hands, blinds, or rounds
  gameSeed: string
  handsPlayed: number
  jokers: JokerState[]
  maxConsumables: number
  maxDiscards: number
  maxHands: number
  maxJokers: number
  money: number
  minimumMoney: number
  pokerHands: PokerHandsState
  roundIndex: number
  rounds: RoundState[]
  shopState: ShopState
  stake: Stake
  staticRules: StaticRulesState
  totalScore: number
}

export interface StaticRulesState {
  numberOfCardsRequiredForFlushAndStraight: number
  areAllCardsFaceCards: boolean
  allowDuplicateJokersInShop: boolean
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
  cardsToScore: PlayingCardState[]
  dealtCards: PlayingCardState[]
  isScoring: boolean
  playedCardIds: string[]
  remainingDeck: PlayingCardState[]
  remainingDiscards: number
  remainingHands: number
  score: ScoreState
  scoringEvents: (ScoringEvent | CustomScoringEvent)[]
  selectedCardIds: string[]
  selectedHand?: [PokerHandDefinition['id'], PlayingCardState[]]
  selectedConsumable?: CelestialCardState | TarotCardState
  selectedJokerId?: string
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

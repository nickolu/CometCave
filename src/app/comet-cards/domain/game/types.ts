import type {
  CelestialCardState,
  TarotCardState,
} from '@/app/comet-cards/domain/consumable/types'
import type { PokerHandDefinition, PokerHandsState } from '@/app/comet-cards/domain/hand/types'
import type { JokerState } from '@/app/comet-cards/domain/joker/types'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import type { RoundState } from '@/app/comet-cards/domain/round/types'
import type { ShopState } from '@/app/comet-cards/domain/shop/types'
import type { TagState } from '@/app/comet-cards/domain/tag/types'
import type { VoucherState } from '@/app/comet-cards/domain/voucher/types'

export interface GameState {
  allowedJokerFlags: ('isRentable' | 'isPerishable' | 'isEternal')[]

  // Card registry: single source of truth for all card state
  cards: Record<string, PlayingCardState>

  consumables: (CelestialCardState | TarotCardState)[]
  consumablesUsed: (CelestialCardState | TarotCardState)[]
  discardsPlayed: number
  gamePhase: GamePhase
  gamePlayState: GamePlayState // values which reset between hands, blinds, or rounds
  gameSeed: string
  handsPlayed: number
  selectedDeck: string
  jokers: JokerState[]
  maxConsumables: number
  maxDiscards: number
  maxHands: number
  handSizeModifier: number
  maxJokers: number
  maxInterest: number
  money: number
  minimumMoney: number

  // Which cards the player owns (persists between blinds)
  ownedCardIds: string[]

  pokerHands: PokerHandsState
  roundIndex: number
  rounds: RoundState[]
  shopState: ShopState
  stake: Stake
  staticRules: StaticRulesState
  tags: TagState[]
  totalScore: bigint
  vouchers: VoucherState[]
}

export interface StaticRulesState {
  numberOfCardsRequiredForFlushAndStraight: number
  areAllCardsFaceCards: boolean
  allowDuplicateJokersInShop: boolean
  bossBlindRerolls: number
  bossBlindRerollCost: number
  telescopeActive: boolean
  observatoryActive: boolean
  spectralInArcanaPacks: boolean
  probabilityMultiplier: number
  smearedSuits: boolean
  allowStraightGaps: boolean
  bossBlindDisabled: boolean
}

export type GamePhase =
  | 'blindRewards'
  | 'blindSelection'
  | 'bossBlinds'
  | 'celestialCards'
  | 'gameOver'
  | 'gameplay'
  | 'howToPlay'
  | 'jokers'
  | 'mainMenu'
  | 'packOpening'
  | 'shop'
  | 'spectralCards'
  | 'tags'
  | 'tarotCards'
  | 'vouchers'
export interface GamePlayState {
  cardsToScore: PlayingCardState[]

  // Track card IDs played across blinds in current ante (for The Pillar)
  cardIdsPlayedThisAnte: string[]

  // Joker payouts recorded during ROUND_END (shown in blind rewards view)
  jokerPayouts: { name: string; amount: number }[]

  // Discard pile for current blind (card IDs)
  discardPileIds: string[]

  // Draw pile for current blind (card IDs)
  drawPileIds: string[]

  // Current hand (card IDs)
  handIds: string[]

  // Track which hand types have been played this round (resets between blinds)
  handTypesPlayedThisRound: string[]

  handResults: HandResult[]

  handDealt: boolean
  isDiscarding: boolean
  isScoring: boolean
  playedCardIds: string[]
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

export interface HandResult {
  handType: string  // e.g., 'pair', 'flush' — the PokerHandDefinition id
  chips: number
  mult: number
  score: number  // chips * mult
  scoringEventLog: ScoringEvent[]  // joker activations for this hand
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

export interface GameState {
  consumables: Consumable[];
  discardsPlayed: number;
  fullDeck: Card[];
  gamePhase: GamePhase;
  gamePlayState: GamePlayState;
  handsPlayed: number;
  maxConsumables: number;
  maxJokers: number;
  money: number;
  pokerHands: PokerHandsState;
  rounds: RoundState[];
  shopState: ShopState;
  stake: Stake;
  tags: Tag[];
  ouchersUsed: Voucher[];
}

export type GamePhase = 'mainMenu' | 'shop' | 'blindSelection' | 'gameplay' | 'packOpening';

export type Consumable = Celestial | Arcane;

export interface Card {
  value: number; // 2-11
  faceName?: 'Jack' | 'Queen' | 'King';
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  isHolographic: boolean;
  isFoil: boolean;
  modifier?: 'bonus' | 'mult' | 'gold' | 'glass';
}

export interface GamePlayState {
  jokers: Joker[];
  dealtCards: Card[];
  selectedCardIndices: number[];
  remainingDeck: Card[];
  score: ScoreState;
  remainingHands: number;
  remainingDiscards: number;
}

export interface ScoreState {
  chips: number;
  mult: number;
}

export interface PokerHandsState {
  highCard: HandState;
  pair: HandState;
  twoPair: HandState;
  threeOfAKind: HandState;
  straight: HandState;
  flush: HandState;
  fullHouse: HandState;
  fourOfAKind: HandState;
  straightFlush: HandState;
  flushHouse: HandState;
  fiveOfAKind: HandState;
}

export interface RoundState {
  smallBlind: SmallBlindState;
  bigBlind: BigBlindState;
  bossBlind: BossBlindState;
}

export interface ShopState {
  cardsForSale: BuyableCard[];
  packsForSale: Pack[];
  vouchersForSale: Voucher[];
  rerollsUsed: number;
  rerollPrice: number;
  modifiers: ShopStateModifiers;
}

export interface Stake {
  disableSmallBlindReward: boolean;
  enableScaleFaster1: boolean;
  enableEternalJokers: boolean;
  enableFewerDiscards: boolean;
  enableScaleFaster2: boolean;
  enablePerishableJokers: boolean;
  enableRentableJokers: boolean;
}

export interface BuyableCard {
  type: Card | Celestial | Arcane | Joker;
  price: number;
}

export interface Pack {
  card: Celestial | Arcane | Joker | Card;
  type: 'jumbo' | 'normal' | 'mega';
  price: number;
}

export interface ShopStateModifiers {
  maxCardsForSale: number;
  maxVouchersForSale: number;
  baseRerollPrice: number;
}

export interface SmallBlindState {
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress';
}

export interface BigBlindState {
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress';
}

export interface BossBlindState {
  status: 'completed' | 'notStarted' | 'inProgress'; // boss blind cannot be skipped
}

export interface Hand {
  baseChips: number;
  multIncreasePerLevel: number;
  chipIncreasePerLevel: number;
  baseMult: number;
  isSecret: boolean;
  isHand(cards: Card[]): [boolean, Card[]];
}

export interface HandState {
  timesPlayed: number;
  level: number;
  hand: Hand;
}

export interface Celestial {
  hand: Hand;
}

export interface Arcane {
  rules: ArcaneRule[];
}

export interface ArcaneRule {
  name: string;
}

export interface Joker {
  effects: Effect[];
  flags: JokerFlags;
}

export interface JokerFlags {
  isRentable: boolean;
  isPerishable: boolean;
  isEternal: boolean;
  isHolographic: boolean;
  isFoil: boolean;
  isNegative: boolean;
}

export interface Tag {
  name: string;
}

export interface Voucher {
  name: string;
}

export interface Effect {
  event: GameEvent;
  priority: number;
  condition?: (ctx: EffectContext) => boolean;
  apply: (ctx: EffectContext) => void;
}

export type GameEvent =
  | HandScoringStartEvent
  | CardScoredEvent
  | HandScoringEndEvent
  | RoundStartEvent
  | RoundEndEvent
  | JokerTriggeredEvent;

export interface HandScoringStartEvent {
  type: 'HAND_SCORING_START';
  handCards: Card[];
  score: ScoreState;
}

export interface CardScoredEvent {
  type: 'CARD_SCORED';
  card: Card;
  score: ScoreState;
}

export interface HandScoringEndEvent {
  type: 'HAND_SCORING_END';
  score: ScoreState;
}

export interface RoundStartEvent {
  type: 'ROUND_START';
  round: number;
}

export interface RoundEndEvent {
  type: 'ROUND_END';
  round: number;
}

export interface JokerTriggeredEvent {
  type: 'JOKER_TRIGGERED';
  joker: Joker;
  score: ScoreState;
}

export interface EffectContext {
  event: GameEvent;
  game: GameState;
  score: ScoreState;
}

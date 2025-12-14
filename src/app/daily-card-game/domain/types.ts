export interface GameState {
  consumables: Consumable[];
  discardsPlayed: number;
  fullDeck: PlayingCard[];
  gamePhase: GamePhase;
  gamePlayState: GamePlayState;
  handsPlayed: number;
  maxConsumables: number;
  maxJokers: number;
  money: number;
  pokerHands: PokerHandsState;
  rounds: RoundDefinition[];
  shopState: ShopState;
  stake: Stake;
  tags: TagDefinition[];
  ouchersUsed: VoucherDefinition[];
}

export type GamePhase = 'mainMenu' | 'shop' | 'blindSelection' | 'gameplay' | 'packOpening';

export type Consumable = Celestial | Arcane;

export type CardValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A';

export interface PlayingCard {
  value: CardValue;
  id: string;
  baseChips: number;
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  isHolographic: boolean;
  isFoil: boolean;
  modifier?: 'bonus' | 'mult' | 'gold' | 'glass';
  faceUp: boolean;
}

export interface GamePlayState {
  jokers: JokerDefinition[];
  dealtCards: PlayingCard[];
  selectedCardIds: string[];
  remainingDeck: PlayingCard[];
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

export interface RoundDefinition {
  baseChips: number;
  smallBlind: SmallBlindState;
  bigBlind: BigBlindState;
  bossBlind: BossBlindDefinition;
}

export interface ShopState {
  cardsForSale: BuyableCard[];
  packsForSale: Pack[];
  vouchersForSale: VoucherDefinition[];
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
  type: PlayingCard | Celestial | Arcane | JokerDefinition;
  price: number;
}

export interface Pack {
  card: Celestial | Arcane | JokerDefinition | PlayingCard;
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
  anteMultiplier: 1;
}

export interface BigBlindState {
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress';
  anteMultiplier: 1.5;
}

export interface BossBlindDefinition {
  status: 'completed' | 'notStarted' | 'inProgress'; // boss blind cannot be skipped
  anteMultiplier: 1 | 2 | 4 | 6;
  winnings: number;
  name: string;
  description: string;
  image: string;
  effects: Effect[];
  minimumAnte: number;
}

export interface PokerHand {
  baseChips: number;
  multIncreasePerLevel: number;
  chipIncreasePerLevel: number;
  baseMult: number;
  isSecret: boolean;
  isHand(cards: PlayingCard[]): [boolean, PlayingCard[]];
}

export interface HandState {
  timesPlayed: number;
  level: number;
  hand: PokerHand;
}

export interface Celestial {
  hand: PokerHand;
}

export interface Arcane {
  rules: ArcaneRule[];
}

export interface ArcaneRule {
  name: string;
}

export interface JokerDefinition {
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

export interface TagDefinition {
  name: string;
}

export interface VoucherDefinition {
  name: string;
}

export type GameEvent =
  | HandDealtEvent
  | HandScoringStartEvent
  | HandScoringEndEvent
  | CardScoredEvent
  | CardSelectedEvent
  | CardDeselectedEvent
  | RoundStartEvent
  | RoundEndEvent
  | DiscardSelectedCardsEvent;

export type HandDealtEvent = {
  type: 'HAND_DEALT';
};

export type HandScoringStartEvent = {
  type: 'HAND_SCORING_START';
};

export type HandScoringEndEvent = {
  type: 'HAND_SCORING_END';
};

export type CardScoredEvent = {
  type: 'CARD_SCORED';
};

export type RoundStartEvent = {
  type: 'ROUND_START';
};

export type RoundEndEvent = {
  type: 'ROUND_END';
};

export type CardSelectedEvent = {
  type: 'CARD_SELECTED';
  id: string;
};

export type CardDeselectedEvent = {
  type: 'CARD_DESELECTED';
  id: string;
};

export type DiscardSelectedCardsEvent = {
  type: 'DISCARD_SELECTED_CARDS';
};
export interface EffectContext {
  event: GameEvent;
  game: GameState;
  score: ScoreState;
  playedCards?: PlayingCard[];
  scoredCards?: PlayingCard[];
  jokers?: JokerDefinition[];
  round?: RoundDefinition;
  bossBlind?: BossBlindDefinition;
}

export interface Effect {
  event: GameEvent;
  priority: number;
  condition?: (ctx: EffectContext) => boolean;
  apply: (ctx: EffectContext) => void;
}

import { PlayingCard, PokerHand } from '../domain/types';

export const highCardHand: PokerHand = {
  baseChips: 100,
  multIncreasePerLevel: 1,
  chipIncreasePerLevel: 1,
  baseMult: 1,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const pairHand: PokerHand = {
  baseChips: 200,
  multIncreasePerLevel: 2,
  chipIncreasePerLevel: 2,
  baseMult: 2,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const twoPairHand: PokerHand = {
  baseChips: 300,
  multIncreasePerLevel: 3,
  chipIncreasePerLevel: 3,
  baseMult: 3,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const threeOfAKindHand: PokerHand = {
  baseChips: 400,
  multIncreasePerLevel: 4,
  chipIncreasePerLevel: 4,
  baseMult: 4,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const straightHand: PokerHand = {
  baseChips: 500,
  multIncreasePerLevel: 5,
  chipIncreasePerLevel: 5,
  baseMult: 5,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const flushHand: PokerHand = {
  baseChips: 600,
  multIncreasePerLevel: 6,
  chipIncreasePerLevel: 6,
  baseMult: 6,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const fullHouseHand: PokerHand = {
  baseChips: 700,
  multIncreasePerLevel: 7,
  chipIncreasePerLevel: 7,
  baseMult: 7,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const fourOfAKindHand: PokerHand = {
  baseChips: 800,
  multIncreasePerLevel: 8,
  chipIncreasePerLevel: 8,
  baseMult: 8,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const straightFlushHand: PokerHand = {
  baseChips: 900,
  multIncreasePerLevel: 9,
  chipIncreasePerLevel: 9,
  baseMult: 9,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const flushHouseHand: PokerHand = {
  baseChips: 1000,
  multIncreasePerLevel: 10,
  chipIncreasePerLevel: 10,
  baseMult: 10,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

export const fiveOfAKindHand: PokerHand = {
  baseChips: 1100,
  multIncreasePerLevel: 11,
  chipIncreasePerLevel: 11,
  baseMult: 11,
  isSecret: false,
  isHand: (cards: PlayingCard[]) => {
    return [true, cards];
  },
};

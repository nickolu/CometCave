import { Card, Hand } from "../types";

export const highCardHand: Hand = {
    baseChips: 100,
    multIncreasePerLevel: 1,
    chipIncreasePerLevel: 1,
    baseMult: 1,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const pairHand: Hand = {
    baseChips: 200,
    multIncreasePerLevel: 2,
    chipIncreasePerLevel: 2,
    baseMult: 2,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const twoPairHand: Hand = {
    baseChips: 300,
    multIncreasePerLevel: 3,
    chipIncreasePerLevel: 3,
    baseMult: 3,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const threeOfAKindHand: Hand = {
    baseChips: 400,
    multIncreasePerLevel: 4,
    chipIncreasePerLevel: 4,
    baseMult: 4,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const straightHand: Hand = {
    baseChips: 500,
    multIncreasePerLevel: 5,
    chipIncreasePerLevel: 5,
    baseMult: 5,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const flushHand: Hand = {
    baseChips: 600,
    multIncreasePerLevel: 6,
    chipIncreasePerLevel: 6,
    baseMult: 6,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const fullHouseHand: Hand = {
    baseChips: 700,
    multIncreasePerLevel: 7,
    chipIncreasePerLevel: 7,
    baseMult: 7,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const fourOfAKindHand: Hand = {
    baseChips: 800,
    multIncreasePerLevel: 8,
    chipIncreasePerLevel: 8,
    baseMult: 8,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const straightFlushHand: Hand = {
    baseChips: 900,
    multIncreasePerLevel: 9,
    chipIncreasePerLevel: 9,
    baseMult: 9,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const flushHouseHand: Hand = {
    baseChips: 1000,
    multIncreasePerLevel: 10,
    chipIncreasePerLevel: 10,
    baseMult: 10,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

export const fiveOfAKindHand: Hand = {
    baseChips: 1100,
    multIncreasePerLevel: 11,
    chipIncreasePerLevel: 11,
    baseMult: 11,
    isSecret: false,
    isHand: (cards: Card[]) => {
        return [true, cards];
    },
};

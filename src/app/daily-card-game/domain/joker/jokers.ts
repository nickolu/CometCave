import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import {
  flushHand,
  pairHand,
  straightHand,
  threeOfAKindHand,
  twoPairHand,
} from '@/app/daily-card-game/domain/hand/hands'
import { uuid } from '@/app/daily-card-game/domain/randomness'

import { JokerDefinition } from './types'
import { bonusOnCardScored, bonusOnHandPlayed, isJokerState } from './utils'

export const jokerJoker: JokerDefinition = {
  id: 'jokerJoker',
  name: 'Joker',
  description: '+4 Mult',
  price: 2,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.scoringEvents.push({
          id: uuid(),
          type: 'mult',
          value: 4,
          source: 'Joker',
        })
        ctx.game.gamePlayState.score.mult += 4
      },
    },
  ],
  rarity: 'common',
}

export const greedyJoker: JokerDefinition = {
  id: 'greedyJoker',
  name: 'Greedy Joker',
  description: 'Played cards with Diamond suit give +3 Mult when scored',
  price: 5,
  effects: [
    {
      event: { type: 'CARD_SCORED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnCardScored({
          ctx,
          suit: 'diamonds',
          type: 'mult',
          value: 3,
          source: 'Greedy Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const lustyJoker: JokerDefinition = {
  id: 'lustyJoker',
  name: 'Lusty Joker',
  description: 'Played cards with Heart suit give +3 Mult when scored',
  price: 5,
  effects: [
    {
      event: { type: 'CARD_SCORED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnCardScored({
          ctx,
          suit: 'hearts',
          type: 'mult',
          value: 3,
          source: 'Lusty Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const wrathfulJoker: JokerDefinition = {
  id: 'wrathfulJoker',
  name: 'Wrathful Joker',
  description: 'Played cards with Spade suit give +3 Mult when scored',
  price: 5,
  effects: [
    {
      event: { type: 'CARD_SCORED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnCardScored({
          ctx,
          suit: 'spades',
          type: 'mult',
          value: 3,
          source: 'Wrathful Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const gluttonousJoker: JokerDefinition = {
  id: 'gluttonousJoker',
  name: 'Gluttonous Joker',
  description: 'Played cards with Club suit give +3 Mult when scored',
  price: 5,
  effects: [
    {
      event: { type: 'CARD_SCORED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnCardScored({
          ctx,
          suit: 'clubs',
          type: 'mult',
          value: 3,
          source: 'Gluttonous Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const jollyJoker: JokerDefinition = {
  id: 'jollyJoker',
  name: 'Jolly Joker',
  description: 'Pair hand gives +1 Mult when scored',
  price: 3,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: pairHand,
          type: 'mult',
          value: 8,
          source: 'Jolly Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const zanyJoker: JokerDefinition = {
  id: 'zanyJoker',
  name: 'Zany Joker',
  description: 'Three of a Kind hand gives +12 Mult when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: threeOfAKindHand,
          type: 'mult',
          value: 12,
          source: 'Zany Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const madJoker: JokerDefinition = {
  id: 'madJoker',
  name: 'Mad Joker',
  description: 'Two Pair hand gives +10 Mult when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: twoPairHand,
          type: 'mult',
          value: 10,
          source: 'Mad Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const crazyJoker: JokerDefinition = {
  id: 'crazyJoker',
  name: 'Crazy Joker',
  description: 'Straight hand gives +12 Mult when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: straightHand,
          type: 'mult',
          value: 12,
          source: 'Crazy Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const drollJoker: JokerDefinition = {
  id: 'drollJoker',
  name: 'Droll Joker',
  description: 'Flush hand gives +10 Mult when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: flushHand,
          type: 'mult',
          value: 10,
          source: 'Droll Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const slyJoker: JokerDefinition = {
  id: 'slyJoker',
  name: 'Sly Joker',
  description: 'Pair hand gives +50 Chips when scored',
  price: 3,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: pairHand,
          type: 'chips',
          value: 50,
          source: 'Sly Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const wilyJoker: JokerDefinition = {
  id: 'wilyJoker',
  name: 'Wily Joker',
  description: 'Three of a Kind hand gives +100 Chips when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: threeOfAKindHand,
          type: 'chips',
          value: 100,
          source: 'Wily Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const cleverJoker: JokerDefinition = {
  id: 'cleverJoker',
  name: 'Clever Joker',
  description: 'Two Pair hand gives +80 Chips when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: twoPairHand,
          type: 'chips',
          value: 80,
          source: 'Clever Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const deviousJoker: JokerDefinition = {
  id: 'deviousJoker',
  name: 'Devious Joker',
  description: 'Straight hand gives +100 Chips when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_DONE_CARD_SCORING' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: straightHand,
          type: 'chips',
          value: 100,
          source: 'Devious Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const craftyJoker: JokerDefinition = {
  id: 'craftyJoker',
  name: 'Crafty Joker',
  description: 'Flush hand gives +80 Chips when scored',
  price: 4,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        bonusOnHandPlayed({
          ctx,
          hand: flushHand,
          type: 'chips',
          value: 80,
          source: 'Crafty Joker',
        })
      },
    },
  ],
  rarity: 'common',
}

export const halfJoker: JokerDefinition = {
  id: 'halfJoker',
  name: 'Half Joker',
  description: '+20 Mult if played hand contains 3 or fewer cards',
  price: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        if (ctx.game.gamePlayState.cardsToScore?.length <= 3) {
          ctx.game.gamePlayState.score.mult += 20
          ctx.game.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'mult',
            value: 20,
            source: 'Half Joker',
          })
        }
      },
    },
  ],
  rarity: 'common',
}

export const jokerStencil: JokerDefinition = {
  id: 'jokerStencil',
  name: 'Joker Stencil',
  description: 'X1 Mult for each empty Joker slot.',
  price: 8,
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.score.mult *= Math.max(
          1,
          ctx.game.maxJokers - ctx.game.jokers.length
        )
        ctx.game.gamePlayState.scoringEvents.push({
          id: uuid(),
          type: 'mult',
          operator: 'x',
          value: ctx.game.maxJokers - ctx.game.jokers.length,
          source: 'Joker Stencil',
        })
      },
    },
  ],
  rarity: 'uncommon',
}

export const fourFingersJoker: JokerDefinition = {
  id: 'fourFingersJoker',
  name: 'Four Fingers',
  description: 'All Flushes and Straights can be made with 4 cards.',
  price: 7,
  effects: [
    {
      event: { type: 'GAME_START' }, // handle game start in case the game starts with jokers
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.staticRules.numberOfCardsRequiredForFlushAndStraight = 4
      },
    },
    {
      event: { type: 'JOKER_ADDED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        ctx.game.staticRules.numberOfCardsRequiredForFlushAndStraight = 4
      },
    },
    {
      event: { type: 'SHOP_BUY_CARD' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const selectedCard = ctx.game.shopState.cardsForSale.find(
          card => card.card.id === ctx.game.shopState.selectedCardId
        )
        if (!selectedCard) return
        if (
          isJokerState(selectedCard.card) &&
          selectedCard.card.jokerId === jokers.fourFingersJoker.id
        ) {
          ctx.game.staticRules.numberOfCardsRequiredForFlushAndStraight = 4
        }
      },
    },
    {
      event: { type: 'JOKER_SOLD' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // don't modify if there's another four fingers joker in play
        if (!ctx.game.jokers.some(joker => joker.jokerId === jokers.fourFingersJoker.id)) {
          ctx.game.staticRules.numberOfCardsRequiredForFlushAndStraight = 5
        }
      },
    },
    {
      event: { type: 'JOKER_REMOVED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        if (!ctx.game.jokers.some(joker => joker.jokerId === jokers.fourFingersJoker.id)) {
          ctx.game.staticRules.numberOfCardsRequiredForFlushAndStraight = 5
        }
      },
    },
  ],
  rarity: 'uncommon',
}

export const jokers: Record<JokerDefinition['id'], JokerDefinition> = {
  jokerJoker,
  greedyJoker,
  jollyJoker,
  gluttonousJoker,
  wrathfulJoker,
  madJoker,
  crazyJoker,
  drollJoker,
  wilyJoker,
  cleverJoker,
  deviousJoker,
  craftyJoker,
  halfJoker,
  jokerStencil,
  fourFingersJoker,
}

/***
 * JOKERS LEFT TO PROGRAM:
 
18	Four Fingers
Four Fingers	All Flushes and Straights can be made with 4 cards	$7	Uncommon	Available from start.	!!	N/A
19	Mime
Mime	Retrigger all card held in hand abilities	$5	Uncommon	Available from start.	...	On Held
20	Credit Card
Credit Card	Go up to -$20 in debt	$1	Common	Available from start.	+$	N/A
21	Ceremonial Dagger
Ceremonial Dagger	When Blind is selected, destroy Joker to the right and permanently add double its sell value to it's Mult (Currently +0 Mult)	$6	Uncommon	Available from start.	+m	Indep.
22	Banner
Banner	+30 Chips for each remaining discard	$5	Common	Available from start.	+c	Indep.
23	Mystic Summit
Mystic Summit	+15 Mult when 0 discards remaining	$5	Common	Available from start.	+m	Indep.
24	Marble Joker
Marble Joker	Adds one Stone card to the deck when Blind is selected	$6	Uncommon	Available from start.	!!	N/A
25	Loyalty Card
Loyalty Card	X4 Mult every 6 hands played
5 remaining	$5	Uncommon	Available from start.	Xm	Indep.
26	8 Ball
8 Ball	1 in 4 chance for each played 8 to create a Tarot card when scored
(Must have room)	$5	Common	Available from start.	!!	On Scored
27	Misprint
Misprint	+0-23 Mult	$4	Common	Available from start.	+m	Indep.
28	Dusk
Dusk	Retrigger all played cards in final hand of the round	$5	Uncommon	Available from start.	...	On Scored
29	Raised Fist
Raised Fist	Adds double the rank of lowest ranked card held in hand to Mult	$5	Common	Available from start.	+m	On Held
30	Chaos the Clown
Chaos the Clown	1 free Reroll per shop	$4	Common	Available from start.	!!	N/A
31	Fibonacci
Fibonacci	Each played Ace, 2, 3, 5, or 8 gives +8 Mult when scored	$8	Uncommon	Available from start.	+m	On Scored
32	Steel Joker
Steel Joker	Gives X0.2 Mult for each Steel Card in your full deck
(Currently X1 Mult)	$7	Uncommon	Available from start. (Can only appear in the shop when there is a Steel Card in the deck.)	Xm	Indep.
33	Scary Face
Scary Face	Played face cards give +30 Chips when scored	$4	Common	Available from start.	+c	On Scored
34	Abstract Joker
Abstract Joker	+3 Mult for each Joker card
(Currently +0 Mult)	$4	Common	Available from start.	+m	Indep.
35	Delayed Gratification
Delayed Gratification	Earn $2 per discard if no discards are used by end of the round	$4	Common	Available from start.	+$	N/A
36	Hack
Hack	Retrigger each played 2, 3, 4, or 5	$6	Uncommon	Available from start.	...	On Scored
37	Pareidolia
Pareidolia	All cards are considered face cards	$5	Uncommon	Available from start.	!!	N/A
38	Gros Michel
Gros Michel	+15 Mult
1 in 6 chance this is destroyed at the end of round.	$5	Common	Available from start.	+m	Indep.
39	Even Steven
Even Steven	Played cards with even rank give +4 Mult when scored
(10, 8, 6, 4, 2)	$4	Common	Available from start.	+m	On Scored
40	Odd Todd
Odd Todd	Played cards with odd rank give +31 Chips when scored
(A, 9, 7, 5, 3)	$4	Common	Available from start.	+c	On Scored
41	Scholar
Scholar	Played Aces give +20 Chips and +4 Mult when scored	$4	Common	Available from start.	++	On Scored
42	Business Card
Business Card	Played face cards have a 1 in 2 chance to give $2 when scored	$4	Common	Available from start.	+$	On Scored
43	Supernova
Supernova	Adds the number of times poker hand has been played this run to Mult	$5	Common	Available from start.	+m	Indep.
44	Ride the Bus
Ride the Bus	This Joker gains +1 Mult per consecutive hand played without a scoring face card
(Currently +0 Mult)	$6	Common	Available from start.	+m	Mixed
45	Space Joker
Space Joker	1 in 4 chance to upgrade level of played poker hand	$5	Uncommon	Available from start.	!!	On Played
46	Egg
Egg	Gains $3 of sell value at end of round	$4	Common	Available from start.	+$	N/A
47	Burglar
Burglar	When Blind is selected, gain +3 Hands and lose all discards	$6	Uncommon	Available from start.	!!	N/A
48	Blackboard
Blackboard	X3 Mult if all cards held in hand are Spade suit icon Spades or Club suit icon Clubs	$6	Uncommon	Available from start.	Xm	Indep.
49	Runner
Runner	Gains +15 Chips if played hand contains a Straight
(Currently +0 Chips)	$5	Common	Available from start.	+c	Mixed
50	Ice Cream
Ice Cream	+100 Chips
-5 Chips for every hand played	$5	Common	Available from start.	+c	Indep.
51	DNA
DNA	If first hand of round has only 1 card, add a permanent copy to deck and draw it to hand	$8	Rare	Available from start.	!!	On Played
52	Splash
Splash	Every played card counts in scoring	$3	Common	Available from start.	!!	N/A
53	Blue Joker
Blue Joker	+2 Chips for each remaining card in deck
(Currently +104 Chips)	$5	Common	Available from start.	+c	Indep.
54	Sixth Sense
Sixth Sense	If first hand of round is a single 6, destroy it and create a Spectral card
(Must have room)	$6	Uncommon	Available from start.	!!	N/A
55	Constellation
Constellation	This Joker gains X0.1 Mult every time a Planet card is used
(Currently X1 Mult)	$6	Uncommon	Available from start.	Xm	Indep.
56	Hiker
Hiker	Every played card permanently gains +5 Chips when scored	$5	Uncommon	Available from start.	+c	On Scored
57	Faceless Joker
Faceless Joker	Earn $5 if 3 or more face cards are discarded at the same time	$4	Common	Available from start.	+$	On Discard
58	Green Joker
Green Joker	+1 Mult per hand played
-1 Mult per discard
(Currently +0 Mult)	$4	Common	Available from start.	+m	Mixed
59	Superposition
Superposition	Create a Tarot card if poker hand contains an Ace and a Straight
(Must have room)	$4	Common	Available from start.	!!	Indep.
60	To Do List
To Do List	Earn $4 if poker hand is a [Poker Hand], poker hand changes at end of round	$4	Common	Available from start.	+$	On Played
61	Cavendish
Cavendish	X3 Mult
1 in 1000 chance this card is destroyed at the end of round	$4	Common	Available from start. (Can only appear in the shop when Gros Michel Gros Michel has destroyed itself in the current run.)	Xm	Indep.
62	Card Sharp
Card Sharp	X3 Mult if played poker hand has already been played this round	$6	Uncommon	Available from start.	Xm	Indep.
63	Red Card
Red Card	This Joker gains +3 Mult when any Booster Pack is skipped
(Currently +0 Mult)	$5	Common	Available from start.	+m	Indep.
64	Madness
Madness	When Small Blind or Big Blind is selected, gain X0.5 Mult and destroy a random Joker
(Currently X1 Mult)	$7	Uncommon	Available from start.	Xm	Indep.
65	Square Joker
Square Joker	This Joker gains +4 Chips if played hand has exactly 4 cards
(Currently 0 Chips)	$4	Common	Available from start.	+c	Mixed
66	Séance
Séance	If poker hand is a Straight Flush, create a random Spectral card
(Must have room)	$6	Uncommon	Available from start.	!!	Indep.
67	Riff-Raff
Riff-Raff	When Blind is selected, create 2 Common Jokers
(Must have room)	$6	Common	Available from start.	!!	N/A
68	Vampire
Vampire	This Joker gains X0.1 Mult per scoring Enhanced card played, removes card Enhancement
(Currently X1 Mult)	$7	Uncommon	Available from start.	Xm	Mixed
69	Shortcut
Shortcut	Allows Straights to be made with gaps of 1 rank
(ex: 10 8 6 5 3)	$7	Uncommon	Available from start.	!!	N/A
70	Hologram
Hologram	This Joker gains X0.25 Mult every time a playing card is added to your deck
(Currently X1 Mult)	$7	Uncommon	Available from start.	Xm	Indep.
71	Vagabond
Vagabond	Create a Tarot card if hand is played with $4 or less	$8	Rare	Available from start.	!!	Indep.
72	Baron
Baron	Each King held in hand gives X1.5 Mult	$8	Rare	Available from start.	Xm	On Held
73	Cloud 9
Cloud 9	Earn $1 for each 9 in your full deck at end of round
(Currently $4)	$7	Uncommon	Available from start.	+$	N/A
74	Rocket
Rocket	Earn $1 at end of round. Payout increases by $2 when Boss Blind is defeated	$6	Uncommon	Available from start.	+$	N/A
75	Obelisk
Obelisk	This Joker gains X0.2 Mult per consecutive hand played without playing your most played poker hand
(Currently X1 Mult)	$8	Rare	Available from start.	Xm	Mixed
76	Midas Mask
Midas Mask	All played face cards become Gold cards when scored	$7	Uncommon	Available from start.	!!	On Played
77	Luchador
Luchador	Sell this card to disable the current Boss Blind	$5	Uncommon	Available from start.	!!	N/A
78	Photograph
Photograph	First played face card gives X2 Mult when scored	$5	Common	Available from start.	Xm	On Scored
79	Gift Card
Gift Card	Add $1 of sell value to every Joker and Consumable card at end of round	$6	Uncommon	Available from start.	+$	N/A
80	Turtle Bean
Turtle Bean	+5 hand size, reduces by 1 each round	$6	Uncommon	Available from start.	!!	N/A
81	Erosion
Erosion	+4 Mult for each card below [the deck's starting size] in your full deck
(Currently +0 Mult)	$6	Uncommon	Available from start.	+m	Indep.
82	Reserved Parking
Reserved Parking	Each face card held in hand has a 1 in 2 chance to give $1	$6	Common	Available from start.	+$	On Held
83	Mail-In Rebate
Mail-In Rebate	Earn $5 for each discarded [rank], rank changes every round	$4	Common	Available from start.	+$	On Discard
84	To the Moon
To the Moon	Earn an extra $1 of interest for every $5 you have at end of round	$5	Uncommon	Available from start.	+$	N/A
85	Hallucination
Hallucination	1 in 2 chance to create a Tarot card when any Booster Pack is opened
(Must have room)	$4	Common	Available from start.	!!	N/A
86	Fortune Teller
Fortune Teller	+1 Mult per Tarot card used this run
(Currently +0)	$6	Common	Available from start.	+m	Indep.
87	Juggler
Juggler	+1 hand size	$4	Common	Available from start.	!!	N/A
88	Drunkard
Drunkard	+1 discard each round	$4	Common	Available from start.	!!	N/A
89	Stone Joker
Stone Joker	Gives +25 Chips for each Stone Card in your full deck
(Currently +0 Chips)	$6	Uncommon	Available from start. (Can only appear in the shop when there is a Stone Card in the deck.)	+c	Indep.
90	Golden Joker
Golden Joker	Earn $4 at end of round	$6	Common	Available from start.	+$	N/A
91	Lucky Cat
Lucky Cat	This Joker gains X0.25 Mult every time a Lucky card successfully triggers
(Currently X1 Mult)	$6	Uncommon	Available from start. (Can only appear in the shop when there is a Lucky Card in the deck.)	Xm	Mixed
92	Baseball Card
Baseball Card	Uncommon Jokers each give X1.5 Mult	$8	Rare	Available from start.	Xm	On Other Jokers
93	Bull
Bull	+2 Chips for each $1 you have
(Currently +0 Chips)	$6	Uncommon	Available from start.	+c	Indep.
94	Diet Cola
Diet Cola	Sell this card to create a free Double Tag	$6	Uncommon	Available from start.	!!	N/A
95	Trading Card
Trading Card	If first discard of round has only 1 card, destroy it and earn $3	$6	Uncommon	Available from start.	+$	On Discard
96	Flash Card
Flash Card	This Joker gains +2 Mult per reroll in the shop
(Currently +0 Mult)	$5	Uncommon	Available from start.	+m	Indep.
97	Popcorn
Popcorn	+20 Mult
-4 Mult per round played	$5	Common	Available from start.	+m	Indep.
98	Spare Trousers
Spare Trousers	This Joker gains +2 Mult if played hand contains a Two Pair
(Currently +0 Mult)	$6	Uncommon	Available from start.	+m	Mixed
99	Ancient Joker
Ancient Joker	Each played card with [suit] gives X1.5 Mult when scored,
suit changes at end of round	$8	Rare	Available from start.	Xm	On Scored
100	Ramen
Ramen	X2 Mult, loses X0.01 Mult per card discarded	$6	Uncommon	Available from start.	Xm	Mixed
101	Walkie Talkie
Walkie Talkie	Each played 10 or 4 gives +10 Chips and +4 Mult when scored	$4	Common	Available from start.	++	On Scored
102	Seltzer
Seltzer	Retrigger all cards played for the next 10 hands	$6	Uncommon	Available from start.	...	On Scored
103	Castle
Castle	This Joker gains +3 Chips per discarded [suit] card, suit changes every round
(Currently +0 Chips)	$6	Uncommon	Available from start.	+c	Mixed
104	Smiley Face
Smiley Face	Played face cards give +5 Mult when scored	$4	Common	Available from start.	+m	On Scored
105	Campfire
Campfire	This Joker gains X0.25 Mult for each card sold, resets when Boss Blind is defeated
(Currently X1 Mult)	$9	Rare	Available from start.	Xm	Indep.
106	Golden Ticket
Golden Ticket	Played Gold cards earn $4 when scored	$5	Common	Play a 5 card hand that contains only Gold cards. (Can only appear in the shop when there is a Gold Card in the deck.)	+$	On Scored
107	Mr. Bones
Mr. Bones	Prevents Death if chips scored are at least 25% of required chips
self destructs	$5	Uncommon	Lose five runs.	!!	N/A
108	Acrobat
Acrobat	X3 Mult on final hand of round	$6	Uncommon	Play 200 hands	Xm	Indep.
109	Sock and Buskin
Sock and Buskin	Retrigger all played face cards	$6	Uncommon	Play 300 face cards across all runs.	...	On Scored
110	Swashbuckler
Swashbuckler	Adds the sell value of all other owned Jokers to Mult
(Currently +1 Mult)	$4	Common	Sell 20 Jokers.	+m	Indep.
111	Troubadour
Troubadour	+2 hand size,
-1 hand per round	$6	Uncommon	Win 5 consecutive rounds by playing only a single hand in each. (Discards are fine.)	!!	N/A
112	Certificate
Certificate	When round begins, add a random playing card with a random seal to your hand	$6	Uncommon	Have a Gold card with a Gold Seal.	!!	N/A
113	Smeared Joker
Smeared Joker	Heart suit icon Hearts and Diamond suit icon Diamonds count as the same suit, Spade suit icon Spades and Club suit icon Clubs count as the same suit	$7	Uncommon	Have 3 or more Wild Cards in your deck.	!!	N/A
114	Throwback
Throwback	X0.25 Mult for each Blind skipped this run
(Currently X1 Mult)	$6	Uncommon	Continue a run from the Main Menu.	Xm	Indep.
115	Hanging Chad
Hanging Chad	Retrigger first played card used in scoring 2 additional times	$4	Common	Beat a Boss Blind with a High Card hand.	...	On Scored
116	Rough Gem
Rough Gem	Played cards with Diamond suit icon Diamond suit earn $1 when scored	$7	Uncommon	Have at least 30 Diamonds in your deck	+$	On Scored
117	Bloodstone
Bloodstone	1 in 2 chance for played cards with Heart suit icon Heart suit to give X1.5 Mult when scored	$7	Uncommon	Have at least 30 Hearts in your deck.	Xm	On Scored
118	Arrowhead
Arrowhead	Played cards with Spade suit icon Spade suit give +50 Chips when scored	$7	Uncommon	Have at least 30 Spades in your deck.	+c	On Scored
119	Onyx Agate
Onyx Agate	Played cards with Club suit icon Club suit give +7 Mult when scored	$7	Uncommon	Have at least 30 Clubs in your deck	+m	On Scored
120	Glass Joker
Glass Joker	This Joker gains X0.75 Mult for every Glass Card that is destroyed
(Currently X1 Mult)	$6	Uncommon	Have 5 or more Glass cards in your deck. (Can only appear in the shop when there is a Glass Card in the deck.)	Xm	Indep.
121	Showman
Showman	Joker, Tarot, Planet, and Spectral cards may appear multiple times	$5	Uncommon	Reach Ante level 4	!!	N/A
122	Flower Pot
Flower Pot	X3 Mult if poker hand contains a Diamond suit icon Diamond card, Club suit icon Club card, Heart suit icon Heart card, and Spade suit icon Spade card	$6	Uncommon	Reach Ante Level 8	Xm	Indep.
123	Blueprint
Blueprint	Copies ability of Joker to the right	$10	Rare	Win 1 run.	!!	
124	Wee Joker
Wee Joker	This Joker gains +8 Chips when each played 2 is scored
(Currently +0  Chips)	$8	Rare	Win a run in 18 or fewer rounds.	+c	Mixed
125	Merry Andy
Merry Andy	+3 discards each round,
-1 hand size	$7	Uncommon	Win a run in 12 or fewer rounds	!!	N/A
126	Oops! All 6s
Oops! All 6s	Doubles all listed probabilities
(ex: 1 in 3 -> 2 in 3)	$4	Uncommon	Earn at least 10,000 Chips in a single hand.	!!	N/A
127	The Idol
The Idol	Each played [rank] of [suit] gives X2 Mult when scored
Card changes every round	$6	Uncommon	In one hand, earn at least 1,000,000 Chips.	Xm	On Scored
128	Seeing Double
Seeing Double	X2 Mult if played hand has a scoring Club suit icon Club card and a scoring card of any other suit	$6	Uncommon	Play a hand that contains four 7 of Clubs.
Other suits that count as clubs (e.g. wild suits) with rank 7 will also count.	Xm	Indep.
129	Matador
Matador	Earn $8 if played hand triggers the Boss Blind ability	$7	Uncommon	Defeat a Boss Blind in one hand, without using discards.	+$	Indep.
130	Hit the Road
Hit the Road	This Joker gains X0.5 Mult for every Jack discarded this round
(Currently X1 Mult)	$8	Rare	Discard 5 Jacks at the same time.	Xm	Mixed
131	The Duo
The Duo	X2 Mult if played hand contains a Pair	$8	Rare	Win a run without playing a Pair.	Xm	Indep.
132	The Trio
The Trio	X3 Mult if played hand contains a Three of a Kind	$8	Rare	Win a run without playing a Three of a Kind.	Xm	Indep.
133	The Family
The Family	X4 Mult if played hand contains a Four of a Kind	$8	Rare	Win a run without playing a Four of a Kind.	Xm	Indep.
134	The Order
The Order	X3 Mult if played hand contains a Straight	$8	Rare	Win a run without playing a Straight.	Xm	Indep.
135	The Tribe
The Tribe	X2 Mult if played hand contains a Flush	$8	Rare	Win a run without playing a Flush.	Xm	Indep.
136	Stuntman
Stuntman	+250 Chips,
-2 hand size	$7	Rare	Earn at least 100 million (100,000,000) Chips in a single hand.	+c	Indep.
137	Invisible Joker
Invisible Joker	After 2 rounds, sell this card to Duplicate a random Joker
(Currently 0/2)
(Removes Negative from copy)	$8	Rare	Win a game while never having more than 4 jokers.	!!	N/A
138	Brainstorm
Brainstorm	Copies the ability of leftmost Joker	$10	Rare	Discard a Royal Flush.	!!	
139	Satellite
Satellite	Earn $1 at end of round per unique Planet card used this run	$6	Uncommon	Have at least $400.	+$	N/A
140	Shoot the Moon
Shoot the Moon	Each Queen held in hand gives +13 Mult	$5	Common	Play every Heart card in your deck in one round.	+m	On Held
141	Driver's License
Driver's License	X3 Mult if you have at least 16 Enhanced cards in your full deck
(Currently 0)	$7	Rare	Enhance 16 cards in your deck	Xm	Indep.
142	Cartomancer
Cartomancer	Create a Tarot card when Blind is selected
(Must have room)	$6	Uncommon	Discover every Tarot Card.	!!	N/A
143	Astronomer
Astronomer	All Planet cards and Celestial Packs in the shop are free	$8	Uncommon	Discover all Planet cards.	!!	N/A
144	Burnt Joker
Burnt Joker	Upgrade the level of the first discarded poker hand each round	$8	Rare	Sell 50 cards.	!!	On Discard
145	Bootstraps
Bootstraps	+2 Mult for every $5 you have
(Currently +0 Mult)	$7	Uncommon	Have at least 2 Polychrome Jokers at the same time.	+m	Indep.
146	Canio
Canio	This Joker gains X1 Mult when a face card is destroyed
(Currently X1 Mult)	N/A	Legendary	Find this Joker from the Soul card.	Xm	Indep.
147	Triboulet
Triboulet	Played Kings and Queens each give X2 Mult when scored	N/A	Legendary	Find this Joker from the Soul card.	Xm	On Scored
148	Yorick
Yorick	This Joker gains X1 Mult every 23 [23] cards discarded
(Currently X1 Mult)	N/A	Legendary	Find this Joker from the Soul card.	Xm	Mixed
149	Chicot
Chicot	Disables effect of every Boss Blind	N/A	Legendary	Find this Joker from the Soul card.	!!	N/A
150	Perkeo
Perkeo	Creates a Negative copy of 1 random consumable card in your possession at the end of the shop	N/A	Legendary	Find this Joker from the Soul card.	!!	N/A
 */

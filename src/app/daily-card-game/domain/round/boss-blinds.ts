import { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { BossBlindDefinition } from '@/app/daily-card-game/domain/round/types'

const theHook: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Hook',
  description: 'Discards 2 random cards held in hand after every played hand.',
  image: 'the-hook.png',
  minimumAnte: 1,
  baseReward: 5,
  additionalRewards: [],
  effects: [
    {
      event: { type: 'HAND_SCORING_END' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_END',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.dealtCards.splice(
          Math.floor(Math.random() * ctx.game.gamePlayState.dealtCards.length),
          2
        )
      },
    },
  ],
  score: 0,
}

const theOx: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Ox',
  description: 'Playing your most played hand this run sets money to $0',
  image: 'the-ox.png',
  minimumAnte: 6,
  baseReward: 5,
  additionalRewards: [],
  effects: [
    {
      event: { type: 'HAND_SCORING_END' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_END',
      apply: (ctx: EffectContext) => {
        ctx.game.money = 0
      },
    },
  ],
  score: 0,
}

export const bossBlinds: BossBlindDefinition[] = [theHook, theOx]

/**
 
Blind	Name	Description	Minimum Ante	Score at least...	...to earn...	Matador-compatible?
	Small Blind	No special effects - can be skipped to receive a Tag	1	1x base	$3	✗ No
	Big Blind	No special effects - can be skipped to receive a Tag	1	1.5x base	$4	✗ No
Boss Blinds
	The Hook	Discards 2 random cards held in hand after every played hand	1	2x base	$5	✗ No
	The Ox	Playing your most played hand this run sets money to $0	6	2x base	$5	✓ Yes
	The House	First hand is drawn face down	2	2x base	$5	✗ No
	The Wall	Extra large blind	2	4x base	$5	✗ No
	The Wheel	1 in 7 cards get drawn face down during the round	2	2x base	$5	✗ No
	The Arm	Decrease level of played poker hand by 1 (hand levels can go as low as Level 1, and are reduced before scoring)	2	2x base	$5	✓ Yes
	The Club	All Club cards are debuffed	1	2x base	$5	✓ Yes
	The Fish	Cards drawn face down after each hand played	2	2x base	$5	✗ No
	The Psychic	Must play 5 cards (not all cards need to score)	1	2x base	$5	✓ Yes
	The Goad	All Spade cards are debuffed	1	2x base	$5	✓ Yes
	The Water	Start with 0 discards	2	2x base	$5	✗ No
	The Window	All Diamond cards are debuffed	1	2x base	$5	✓ Yes
	The Manacle	-1 Hand Size	1	2x base	$5	✗ No
	The Eye	No repeat hand types this round (every hand played this round must be of a different type and not previously played this round)	3	2x base	$5	✓ Yes
	The Mouth	Only one hand type can be played this round	2	2x base	$5	✓ Yes
	The Plant	All face cards are debuffed	4	2x base	$5	✓ Yes
	The Serpent	After Play or Discard, always draw 3 cards (ignores hand size)	5	2x base	$5	✗ No
	The Pillar	Cards played previously this Ante (during Small and Big Blinds) are debuffed	1	2x base	$5	✓ Yes
	The Needle	Play only 1 hand	2	1x base	$5	✗ No
	The Head	All Heart cards are debuffed	1	2x base	$5	✓ Yes
	The Tooth	Lose $1 per card played	3	2x base	$5	✗ No
	The Flint	Base Chips and Mult for played poker hands are halved for the entire round	2	2x base	$5	✓ Yes
	The Mark	All face cards are drawn face down	2	2x base	$5	✗ No
Showdown Boss Blinds (only appearing at Ante 8, 16, etc.)
	Amber Acorn	Flips and shuffles all Joker cards	8	2x base	$8	✗ No
	Verdant Leaf	All cards debuffed until 1 Joker sold	8	2x base	$8	✓ Yes
frameless]	Violet Vessel	Very large blind	8	6x base	$8	✗ No
	Crimson Heart	One random Joker disabled every hand (changes every hand)	8	2x base	$8	✗ No
	Cerulean Bell	Forces 1 card to always be selected	8	2x base	$8	✗ No
 */

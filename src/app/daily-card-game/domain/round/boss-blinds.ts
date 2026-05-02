import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { getMostPlayedHand } from '@/app/daily-card-game/domain/hand/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { buildSeedString, getRandomNumberWithSeed } from '@/app/daily-card-game/domain/randomness'
import type { BossBlindDefinition } from '@/app/daily-card-game/domain/round/types'

const theHook: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Hook',
  description: 'Discards 2 random cards held in hand after every played hand.',
  image: 'the-hook.png',
  minimumAnte: 0,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_DONE_CARD_SCORING' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_DONE_CARD_SCORING',
      apply: (ctx: EffectContext) => {
        // Remove 2 random cards from hand
        const handIds = ctx.game.gamePlayState.handIds
        if (handIds.length > 0) {
          const randomIndex = Math.floor(Math.random() * handIds.length)
          handIds.splice(randomIndex, Math.min(2, handIds.length))
        }
      },
    },
  ],
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
  effects: [
    {
      event: { type: 'HAND_SCORING_FINALIZE' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_FINALIZE',
      apply: (ctx: EffectContext) => {
        const mostPlayedHand = getMostPlayedHand(ctx.game.pokerHands)
        const currentHand = ctx.game.gamePlayState.selectedHand?.[0]
        if (currentHand === mostPlayedHand.handId) {
          ctx.game.money = 0
        }
      },
    },
  ],
}

const theNeedle: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 1,
  name: 'The Needle',
  description: 'Play only 1 hand.',
  image: 'the-needle.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        ctx.game.maxHands = 1
        ctx.game.gamePlayState.remainingHands = 1
      },
    },
  ],
}

const thePillar: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Pillar',
  description: 'Cards played previously this Ante are debuffed',
  image: 'the-pillar.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        const playedThisAnte = new Set(ctx.game.gamePlayState.cardIdsPlayedThisAnte)
        ctx.game.gamePlayState.cardsToScore = ctx.game.gamePlayState.cardsToScore.filter(
          card => !playedThisAnte.has(card.id)
        )
      },
    },
  ],
}

const theSerpent: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Serpent',
  description: 'After Play or Discard, always draw 3 cards',
  image: 'the-serpent.png',
  minimumAnte: 5,
  baseReward: 5,
  effects: [],
}

const thePlant: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Plant',
  description: 'All face cards are debuffed',
  image: 'the-plant.png',
  minimumAnte: 4,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.cardsToScore = ctx.game.gamePlayState.cardsToScore.filter(
          card => !['J', 'Q', 'K'].includes(playingCards[card.playingCardId].value)
        )
      },
    },
  ],
}

const theTooth: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Tooth',
  description: 'Lose $1 per card played',
  image: 'the-tooth.png',
  minimumAnte: 3,
  baseReward: 5,
  effects: [
    {
      event: { type: 'CARD_SCORED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'CARD_SCORED',
      apply: (ctx: EffectContext) => {
        ctx.game.money = Math.max(ctx.game.minimumMoney, ctx.game.money - 1)
      },
    },
  ],
}

const theFlint: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Flint',
  description: 'Base Chips and Mult are halved',
  image: 'the-flint.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.score.chips = Math.floor(ctx.game.gamePlayState.score.chips / 2)
        ctx.game.gamePlayState.score.mult = Math.floor(ctx.game.gamePlayState.score.mult / 2)
      },
    },
  ],
}

const theMark: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Mark',
  description: 'All face cards are drawn face down',
  image: 'the-mark.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        // Flip all face cards in the entire deck face down
        for (const cardId of Object.keys(ctx.game.cards)) {
          const card = ctx.game.cards[cardId]
          if (['J', 'Q', 'K'].includes(playingCards[card.playingCardId].value)) {
            card.isFaceUp = false
          }
        }
      },
    },
  ],
}

const theMouth: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Mouth',
  description: 'Only one hand type can be played this round',
  image: 'the-mouth.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        const playedTypes = ctx.game.gamePlayState.handTypesPlayedThisRound
        if (playedTypes.length > 1 && ctx.game.gamePlayState.selectedHand?.[0] !== playedTypes[0]) {
          // Wrong hand type - zero out scoring
          ctx.game.gamePlayState.score = { chips: 0, mult: 0 }
          ctx.game.gamePlayState.cardsToScore = []
        }
      },
    },
  ],
}

const theEye: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Eye',
  description: 'No repeat hand types this round',
  image: 'the-eye.png',
  minimumAnte: 3,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        const handId = ctx.game.gamePlayState.selectedHand?.[0]
        if (!handId) return
        const playedTypes = ctx.game.gamePlayState.handTypesPlayedThisRound
        // Count how many times this hand type appears (including current)
        const count = playedTypes.filter(t => t === handId).length
        if (count > 1) {
          // Repeated hand type - zero out scoring
          ctx.game.gamePlayState.score = { chips: 0, mult: 0 }
          ctx.game.gamePlayState.cardsToScore = []
        }
      },
    },
  ],
}

const theManacle: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Manacle',
  description: '-1 Hand Size',
  image: 'the-manacle.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        ctx.game.handSizeModifier -= 1
      },
    },
  ],
}

const theWater: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Water',
  description: 'Start with 0 discards',
  image: 'the-water.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.remainingDiscards = 0
      },
    },
  ],
}

const thePsychic: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Psychic',
  description: 'Must play 5 cards',
  image: 'the-psychic.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        if (ctx.game.gamePlayState.playedCardIds.length < 5) {
          ctx.game.gamePlayState.score = { chips: 0, mult: 0 }
          ctx.game.gamePlayState.cardsToScore = []
        }
      },
    },
  ],
}

const theArm: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Arm',
  description: 'Decrease level of played poker hand by 1',
  image: 'the-arm.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        const handId = ctx.game.gamePlayState.selectedHand?.[0]
        if (!handId) return
        if (ctx.game.pokerHands[handId].level > 1) {
          ctx.game.pokerHands[handId].level -= 1
        }
      },
    },
  ],
}

const theWheel: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Wheel',
  description: '1 in 7 cards get drawn face down',
  image: 'the-wheel.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        for (const cardId of Object.keys(ctx.game.cards)) {
          const seed = buildSeedString([ctx.game.gameSeed, cardId, 'wheel'])
          const roll = getRandomNumberWithSeed(seed, 1, 7)
          if (roll === 1) {
            ctx.game.cards[cardId].isFaceUp = false
          }
        }
      },
    },
  ],
}

const theHead: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Head',
  description: 'All Heart cards are debuffed',
  image: 'the-head.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.cardsToScore = ctx.game.gamePlayState.cardsToScore.filter(
          card => playingCards[card.playingCardId].suit !== 'hearts'
        )
      },
    },
  ],
}

const theWindow: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Window',
  description: 'All Diamond cards are debuffed',
  image: 'the-window.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.cardsToScore = ctx.game.gamePlayState.cardsToScore.filter(
          card => playingCards[card.playingCardId].suit !== 'diamonds'
        )
      },
    },
  ],
}

const theGoad: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Goad',
  description: 'All Spade cards are debuffed',
  image: 'the-goad.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.cardsToScore = ctx.game.gamePlayState.cardsToScore.filter(
          card => playingCards[card.playingCardId].suit !== 'spades'
        )
      },
    },
  ],
}

const theClub: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Club',
  description: 'All Club cards are debuffed',
  image: 'the-club.png',
  minimumAnte: 1,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        ctx.game.gamePlayState.cardsToScore = ctx.game.gamePlayState.cardsToScore.filter(
          card => playingCards[card.playingCardId].suit !== 'clubs'
        )
      },
    },
  ],
}

const theWall: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 4,
  name: 'The Wall',
  description: 'Extra large blind',
  image: 'the-wall.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [],
}

const theHouse: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The House',
  description: 'First hand is drawn face down',
  image: 'the-house.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        for (const cardId of Object.keys(ctx.game.cards)) {
          ctx.game.cards[cardId].isFaceUp = false
        }
      },
    },
  ],
}

const theFish: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'The Fish',
  description: 'Cards drawn face down after each hand played',
  image: 'the-fish.png',
  minimumAnte: 2,
  baseReward: 5,
  effects: [
    {
      event: { type: 'HAND_SCORING_DONE_CARD_SCORING' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_DONE_CARD_SCORING',
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.handIds) {
          if (ctx.game.cards[cardId]) {
            ctx.game.cards[cardId].isFaceUp = false
          }
        }
      },
    },
  ],
}

const violetVessel: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 6,
  name: 'Violet Vessel',
  description: 'Very large blind',
  image: 'violet-vessel.png',
  minimumAnte: 8,
  baseReward: 8,
  effects: [],
}

const amberAcorn: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'Amber Acorn',
  description: 'Flips and shuffles all Joker cards',
  image: 'amber-acorn.png',
  minimumAnte: 8,
  baseReward: 8,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        // Flip all jokers face down
        for (const joker of ctx.game.jokers) {
          joker.isFaceUp = false
        }
        // Shuffle jokers deterministically
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'amber-acorn'])
        for (let i = ctx.game.jokers.length - 1; i > 0; i--) {
          const j = getRandomNumberWithSeed(
            buildSeedString([seed, String(i)]),
            0,
            i
          )
          ;[ctx.game.jokers[i], ctx.game.jokers[j]] = [ctx.game.jokers[j], ctx.game.jokers[i]]
        }
      },
    },
  ],
}

const crimsonHeart: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'Crimson Heart',
  description: 'One random Joker disabled every hand',
  image: 'crimson-heart.png',
  minimumAnte: 8,
  baseReward: 8,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        // First, re-enable all jokers (reset from last hand)
        for (const joker of ctx.game.jokers) {
          joker.isFaceUp = true
        }
        // Then disable one random joker
        if (ctx.game.jokers.length > 0) {
          const seed = buildSeedString([
            ctx.game.gameSeed,
            ctx.game.handsPlayed.toString(),
            'crimson-heart',
          ])
          const randomIndex = getRandomNumberWithSeed(seed, 0, ctx.game.jokers.length - 1)
          ctx.game.jokers[randomIndex].isFaceUp = false
        }
      },
    },
  ],
}

const ceruleanBell: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'Cerulean Bell',
  description: 'Forces 1 card to always be selected',
  image: 'cerulean-bell.png',
  minimumAnte: 8,
  baseReward: 8,
  effects: [
    {
      event: { type: 'BOSS_BLIND_SELECTED' },
      priority: 1,
      condition: (ctx: EffectContext) => ctx.event.type === 'BOSS_BLIND_SELECTED',
      apply: (ctx: EffectContext) => {
        // Force-select a random card from owned cards (hand isn't dealt yet at this point)
        const cardIds = ctx.game.ownedCardIds
        if (cardIds.length > 0) {
          const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'cerulean-bell'])
          const randomIndex = getRandomNumberWithSeed(seed, 0, cardIds.length - 1)
          const forcedCardId = cardIds[randomIndex]
          if (!ctx.game.gamePlayState.selectedCardIds.includes(forcedCardId)) {
            ctx.game.gamePlayState.selectedCardIds.push(forcedCardId)
          }
        }
      },
    },
  ],
}

const verdantLeaf: BossBlindDefinition = {
  type: 'bossBlind',
  status: 'notStarted',
  anteMultiplier: 2,
  name: 'Verdant Leaf',
  description: 'All cards debuffed until 1 Joker sold',
  image: 'verdant-leaf.png',
  minimumAnte: 8,
  baseReward: 8,
  effects: [
    {
      event: { type: 'HAND_SCORING_START' },
      priority: 0,
      condition: (ctx: EffectContext) => ctx.event.type === 'HAND_SCORING_START',
      apply: (ctx: EffectContext) => {
        // Debuff all cards (clear cardsToScore) - player must sell a joker to lift this
        // In the actual game flow, selling a joker happens before gameplay starts
        // This effect stays active for the entire boss blind round
        ctx.game.gamePlayState.cardsToScore = []
        ctx.game.gamePlayState.score = { chips: 0, mult: 0 }
      },
    },
  ],
}

export const bossBlinds: BossBlindDefinition[] = [theHook, theOx, theNeedle, thePillar, theSerpent, thePlant, theTooth, theFlint, theMark, theMouth, theEye, theManacle, theWater, thePsychic, theArm, theWheel, theHead, theWindow, theGoad, theClub, theWall, theHouse, theFish, violetVessel, amberAcorn, crimsonHeart, ceruleanBell, verdantLeaf]

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

export const getRandomBossBlind = (ante: number, seed: string): BossBlindDefinition => {
  const bossBlindsForAnte = bossBlinds.filter(blind => blind.minimumAnte <= ante)
  const randomIndex = getRandomNumberWithSeed(seed, 0, bossBlindsForAnte.length - 1)

  if (bossBlindsForAnte.length === 0) {
    throw new Error(`No boss blind found for ante ${ante}`)
  }

  return bossBlindsForAnte[randomIndex]
}

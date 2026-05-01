import { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { removeOwnedCard } from '@/app/daily-card-game/domain/game/card-registry-utils'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import {
  buildSeedString,
  getRandomNumbersWithSeed,
} from '@/app/daily-card-game/domain/randomness'

import { TarotCardDefinition } from './types'

const theFool: TarotCardDefinition = {
  type: 'tarotCard',
  price: 2,
  tarotType: 'theFool',
  name: 'The Fool',
  description: 'Creates a copy of the last Tarot or Planet card used.',
  isPlayable: (game: GameState) => {
    // Find the most recent tarot/celestial card
    const lastCard = game.consumablesUsed.findLast(
      consumable =>
        consumable.consumableType === 'tarotCard' || consumable.consumableType === 'celestialCard'
    )
    // The Fool is only playable if:
    // 1. There is a previous card used
    // 2. The most recent card is NOT The Fool (can't use Fool twice in a row)
    // 3. There is at least one non-Fool card in history to copy
    if (!lastCard) return false
    if (lastCard.consumableType === 'tarotCard' && lastCard.tarotType === 'theFool') return false
    return true
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // Find the last tarot/celestial that isn't The Fool (to skip The Fool itself if it was just used)
        const lastTarotOrCelestialCard = ctx.game.consumablesUsed.findLast(
          consumable =>
            (consumable.consumableType === 'tarotCard' ||
              consumable.consumableType === 'celestialCard') &&
            !(consumable.consumableType === 'tarotCard' && consumable.tarotType === 'theFool')
        )
        if (lastTarotOrCelestialCard) {
          ctx.game.consumables.push(lastTarotOrCelestialCard)
        }
      },
    },
  ],
}

const theMagician: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theMagician',
  name: 'The Magician',
  price: 2,
  description: 'Enhances 2 selected cards to Lucky Cards',
  isPlayable: (game: GameState) => {
    const numberOfSelectedCards = game.gamePlayState.selectedCardIds.length
    return numberOfSelectedCards === 2 || numberOfSelectedCards === 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        // With ID-based architecture, we only need to update the card once in the registry
        // The change is automatically visible everywhere the card is referenced
        for (const cardId of ctx.game.gamePlayState.selectedCardIds) {
          const card = ctx.game.cards[cardId]
          if (card) {
            card.flags.enchantment = 'lucky'
          }
        }
        return
      },
    },
  ],
}

const theHermit: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theHermit',
  name: 'The Hermit',
  price: 2,
  description: 'Doubles your money (max $20 gain)',
  isPlayable: () => true,
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const gain = Math.min(Math.max(ctx.game.money, 0), 20)
        ctx.game.money += gain
      },
    },
  ],
}

const temperance: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'temperance',
  name: 'Temperance',
  price: 2,
  description: 'Gives the total sell value of all current Jokers (max $50)',
  isPlayable: () => true,
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const totalSellValue = ctx.game.jokers.reduce((sum, jokerState) => {
          const jokerDef = jokers[jokerState.jokerId]
          if (!jokerDef) return sum
          return sum + jokerDef.price + jokerState.bonusSellValue
        }, 0)
        const gain = Math.min(totalSellValue, 50)
        ctx.game.money += gain
      },
    },
  ],
}

const theTower: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theTower',
  name: 'The Tower',
  price: 2,
  description: 'Enhances 1 selected card to a Stone card',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const cardId = ctx.game.gamePlayState.selectedCardIds[0]
        const card = ctx.game.cards[cardId]
        if (card) {
          card.flags.enchantment = 'stone'
        }
      },
    },
  ],
}

const theDevil: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theDevil',
  name: 'The Devil',
  price: 2,
  description: 'Enhances 1 selected card to a Gold card',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const cardId = ctx.game.gamePlayState.selectedCardIds[0]
        const card = ctx.game.cards[cardId]
        if (card) {
          card.flags.enchantment = 'gold'
        }
      },
    },
  ],
}

const justice: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'justice',
  name: 'Justice',
  price: 2,
  description: 'Enhances 1 selected card to a Glass card',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const cardId = ctx.game.gamePlayState.selectedCardIds[0]
        const card = ctx.game.cards[cardId]
        if (card) {
          card.flags.enchantment = 'glass'
        }
      },
    },
  ],
}

const theChariot: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theChariot',
  name: 'The Chariot',
  price: 2,
  description: 'Enhances 1 selected card to a Steel card',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const cardId = ctx.game.gamePlayState.selectedCardIds[0]
        const card = ctx.game.cards[cardId]
        if (card) {
          card.flags.enchantment = 'steel'
        }
      },
    },
  ],
}

const theLovers: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theLovers',
  name: 'The Lovers',
  price: 2,
  description: 'Enhances 1 selected card to a Wild card',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const cardId = ctx.game.gamePlayState.selectedCardIds[0]
        const card = ctx.game.cards[cardId]
        if (card) {
          card.flags.enchantment = 'wild'
        }
      },
    },
  ],
}

const theEmpress: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theEmpress',
  name: 'The Empress',
  price: 2,
  description: 'Enhances up to 2 selected cards to Mult cards',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 2)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            card.flags.enchantment = 'mult'
          }
        }
      },
    },
  ],
}

const theHierophant: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theHierophant',
  name: 'The Hierophant',
  price: 2,
  description: 'Enhances up to 2 selected cards to Bonus cards',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 2)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            card.flags.enchantment = 'bonus'
          }
        }
      },
    },
  ],
}

const theStar: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theStar',
  name: 'The Star',
  price: 2,
  description: 'Converts suit of up to 3 selected cards to Diamonds',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 3)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            const cardDef = playingCards[card.playingCardId]
            if (cardDef) {
              card.playingCardId = `${cardDef.value}_diamonds`
            }
          }
        }
      },
    },
  ],
}

const theMoon: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theMoon',
  name: 'The Moon',
  price: 2,
  description: 'Converts suit of up to 3 selected cards to Clubs',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 3)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            const cardDef = playingCards[card.playingCardId]
            if (cardDef) {
              card.playingCardId = `${cardDef.value}_clubs`
            }
          }
        }
      },
    },
  ],
}

const theSun: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theSun',
  name: 'The Sun',
  price: 2,
  description: 'Converts suit of up to 3 selected cards to Hearts',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 3)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            const cardDef = playingCards[card.playingCardId]
            if (cardDef) {
              card.playingCardId = `${cardDef.value}_hearts`
            }
          }
        }
      },
    },
  ],
}

const theWorld: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theWorld',
  name: 'The World',
  price: 2,
  description: 'Converts suit of up to 3 selected cards to Spades',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 3)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            const cardDef = playingCards[card.playingCardId]
            if (cardDef) {
              card.playingCardId = `${cardDef.value}_spades`
            }
          }
        }
      },
    },
  ],
}

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const

const strength: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'strength',
  name: 'Strength',
  price: 2,
  description: 'Increases rank of up to 2 selected cards by 1',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 2)) {
          const card = ctx.game.cards[cardId]
          if (card) {
            const cardDef = playingCards[card.playingCardId]
            if (cardDef) {
              const currentIndex = RANK_ORDER.indexOf(cardDef.value as (typeof RANK_ORDER)[number])
              const nextIndex = (currentIndex + 1) % RANK_ORDER.length
              const newValue = RANK_ORDER[nextIndex]
              const suit = cardDef.suit
              card.playingCardId = `${newValue}_${suit}`
            }
          }
        }
      },
    },
  ],
}

const judgement: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'judgement',
  name: 'Judgement',
  price: 2,
  description: 'Creates a random Joker card (must have room)',
  isPlayable: (game: GameState) => game.jokers.length < game.maxJokers,
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        if (ctx.game.jokers.length >= ctx.game.maxJokers) return
        const allJokerDefs = Object.values(jokers)
        const seed = buildSeedString([
          ctx.game.gameSeed,
          ctx.game.roundIndex.toString(),
          'judgement',
        ])
        const indices = getRandomNumbersWithSeed({
          seed,
          min: 0,
          max: allJokerDefs.length - 1,
          numberOfNumbers: 1,
        })
        const jokerDef = allJokerDefs[indices[0]]
        const jokerState = initializeJoker(jokerDef, ctx.game)
        ctx.game.jokers.push(jokerState)
      },
    },
  ],
}

const theHangedMan: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theHangedMan',
  name: 'The Hanged Man',
  price: 2,
  description: 'Destroys up to 2 selected cards',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 1
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const cardId of ctx.game.gamePlayState.selectedCardIds.slice(0, 2)) {
          removeOwnedCard(ctx.game, cardId)
        }
        ctx.game.gamePlayState.selectedCardIds = []
      },
    },
  ],
}

const death: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'death',
  name: 'Death',
  price: 2,
  description: 'Converts the left selected card into the right selected card',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.selectedCardIds.length >= 2
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const [leftCardId, rightCardId] = ctx.game.gamePlayState.selectedCardIds
        const leftCard = ctx.game.cards[leftCardId]
        const rightCard = ctx.game.cards[rightCardId]
        if (leftCard && rightCard) {
          leftCard.playingCardId = rightCard.playingCardId
          leftCard.flags = { ...rightCard.flags }
          leftCard.bonusChips = rightCard.bonusChips
        }
      },
    },
  ],
}

const wheelOfFortune: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'wheelOfFortune',
  name: 'Wheel of Fortune',
  price: 2,
  description: '1 in 4 chance to add Foil, Holographic, or Polychrome edition to a random Joker',
  isPlayable: (game: GameState) => {
    return game.jokers.some(joker => joker.edition === 'normal')
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const rollSeed = buildSeedString([
          ctx.game.gameSeed,
          ctx.game.roundIndex.toString(),
          'wheelOfFortune',
          'roll',
        ])
        const [roll] = getRandomNumbersWithSeed({ seed: rollSeed, min: 1, max: 4, numberOfNumbers: 1 })
        if (roll !== 1) return

        const normalJokers = ctx.game.jokers.filter(joker => joker.edition === 'normal')
        if (normalJokers.length === 0) return

        const jokerSeed = buildSeedString([
          ctx.game.gameSeed,
          ctx.game.roundIndex.toString(),
          'wheelOfFortune',
          'joker',
        ])
        const [jokerIdx] = getRandomNumbersWithSeed({
          seed: jokerSeed,
          min: 0,
          max: normalJokers.length - 1,
          numberOfNumbers: 1,
        })
        const targetJoker = normalJokers[jokerIdx]

        const editions = ['foil', 'holographic', 'polychrome'] as const
        const editionSeed = buildSeedString([
          ctx.game.gameSeed,
          ctx.game.roundIndex.toString(),
          'wheelOfFortune',
          'edition',
        ])
        const [editionIdx] = getRandomNumbersWithSeed({
          seed: editionSeed,
          min: 0,
          max: editions.length - 1,
          numberOfNumbers: 1,
        })
        targetJoker.edition = editions[editionIdx]
      },
    },
  ],
}

const notImplemented: TarotCardDefinition = {
  price: 2,
  type: 'tarotCard',
  tarotType: 'notImplemented',
  name: 'Not Implemented',
  description: 'Not implemented',
  isPlayable: () => false,
  effects: [],
}

export const tarotCards: Record<TarotCardDefinition['tarotType'], TarotCardDefinition> = {
  notImplemented,
  theFool,
  theMagician,
  theHighPriestess: notImplemented,
  theEmpress,
  theEmperor: notImplemented,
  theHierophant,
  theLovers,
  theChariot,
  strength,
  theHermit,
  wheelOfFortune,
  justice,
  theHangedMan,
  death,
  temperance,
  theDevil,
  theTower,
  theStar,
  theMoon,
  theSun,
  judgement,
  theWorld,
}

export const implementedTarotCards: Record<TarotCardDefinition['tarotType'], TarotCardDefinition> =
  Object.fromEntries(
    Object.entries(tarotCards).filter(entry => entry[1].tarotType !== 'notImplemented')
  ) as Record<TarotCardDefinition['tarotType'], TarotCardDefinition>

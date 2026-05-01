import { EffectContext } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'

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
  theEmpress: notImplemented,
  theEmperor: notImplemented,
  theHierophant: notImplemented,
  theLovers: notImplemented,
  theChariot: notImplemented,
  strength: notImplemented,
  theHermit,
  wheelOfFortune: notImplemented,
  justice,
  theHangedMan: notImplemented,
  death: notImplemented,
  temperance,
  theDevil,
  theTower,
  theStar: notImplemented,
  theMoon: notImplemented,
  theSun: notImplemented,
  judgement: notImplemented,
  theWorld: notImplemented,
}

export const implementedTarotCards: Record<TarotCardDefinition['tarotType'], TarotCardDefinition> =
  Object.fromEntries(
    Object.entries(tarotCards).filter(entry => entry[1].tarotType !== 'notImplemented')
  ) as Record<TarotCardDefinition['tarotType'], TarotCardDefinition>

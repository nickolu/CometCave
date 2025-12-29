import { EffectContext } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

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
            (consumable.consumableType === 'tarotCard' || consumable.consumableType === 'celestialCard') &&
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
        for (const cardId of ctx.game.gamePlayState.selectedCardIds) {
          const fullDeckCard = ctx.game.fullDeck.find(fullDeckCard => fullDeckCard.id === cardId)
          const handCard = ctx.game.gamePlayState.dealtCards.find(
            handCard => handCard.id === cardId
          )
          const remainingDeckCard = ctx.game.gamePlayState.remainingDeck.find(
            remainingDeckCard => remainingDeckCard.id === cardId
          )

          if (fullDeckCard) {
            fullDeckCard.flags.enchantment = 'lucky'
          }
          if (handCard) {
            handCard.flags.enchantment = 'lucky'
          }
          if (remainingDeckCard) {
            remainingDeckCard.flags.enchantment = 'lucky'
          }
        }
        return
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
  theHermit: notImplemented,
  wheelOfFortune: notImplemented,
  justice: notImplemented,
  theHangedMan: notImplemented,
  death: notImplemented,
  temperance: notImplemented,
  theDevil: notImplemented,
  theTower: notImplemented,
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

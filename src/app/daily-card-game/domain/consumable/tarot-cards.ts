import { EffectContext } from '../events/types'
import { GameState } from '@/app/daily-card-game/domain/game/types'
import { TarotCardDefinition } from './types'
import { findLastTarotOrCelestialCard } from './utils'

const theFool: TarotCardDefinition = {
  type: 'tarotCard',
  tarotType: 'theFool',
  name: 'The Fool',
  description: 'Creates a copy of the last Tarot or Planet card used.',
  isPlayable: (game: GameState) => {
    const lastTarotOrCelestialCard = findLastTarotOrCelestialCard(game.consumablesUsed)
    if (!lastTarotOrCelestialCard) {
      return false
    }
    if (
      lastTarotOrCelestialCard.consumableType === 'tarotCard' &&
      tarotCards[lastTarotOrCelestialCard.tarotType] &&
      lastTarotOrCelestialCard.tarotType === 'theFool'
    ) {
      return false
    }
    return true
  },
  effects: [
    {
      event: { type: 'TAROT_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const lastTarotOrCelestialCard = findLastTarotOrCelestialCard(ctx.game.consumablesUsed)
        if (
          lastTarotOrCelestialCard &&
          lastTarotOrCelestialCard.consumableType === 'tarotCard' &&
          lastTarotOrCelestialCard.tarotType !== 'theFool'
        ) {
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
        console.log('tarot effect applied')
        for (const cardId of ctx.game.gamePlayState.selectedCardIds) {
          console.log('tarot card used for card', cardId)
          const fullDeckCard = ctx.game.fullDeck.find(fullDeckCard => fullDeckCard.id === cardId)
          const handCard = ctx.game.gamePlayState.dealtCards.find(
            handCard => handCard.id === cardId
          )
          const remainingDeckCard = ctx.game.gamePlayState.remainingDeck.find(
            remainingDeckCard => remainingDeckCard.id === cardId
          )

          if (fullDeckCard) {
            console.log('fullDeckCard', fullDeckCard)
            fullDeckCard.flags.enchantment = 'lucky'
          }
          if (handCard) {
            console.log('handCard', handCard)
            handCard.flags.enchantment = 'lucky'
          }
          if (remainingDeckCard) {
            console.log('remainingDeckCard', remainingDeckCard)
            remainingDeckCard.flags.enchantment = 'lucky'
          }
        }
        return
      },
    },
  ],
}

const notImplemented: TarotCardDefinition = {
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

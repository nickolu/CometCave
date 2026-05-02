import { EffectContext } from '@/app/daily-card-game/domain/events/types'
import {
  addOwnedCard,
  removeOwnedCard,
} from '@/app/daily-card-game/domain/game/card-registry-utils'
import { GameState } from '@/app/daily-card-game/domain/game/types'
import { getRandomRareJoker, initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import {
  getRandomEnchantment,
  getRandomPlayingCardsWithFilters,
  initializePlayingCard,
} from '@/app/daily-card-game/domain/playing-card/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { buildSeedString, getRandomNumberWithSeed, uuid } from '@/app/daily-card-game/domain/randomness'

import { SpectralCardDefinition, SpectralCardType } from './types'

const familiar: SpectralCardDefinition = {
  spectralType: 'familiar',
  name: 'Familiar',
  description: 'Destroy 1 random card in your hand, but add 3 random Enhanced face cards instead.',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.handIds.length > 0
  },
  effects: [
    {
      event: {
        type: 'SPECTRAL_CARD_USED',
      },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const destructionSeed = buildSeedString([
          ctx.game.gameSeed,
          ctx.game.roundIndex.toString(),
          'destruction',
        ])

        // Generate 3 random enhanced face cards
        const randomCards = getRandomPlayingCardsWithFilters({
          game: ctx.game,
          numberOfCards: 3,
          values: ['J', 'Q', 'K'],
        })
        const playingCardsToAdd = randomCards.map(card => {
          const cardState = initializePlayingCard(card, ctx.game, true)
          cardState.flags.enchantment =
            cardState.flags.enchantment === 'none'
              ? getRandomEnchantment(ctx.game, card.id, true)
              : cardState.flags.enchantment
          return cardState
        })

        // Select a random card from hand to remove
        const randomCardToRemoveIndex = getRandomNumberWithSeed(
          destructionSeed,
          0,
          ctx.game.gamePlayState.handIds.length - 1
        )
        const cardToRemoveId = ctx.game.gamePlayState.handIds[randomCardToRemoveIndex]

        // Remove the card from everywhere (registry, owned, hand, draw pile)
        removeOwnedCard(ctx.game, cardToRemoveId)

        // Add new cards to the game
        playingCardsToAdd.forEach(card => {
          // Add to registry and owned cards
          addOwnedCard(ctx.game, card)
          // Also add to current hand so they're immediately available
          ctx.game.gamePlayState.handIds.push(card.id)
        })
      },
    },
  ],
}

const grim: SpectralCardDefinition = {
  spectralType: 'grim',
  name: 'Grim',
  description: 'Destroy 1 random card in your hand, but add 2 random Enhanced Aces instead.',
  isPlayable: (game: GameState) => game.gamePlayState.handIds.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const destructionSeed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'grim'])
        const randomCards = getRandomPlayingCardsWithFilters({ game: ctx.game, numberOfCards: 2, values: ['A'] })
        const cardsToAdd = randomCards.map(card => {
          const cardState = initializePlayingCard(card, ctx.game, true)
          cardState.flags.enchantment = cardState.flags.enchantment === 'none'
            ? getRandomEnchantment(ctx.game, card.id, true) : cardState.flags.enchantment
          return cardState
        })
        const randomIdx = getRandomNumberWithSeed(destructionSeed, 0, ctx.game.gamePlayState.handIds.length - 1)
        removeOwnedCard(ctx.game, ctx.game.gamePlayState.handIds[randomIdx])
        cardsToAdd.forEach(card => { addOwnedCard(ctx.game, card); ctx.game.gamePlayState.handIds.push(card.id) })
      },
    },
  ],
}

const incantation: SpectralCardDefinition = {
  spectralType: 'incantation',
  name: 'Incantation',
  description:
    'Destroy 1 random card in your hand, but add 4 random Enhanced numbered cards instead.',
  effects: [],
}

const talisman: SpectralCardDefinition = {
  spectralType: 'talisman',
  name: 'Talisman',
  description: 'Add a Gold Seal to 1 selected card.',
  effects: [],
}

const aura: SpectralCardDefinition = {
  spectralType: 'aura',
  name: 'Aura',
  description:
    'Add Foil, Holographic, or Polychrome edition (determined at random) to 1 selected card in hand.',
  effects: [],
}

const wraith: SpectralCardDefinition = {
  spectralType: 'wraith',
  name: 'Wraith',
  description: 'Creates a random Rare Joker (must have room), but sets money to $0.',
  isPlayable: (game: GameState) => game.jokers.length < game.maxJokers,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        if (ctx.game.jokers.length >= ctx.game.maxJokers) return
        const rareJokerDef = getRandomRareJoker(ctx.game)
        if (rareJokerDef) {
          const jokerState = initializeJoker(rareJokerDef, ctx.game)
          ctx.game.jokers.push(jokerState)
        }
        ctx.game.money = 0
      },
    },
  ],
}

const sigil: SpectralCardDefinition = {
  spectralType: 'sigil',
  name: 'Sigil',
  description: 'Converts all cards in hand to a single random suit.',
  isPlayable: (game: GameState) => game.gamePlayState.handIds.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'sigil'])
        const roll = getRandomNumberWithSeed(seed, 0, suits.length - 1)
        const targetSuit = suits[roll]

        for (const cardId of ctx.game.gamePlayState.handIds) {
          const cardState = ctx.game.cards[cardId]
          if (!cardState || !('playingCardId' in cardState)) continue
          const cardDef = playingCards[cardState.playingCardId]
          if (!cardDef) continue
          cardState.playingCardId = `${cardDef.value}_${targetSuit}` as any
        }
      },
    },
  ],
}

const ouija: SpectralCardDefinition = {
  spectralType: 'ouija',
  name: 'Ouija',
  description: 'Converts all cards in hand to a single random rank, but -1 Hand Size.',
  isPlayable: (game: GameState) => game.gamePlayState.handIds.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const allValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'ouija'])
        const roll = getRandomNumberWithSeed(seed, 0, allValues.length - 1)
        const targetValue = allValues[roll]

        for (const cardId of ctx.game.gamePlayState.handIds) {
          const cardState = ctx.game.cards[cardId]
          if (!cardState || !('playingCardId' in cardState)) continue
          const cardDef = playingCards[cardState.playingCardId]
          if (!cardDef) continue
          cardState.playingCardId = `${targetValue}_${cardDef.suit}` as any
        }

        ctx.game.handSizeModifier -= 1
      },
    },
  ],
}

const ectoplasm: SpectralCardDefinition = {
  spectralType: 'ectoplasm',
  name: 'Ectoplasm',
  description:
    'Add Negative to a random Joker, but -1 Hand Size, plus another -1 hand size for each time Ectoplasm has been used this run, e.g. using Ectoplasm 3 times in the same run decreases hand size by a total of 6 (1+2+3)',
  isPlayable: (game: GameState) => game.jokers.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const nonNegativeJokers = ctx.game.jokers.filter(j => j.edition !== 'negative')
        if (nonNegativeJokers.length === 0) return

        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'ectoplasm'])
        const idx = getRandomNumberWithSeed(seed, 0, nonNegativeJokers.length - 1)
        nonNegativeJokers[idx].edition = 'negative'

        ctx.game.handSizeModifier -= 1
      },
    },
  ],
}

const immolate: SpectralCardDefinition = {
  spectralType: 'immolate',
  name: 'Immolate',
  description: 'Destroys 5 random cards in hand, but gain $20.',
  isPlayable: (game: GameState) => game.gamePlayState.handIds.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const handIds = [...ctx.game.gamePlayState.handIds]
        const cardsToDestroy = Math.min(5, handIds.length)

        const remaining = [...handIds]
        for (let i = 0; i < cardsToDestroy && remaining.length > 0; i++) {
          const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'immolate', i.toString()])
          const idx = getRandomNumberWithSeed(seed, 0, remaining.length - 1)
          removeOwnedCard(ctx.game, remaining[idx])
          remaining.splice(idx, 1)
        }

        ctx.game.money += 20
      },
    },
  ],
}

const ankh: SpectralCardDefinition = {
  spectralType: 'ankh',
  name: 'Ankh',
  description:
    'Creates a copy of 1 of your Jokers at random, then destroys the others, leaving you with two identical Jokers. (Editions are also copied, except Negative)',
  isPlayable: (game: GameState) => game.jokers.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        if (ctx.game.jokers.length === 0) return

        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'ankh'])
        const idx = getRandomNumberWithSeed(seed, 0, ctx.game.jokers.length - 1)
        const chosen = ctx.game.jokers[idx]

        const copy = {
          ...chosen,
          id: uuid(),
          edition: chosen.edition === 'negative' ? 'normal' as const : chosen.edition,
        }

        ctx.game.jokers = [chosen, copy]
      },
    },
  ],
}

const dejaVu: SpectralCardDefinition = {
  spectralType: 'dejaVu',
  name: 'Deja Vu',
  description: 'Adds a Red Seal to 1 selected card.',
  effects: [],
}

const hex: SpectralCardDefinition = {
  spectralType: 'hex',
  name: 'Hex',
  description: 'Adds Polychrome to a random Joker, and destroys the rest.',
  isPlayable: (game: GameState) => game.jokers.length > 0,
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        if (ctx.game.jokers.length === 0) return
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString(), 'hex'])
        const idx = getRandomNumberWithSeed(seed, 0, ctx.game.jokers.length - 1)
        const chosen = ctx.game.jokers[idx]
        chosen.edition = 'polychrome'
        ctx.game.jokers = [chosen]
      },
    },
  ],
}

const trance: SpectralCardDefinition = {
  spectralType: 'trance',
  name: 'Trance',
  description: 'Adds a Blue Seal to 1 selected card.',
  effects: [],
}

const medium: SpectralCardDefinition = {
  spectralType: 'medium',
  name: 'Medium',
  description: 'Adds a Purple Seal to 1 selected card.',
  effects: [],
}

const cryptid: SpectralCardDefinition = {
  spectralType: 'cryptid',
  name: 'Cryptid',
  description:
    'Creates 2 exact copies (including Enhancements, Editions and Seals) of a selected card in your hand.',
  effects: [],
}

const theSoul: SpectralCardDefinition = {
  spectralType: 'theSoul',
  name: 'The Soul',
  description: 'Creates a Legendary Joker.',
  effects: [],
}

const blackHole: SpectralCardDefinition = {
  spectralType: 'blackHole',
  name: 'Black Hole',
  description:
    'Upgrades every poker hand (including secret hands not yet discovered) by one level.',
  effects: [
    {
      event: { type: 'SPECTRAL_CARD_USED' },
      priority: 1,
      apply: (ctx: EffectContext) => {
        for (const handId of Object.keys(ctx.game.pokerHands)) {
          const hand = ctx.game.pokerHands[handId as keyof typeof ctx.game.pokerHands]
          hand.level += 1
        }
      },
    },
  ],
}

export const spectralCards: Record<SpectralCardType, SpectralCardDefinition> = {
  familiar,
  grim,
  incantation,
  talisman,
  aura,
  wraith,
  sigil,
  ouija,
  ectoplasm,
  immolate,
  ankh,
  dejaVu,
  hex,
  trance,
  medium,
  cryptid,
  theSoul,
  blackHole,
}
export const implementedSpectralCards: Partial<typeof spectralCards> = {
  familiar,
  blackHole,
  wraith,
  immolate,
  ectoplasm,
  sigil,
  ouija,
  ankh,
  grim,
  hex,
}

/**
 * List of Spectral Cards
Spectral Card	Name	Effect
Spectral Familiar
Familiar	Destroy 1 random card in your hand, but add 3 random Enhanced face cards instead.
Spectral Grim
Grim	Destroy 1 random card in your hand, but add 2 random Enhanced Aces instead.
Spectral Incantation
Incantation	Destroy 1 random card in your hand, but add 4 random Enhanced numbered cards instead.
Spectral Talisman
Talisman	Add a Gold Seal to 1 selected card.
Spectral Aura
Aura	Add Foil, Holographic, or Polychrome edition (determined at random) to 1 selected card in hand.
Spectral Wraith
Wraith	Creates a random Rare Joker (must have room), but sets money to $0.
Spectral Sigil
Sigil	Converts all cards in hand to a single random suit.
Spectral Ouija
Ouija	Converts all cards in hand to a single random rank, but -1 Hand Size.
Spectral Ectoplasm
Ectoplasm	Add Negative to a random Joker, but -1 Hand Size, plus another -1 hand size for each time Ectoplasm has been used this run, e.g. using Ectoplasm 3 times in the same run decreases hand size by a total of 6 (1+2+3)
Spectral Immolate
Immolate	Destroys 5 random cards in hand, but gain $20.
Spectral Ankh
Ankh	Creates a copy of 1 of your Jokers at random, then destroys the others, leaving you with two identical Jokers. (Editions are also copied, except Negative)
Spectral Deja Vu
Deja Vu	Adds a Red Seal to 1 selected card.
Spectral Hex
Hex	Adds Polychrome to a random Joker, and destroys the rest.
Spectral Trance
Trance	Adds a Blue Seal to 1 selected card.
Spectral Medium
Medium	Adds a Purple Seal to 1 selected card.
Spectral Cryptid
Cryptid	Creates 2 exact copies (including Enhancements, Editions and Seals) of a selected card in your hand.
Spectral The Soul
The Soul	Creates a Legendary Joker.
(Must have room)


Artwork: This card is animated, with the gem beating like a heart, or perhaps something inside is trying to break out...

Spectral Black Hole
Black Hole	Upgrades every poker hand (including secret hands not yet discovered) by one level.

 */

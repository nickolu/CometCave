import { EffectContext } from '@/app/daily-card-game/domain/events/types'
import { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  getRandomEnchantment,
  getRandomPlayingCardsWithFilters,
  initializePlayingCard,
} from '@/app/daily-card-game/domain/playing-card/utils'
import {
  buildSeedString,
  deterministicUuid,
  getRandomNumberWithSeed,
} from '@/app/daily-card-game/domain/randomness'

import { SpectralCardDefinition, SpectralCardType } from './types'

const familiar: SpectralCardDefinition = {
  spectralType: 'familiar',
  name: 'Familiar',
  description: 'Destroy 1 random card in your hand, but add 3 random Enhanced face cards instead.',
  isPlayable: (game: GameState) => {
    return game.gamePlayState.dealtCards.length > 0
  },
  effects: [
    {
      event: {
        type: 'SPECTRAL_CARD_USED',
      },
      priority: 1,
      apply: (ctx: EffectContext) => {
        const seed = buildSeedString([ctx.game.gameSeed, ctx.game.roundIndex.toString()])
        const randomCardIndex = getRandomNumberWithSeed(
          seed,
          0,
          ctx.game.gamePlayState.dealtCards.length - 1
        )
        const randomCards = getRandomPlayingCardsWithFilters({
          game: ctx.game,
          numberOfCards: 3,
          values: ['J', 'Q', 'K'],
        })
        const playingCards = randomCards.map(card => {
          const cardState = initializePlayingCard(card, ctx.game, true)
          cardState.flags.enchantment =
            cardState.flags.enchantment === 'none'
              ? getRandomEnchantment(ctx.game, deterministicUuid(seed))
              : cardState.flags.enchantment
          return cardState
        })
        ctx.game.gamePlayState.dealtCards.splice(randomCardIndex, 1)
        ctx.game.gamePlayState.dealtCards.push(...playingCards)
      },
    },
  ],
}

const grim: SpectralCardDefinition = {
  spectralType: 'grim',
  name: 'Grim',
  description: 'Destroy 1 random card in your hand, but add 2 random Enhanced Aces instead.',
  effects: [],
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
  effects: [],
}

const sigil: SpectralCardDefinition = {
  spectralType: 'sigil',
  name: 'Sigil',
  description: 'Converts all cards in hand to a single random suit.',
  effects: [],
}

const ouija: SpectralCardDefinition = {
  spectralType: 'ouija',
  name: 'Ouija',
  description: 'Converts all cards in hand to a single random rank, but -1 Hand Size.',
  effects: [],
}

const ectoplasm: SpectralCardDefinition = {
  spectralType: 'ectoplasm',
  name: 'Ectoplasm',
  description:
    'Add Negative to a random Joker, but -1 Hand Size, plus another -1 hand size for each time Ectoplasm has been used this run, e.g. using Ectoplasm 3 times in the same run decreases hand size by a total of 6 (1+2+3)',
  effects: [],
}

const immolate: SpectralCardDefinition = {
  spectralType: 'immolate',
  name: 'Immolate',
  description: 'Destroys 5 random cards in hand, but gain $20.',
  effects: [],
}

const ankh: SpectralCardDefinition = {
  spectralType: 'ankh',
  name: 'Ankh',
  description:
    'Creates a copy of 1 of your Jokers at random, then destroys the others, leaving you with two identical Jokers. (Editions are also copied, except Negative)',
  effects: [],
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
  effects: [],
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
  effects: [],
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
export const implementedSpectralCards: Partial<typeof spectralCards> = {}

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

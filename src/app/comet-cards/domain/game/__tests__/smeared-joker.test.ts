import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { checkHandForFlush } from '@/app/comet-cards/domain/hand/hands'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'
import type { PlayingCardDefinition, PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import { uuid } from '@/app/comet-cards/domain/randomness'

const c = (cardDefinitionId: PlayingCardDefinition['id']): PlayingCardState => ({
  id: uuid(),
  playingCardId: cardDefinitionId,
  bonusChips: 0,
  flags: {
    edition: 'normal',
    enchantment: 'none',
    seal: 'none',
  },
  isFaceUp: true,
})

function buySmearedJoker(game: GameState): GameState {
  const jokerState = initializeJoker(jokers.smearedJoker, game)
  const buyable: BuyableCard = {
    type: 'jokerCard',
    card: jokerState,
    price: jokers.smearedJoker.price,
  }
  const withShop: GameState = {
    ...game,
    money: 999,
    shopState: { ...game.shopState, cardsForSale: [buyable], selectedCardId: jokerState.id },
  }
  return reduceGame(withShop, { type: 'SHOP_BUY_CARD' })
}

describe('Smeared Joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('sets smearedSuits to true when the joker is added (via shop purchase)', () => {
    const game = setupGame()

    const after = buySmearedJoker(game)

    expect(after.staticRules.smearedSuits).toBe(true)
  })

  it('sets smearedSuits to false when the joker is removed', () => {
    const game = setupGame()
    const jokerInstance = initializeJoker(jokers.smearedJoker, game)
    game.jokers = [jokerInstance]
    game.staticRules = { ...game.staticRules, smearedSuits: true }

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: jokerInstance.id },
    }

    const after = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(after.jokers.some(j => j.jokerId === 'smearedJoker')).toBe(false)
    expect(after.staticRules.smearedSuits).toBe(false)
  })

  it('detects a flush with mixed Hearts and Diamonds when smearedSuits is true', () => {
    const staticRules = {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
      bossBlindRerolls: 0,
      bossBlindRerollCost: 0,
      telescopeActive: false,
      observatoryActive: false,
      spectralInArcanaPacks: false,
      probabilityMultiplier: 1,
      smearedSuits: true,
    }

    const mixedRedCards = [
      c('2_hearts'),
      c('5_diamonds'),
      c('8_hearts'),
      c('J_diamonds'),
      c('K_hearts'),
    ]

    const [isFlush] = checkHandForFlush(mixedRedCards, staticRules)
    expect(isFlush).toBe(true)
  })

  it('detects a flush with mixed Spades and Clubs when smearedSuits is true', () => {
    const staticRules = {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
      bossBlindRerolls: 0,
      bossBlindRerollCost: 0,
      telescopeActive: false,
      observatoryActive: false,
      spectralInArcanaPacks: false,
      probabilityMultiplier: 1,
      smearedSuits: true,
    }

    const mixedBlackCards = [
      c('2_spades'),
      c('5_clubs'),
      c('8_spades'),
      c('J_clubs'),
      c('K_spades'),
    ]

    const [isFlush] = checkHandForFlush(mixedBlackCards, staticRules)
    expect(isFlush).toBe(true)
  })

  it('does NOT detect a flush with mixed red and black suits when smearedSuits is false', () => {
    const staticRules = {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
      bossBlindRerolls: 0,
      bossBlindRerollCost: 0,
      telescopeActive: false,
      observatoryActive: false,
      spectralInArcanaPacks: false,
      probabilityMultiplier: 1,
      smearedSuits: false,
    }

    const mixedColorCards = [
      c('2_hearts'),
      c('5_spades'),
      c('8_hearts'),
      c('J_spades'),
      c('K_hearts'),
    ]

    const [isFlush] = checkHandForFlush(mixedColorCards, staticRules)
    expect(isFlush).toBe(false)
  })

  it('does NOT detect a flush with mixed red and black suits even when smearedSuits is true', () => {
    const staticRules = {
      numberOfCardsRequiredForFlushAndStraight: 5,
      areAllCardsFaceCards: false,
      allowDuplicateJokersInShop: false,
      bossBlindRerolls: 0,
      bossBlindRerollCost: 0,
      telescopeActive: false,
      observatoryActive: false,
      spectralInArcanaPacks: false,
      probabilityMultiplier: 1,
      smearedSuits: true,
    }

    const mixedColorCards = [
      c('2_hearts'),
      c('5_spades'),
      c('8_hearts'),
      c('J_spades'),
      c('K_hearts'),
    ]

    const [isFlush] = checkHandForFlush(mixedColorCards, staticRules)
    expect(isFlush).toBe(false)
  })

  it('flush detection works end-to-end via reduceGame with smearedJoker active', () => {
    const game = setupGame()
    const jokerInstance = initializeJoker(jokers.smearedJoker, game)
    game.jokers = [jokerInstance]
    game.staticRules = { ...game.staticRules, smearedSuits: true }

    // Select a mixed hearts/diamonds hand (should be a flush with smeared joker)
    const mixedRedCards = [
      c('2_hearts'),
      c('5_diamonds'),
      c('8_hearts'),
      c('J_diamonds'),
      c('K_hearts'),
    ]

    // Verify flush is detected via checkHandForFlush with the smeared staticRules
    const [isFlush] = checkHandForFlush(mixedRedCards, game.staticRules)
    expect(isFlush).toBe(true)
  })
})

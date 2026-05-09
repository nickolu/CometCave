import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { checkHandForStraight } from '@/app/comet-cards/domain/hand/hands'
import { findAllStraights } from '@/app/comet-cards/domain/hand/utils'
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

function buyShortcutJoker(game: GameState): GameState {
  const jokerState = initializeJoker(jokers.shortcut, game)
  const buyable: BuyableCard = {
    type: 'jokerCard',
    card: jokerState,
    price: jokers.shortcut.price,
  }
  const withShop: GameState = {
    ...game,
    money: 999,
    shopState: { ...game.shopState, cardsForSale: [buyable], selectedCardId: jokerState.id },
  }
  return reduceGame(withShop, { type: 'SHOP_BUY_CARD' })
}

describe('Shortcut Joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('sets allowStraightGaps to true when the joker is added (via shop purchase)', () => {
    const game = setupGame()
    const after = buyShortcutJoker(game)
    expect(after.staticRules.allowStraightGaps).toBe(true)
  })

  it('sets allowStraightGaps to false when the joker is removed', () => {
    const game = setupGame()
    const jokerInstance = initializeJoker(jokers.shortcut, game)
    game.jokers = [jokerInstance]
    game.staticRules = { ...game.staticRules, allowStraightGaps: true }

    const selected: GameState = {
      ...game,
      gamePlayState: { ...game.gamePlayState, selectedJokerId: jokerInstance.id },
    }
    const after = reduceGame(selected, { type: 'JOKER_REMOVED' })

    expect(after.jokers.some(j => j.jokerId === 'shortcut')).toBe(false)
    expect(after.staticRules.allowStraightGaps).toBe(false)
  })

  it('findAllStraights detects a straight with gaps of 1 rank when allowGaps is true', () => {
    // Cards: 3(p2), 5(p4), 6(p5), 8(p7), 10(p9) — gaps in priority: 2, 1, 2, 2 (all <= 2)
    const cards = [c('3_hearts'), c('5_clubs'), c('6_spades'), c('8_diamonds'), c('10_hearts')]
    const straights = findAllStraights(cards, 5, true)
    expect(straights.length).toBeGreaterThan(0)
    expect(straights[0].length).toBe(5)
  })

  it('findAllStraights does NOT detect a straight with gaps of 1 rank when allowGaps is false', () => {
    // Same cards: 3, 5, 6, 8, 10 — NOT consecutive without gaps
    const cards = [c('3_hearts'), c('5_clubs'), c('6_spades'), c('8_diamonds'), c('10_hearts')]
    const straights = findAllStraights(cards, 5, false)
    expect(straights.length).toBe(0)
  })

  it('findAllStraights still detects a normal consecutive straight when allowGaps is true', () => {
    // 5,6,7,8,9 — all consecutive, no gaps
    const cards = [c('5_hearts'), c('6_clubs'), c('7_spades'), c('8_diamonds'), c('9_hearts')]
    const straights = findAllStraights(cards, 5, true)
    expect(straights.length).toBeGreaterThan(0)
    expect(straights[0].length).toBe(5)
  })

  it('findAllStraights does NOT detect a gap of 2+ ranks even with allowGaps true', () => {
    // Cards: 3(p2), 6(p5) — priority gap is 3, which exceeds maxGap=2
    // Full hand: 3, 6, 7, 8, 9 — the run [6,7,8,9] is only 4 cards, not enough for 5
    const cards = [c('3_hearts'), c('6_clubs'), c('7_spades'), c('8_diamonds'), c('9_hearts')]
    const straights = findAllStraights(cards, 5, true)
    expect(straights.length).toBe(0)
  })

  it('checkHandForStraight uses allowStraightGaps from staticRules', () => {
    const gappyCards = [c('3_hearts'), c('5_clubs'), c('6_spades'), c('8_diamonds'), c('10_hearts')]

    const [isStraightWithGaps] = checkHandForStraight(gappyCards, {
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
      allowStraightGaps: true,
    })
    expect(isStraightWithGaps).toBe(true)

    const [isStraightWithoutGaps] = checkHandForStraight(gappyCards, {
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
      allowStraightGaps: false,
    })
    expect(isStraightWithoutGaps).toBe(false)
  })
})

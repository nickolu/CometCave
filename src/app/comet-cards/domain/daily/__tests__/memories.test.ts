import { describe, expect, it } from 'vitest'

import { applyMemories, countAllocated, previewMemories } from '@/app/comet-cards/domain/daily/memories'
import {
  buildRememberedHand,
  buildRememberedHands,
  getRememberableHands,
} from '@/app/comet-cards/domain/daily/remembered-hands'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'


function newGame(jokerIds: string[] = []): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = jokerIds.map(id => initializeJoker(jokers[id], game))
  return game
}

describe('remembered hands', () => {
  it('builds real hands from the player deck', () => {
    const game = newGame()
    const fullHouse = buildRememberedHand(game, 'fullHouse')
    expect(fullHouse).not.toBeNull()
    expect(fullHouse).toHaveLength(5)
    // Every card must be one the player actually owns.
    for (const card of fullHouse!) {
      expect(game.ownedCardIds).toContain(card.id)
    }
  })

  it('a standard deck can remember every hand it can actually make', () => {
    const rememberable = getRememberableHands(newGame())
    expect(rememberable).toContain('pair')
    expect(rememberable).toContain('twoPair')
    expect(rememberable).toContain('fullHouse')
    expect(rememberable).toContain('flush')
    expect(rememberable).toContain('straight')
    // A standard 52-card deck has no fifth card of any rank.
    expect(rememberable).not.toContain('fiveOfAKind')
    expect(rememberable).not.toContain('flushFive')
  })

  it('refuses a hand the deck cannot produce', () => {
    const game = newGame()
    // Strip the deck down to four cards of one rank.
    const kings = game.ownedCardIds.filter(id => game.cards[id].playingCardId.startsWith('K_'))
    game.ownedCardIds = kings
    expect(buildRememberedHand(game, 'fourOfAKind')).not.toBeNull()
    expect(buildRememberedHand(game, 'straight')).toBeNull()
    expect(buildRememberedHand(game, 'fullHouse')).toBeNull()
  })
})

describe('applying memories', () => {
  it('charges Supernova by incrementing timesPlayed', () => {
    const game = newGame(['supernovaJoker'])
    applyMemories(game, { hands: { fullHouse: 12 }, discards: 0 })
    expect(game.pokerHands.fullHouse.timesPlayed).toBe(12)
  })

  it('charges Spare Trousers for hands that contain a Two Pair', () => {
    const game = newGame(['spareTrousersJoker'])
    applyMemories(game, { hands: { fullHouse: 10 }, discards: 0 })
    // +2 per remembered hand containing a two pair
    expect(game.jokers[0].metadata?.multBonus).toBe(20)
  })

  it('does not charge Spare Trousers for hands that contain no Two Pair', () => {
    const game = newGame(['spareTrousersJoker'])
    applyMemories(game, { hands: { flush: 10 }, discards: 0 })
    expect(game.jokers[0].metadata?.multBonus ?? 0).toBe(0)
  })

  it('charges Green Joker once per remembered hand, whatever the hand', () => {
    const game = newGame(['greenJoker'])
    applyMemories(game, { hands: { pair: 5, flush: 4, fullHouse: 3 }, discards: 0 })
    expect(game.jokers[0].counter).toBe(12)
  })

  it('charges Runner only for hands containing a straight', () => {
    const game = newGame(['runner'])
    applyMemories(game, { hands: { straight: 4, pair: 6 }, discards: 0 })
    expect(game.jokers[0].counter).toBe(60) // +15 chips per straight
  })

  it('charges Square Joker only for four-card hands', () => {
    const game = newGame(['squareJoker'])
    applyMemories(game, { hands: { twoPair: 5, fullHouse: 5 }, discards: 0 })
    expect(game.jokers[0].counter).toBe(20) // +4 chips per 4-card hand, two pair only
  })

  it('charges several jokers from one allocation', () => {
    const game = newGame(['supernovaJoker', 'spareTrousersJoker', 'greenJoker'])
    applyMemories(game, { hands: { fullHouse: 8 }, discards: 0 })
    expect(game.pokerHands.fullHouse.timesPlayed).toBe(8)
    expect(game.jokers[1].metadata?.multBonus).toBe(16)
    expect(game.jokers[2].counter).toBe(8)
  })

  it('leaves no score on the board', () => {
    const game = newGame(['supernovaJoker', 'greenJoker', 'runner'])
    applyMemories(game, { hands: { fullHouse: 10, straight: 5 }, discards: 0 })
    expect(game.gamePlayState.score).toEqual({ chips: 0, mult: 0 })
    expect(game.gamePlayState.scoringEvents).toEqual([])
    expect(game.gamePlayState.handResults).toEqual([])
    expect(game.gamePlayState.selectedHand).toBeUndefined()
  })

  it('does not pay out money for hands that were only remembered', () => {
    const game = newGame(['goldenJokerJoker', 'greenJoker'])
    game.money = 40
    applyMemories(game, { hands: { pair: 15 }, discards: 0 })
    expect(game.money).toBe(40)
  })

  it('does not spend the hands the player has for the run', () => {
    const game = newGame(['greenJoker'])
    const handsBefore = game.gamePlayState.remainingHands
    applyMemories(game, { hands: { pair: 20 }, discards: 0 })
    expect(game.gamePlayState.remainingHands).toBe(handsBefore)
  })

  it('skips hand types the deck cannot produce instead of failing', () => {
    const game = newGame(['greenJoker'])
    applyMemories(game, { hands: { pair: 5, flushFive: 10 }, discards: 0 })
    expect(game.jokers[0].counter).toBe(5)
  })

  it('is deterministic', () => {
    const a = newGame(['supernovaJoker', 'spareTrousersJoker', 'rideTheBus'])
    const b = newGame(['supernovaJoker', 'spareTrousersJoker', 'rideTheBus'])
    applyMemories(a, { hands: { pair: 6, fullHouse: 7, flush: 3 }, discards: 0 })
    applyMemories(b, { hands: { pair: 6, fullHouse: 7, flush: 3 }, discards: 0 })
    expect(a.jokers.map(j => j.counter)).toEqual(b.jokers.map(j => j.counter))
    expect(a.jokers.map(j => j.metadata)).toEqual(b.jokers.map(j => j.metadata))
  })
})

describe('preview', () => {
  it('does not mutate the game it previews', () => {
    const game = newGame(['greenJoker'])
    const preview = previewMemories(game, { hands: { pair: 9 }, discards: 0 })
    expect(preview.jokers[0].counter).toBe(9)
    expect(game.jokers[0].counter).toBe(0)
  })

  it('counts the allocated budget', () => {
    expect(countAllocated({ pair: 5, flush: 3 })).toBe(8)
    expect(countAllocated({})).toBe(0)
  })
})

describe('a history is played with different cards each time', () => {
  it('does not replay one canonical hand over and over', () => {
    const game = newGame()
    const variants = buildRememberedHands(game, 'fullHouse')
    expect(variants.length).toBeGreaterThan(1)

    const signatures = variants.map(cards =>
      cards
        .map(card => card.id)
        .sort()
        .join(',')
    )
    expect(new Set(signatures).size).toBe(variants.length)
  })

  it('spreads a card-marking joker across the deck', () => {
    // Hiker writes +5 chips onto every card it scores. Replaying a single
    // canonical hand piled its whole effect onto five cards, promising the
    // player chips they would then rarely draw.
    const game = newGame(['hiker'])
    applyMemories(game, { hands: { fullHouse: 10, twoPair: 5, flush: 5 }, discards: 0 })

    const touched = game.ownedCardIds.filter(id => game.cards[id].bonusChips > 0)
    expect(touched.length).toBeGreaterThan(20)
  })

  it('still totals the same chips — the spread moves them, it does not invent them', () => {
    const game = newGame(['hiker'])
    applyMemories(game, { hands: { fullHouse: 10 }, discards: 0 })

    const total = game.ownedCardIds.reduce((sum, id) => sum + game.cards[id].bonusChips, 0)
    // Ten hands, five scoring cards each, +5 chips per card.
    expect(total).toBe(10 * 5 * 5)
  })

  it('is still deterministic across the variants', () => {
    const a = newGame(['hiker'])
    const b = newGame(['hiker'])
    applyMemories(a, { hands: { fullHouse: 9, flush: 4 }, discards: 3 })
    applyMemories(b, { hands: { fullHouse: 9, flush: 4 }, discards: 3 })

    const read = (game: GameState) =>
      game.ownedCardIds.map(id => game.cards[id].bonusChips).join(',')
    expect(read(a)).toBe(read(b))
  })
})

describe('one-time joker effects survive the memory phase', () => {
  /**
   * `applyMemories` broadcasts `JOKER_ADDED` to prime scaling jokers, whose
   * accumulators are all `?? 0` initialisers and safe to repeat. Slot changes
   * are not — a declared history used to cost the player two more cards of
   * hand size for holding Stuntman.
   */
  it('does not charge Stuntman a second time', () => {
    const game = newGame(['stuntmanJoker'])
    // The purchase already paid the cost.
    game.handSizeModifier = -2
    game.jokers[0].metadata = { onAddApplied: 1 }

    const after = previewMemories(game, { hands: { pair: 2 }, discards: 0 })

    expect(after.handSizeModifier).toBe(-2)
  })

  it('does not hand Merry Andy another three discards', () => {
    const game = newGame(['merryAndyJoker'])
    game.maxDiscards += 3
    game.handSizeModifier = -1
    game.jokers[0].metadata = { onAddApplied: 1 }
    const discardsBefore = game.maxDiscards

    const after = previewMemories(game, { hands: { pair: 2 }, discards: 1 })

    expect(after.maxDiscards).toBe(discardsBefore)
    expect(after.handSizeModifier).toBe(-1)
  })
})

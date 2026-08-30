import { describe, expect, it } from 'vitest'

import { applyMemories, summariseJokerMemory } from '@/app/comet-cards/domain/daily/memories'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

/**
 * Memories exist so that jokers which only pay off after a long run can pay off
 * in a four minute one. That promise is only as good as its coverage, so this
 * checks every joker in the game rather than the handful we happened to think
 * of — a new scaling joker that memories cannot reach should fail here.
 *
 * `npm run audit:last-ante` prints the same analysis in readable form.
 */

/** Every place a joker is known to record progress. */
function chargeFingerprint(game: GameState): string {
  const joker = game.jokers[0]
  const cardBonus = game.ownedCardIds.reduce((sum, id) => sum + (game.cards[id]?.bonusChips ?? 0), 0)
  const enhancements = game.ownedCardIds
    .map(id => game.cards[id]?.flags.enchantment ?? '')
    .sort()
    .join('')
  const handLevels = Object.values(game.pokerHands).reduce((sum, h) => sum + h.level, 0)
  return JSON.stringify({
    counter: joker?.counter,
    metadata: joker?.metadata,
    sellValue: joker?.bonusSellValue,
    cardBonus,
    enhancements,
    handLevels,
    deckSize: game.ownedCardIds.length,
    handSize: game.handSizeModifier,
    maxHands: game.maxHands,
    maxDiscards: game.maxDiscards,
  })
}

function gameWith(jokerId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = [initializeJoker(jokers[jokerId], game)]
  return game
}

/** A history broad enough that any joker with a memory should react to some of it. */
const A_LONG_RUN = {
  hands: {
    highCard: 2,
    pair: 3,
    twoPair: 3,
    threeOfAKind: 2,
    straight: 2,
    flush: 2,
    fullHouse: 3,
    fourOfAKind: 1,
  },
  discards: 8,
}

/**
 * Jokers that legitimately cannot be charged by a declared history, with the
 * reason. Anything not on this list must react to memories.
 */
const EXEMPT: Record<string, string> = {
  madness: 'resets when a blind starts',
  burntJoker: 'resets when a blind starts',
  tradingCard: 'resets when a blind starts',
  dna: 'resets when a blind starts',
  hitTheRoad: 'resets when a blind starts',
  ceremonialDagger:
    'charges only by eating the joker to its right when a blind starts — it will do that during the run itself, and memories must never destroy a drafted joker',
}

describe('memory coverage across every joker', () => {
  it('reaches every joker that accumulates, except the documented exemptions', () => {
    const unreachable: string[] = []

    for (const id of Object.keys(jokers)) {
      if (EXEMPT[id]) continue

      const charged = gameWith(id)
      const before = chargeFingerprint(charged)
      applyMemories(charged, A_LONG_RUN)
      const reacts = chargeFingerprint(charged) !== before

      // A joker only counts as a gap if it accumulates during actual play but
      // not from memories. Approximate "accumulates during play" as: it has an
      // effect on one of the events a history is made of.
      const events = jokers[id].effects.map(e => e.event.type)
      const historyShaped = events.some(type =>
        ['HAND_SCORING_FINALIZE', 'CARD_SCORED', 'DISCARD_SELECTED_CARDS', 'ROUND_END', 'SHOP_REROLL'].includes(
          type
        )
      )

      if (historyShaped && !reacts) {
        // Not every history-shaped joker accumulates — most just score. Only
        // flag ones that keep state between hands.
        const keepsState = jokers[id].effects.some(e =>
          /counter|metadata|bonusSellValue|bonusChips/.test(e.apply.toString())
        )
        if (keepsState) unreachable.push(`${jokers[id].name} (${id})`)
      }
    }

    expect(unreachable).toEqual([])
  })

  it('covers the jokers the mode exists for, by their own mechanism', () => {
    // Each of these records progress somewhere different, so assert the actual
    // place rather than a generic fingerprint — Supernova, for one, stores
    // nothing on itself and reads the game's play counts instead.
    const checks: [string, (game: GameState) => number][] = [
      ['supernovaJoker', game => game.pokerHands.fullHouse.timesPlayed],
      ['spareTrousersJoker', game => (game.jokers[0].metadata?.multBonus as number) ?? 0],
      ['greenJoker', game => game.jokers[0].counter],
      ['runner', game => game.jokers[0].counter],
      ['squareJoker', game => game.jokers[0].counter],
      ['flashCardJoker', game => (game.jokers[0].metadata?.multBonus as number) ?? 0],
      ['redCard', game => game.jokers[0].counter],
      ['castle', game => game.jokers[0].counter],
      ['egg', game => game.jokers[0].bonusSellValue],
      ['hangingChad', game => game.jokers[0].counter],
    ]

    for (const [id, read] of checks) {
      const game = gameWith(id)
      applyMemories(game, A_LONG_RUN)
      expect(read(game), `${id} should be charged by memories`).toBeGreaterThan(0)
    }
  })

  it('reaches jokers that count scored cards', () => {
    // Hiker writes permanent chips onto the deck rather than onto itself.
    const game = gameWith('hiker')
    const before = game.ownedCardIds.reduce((s, id) => s + game.cards[id].bonusChips, 0)
    applyMemories(game, A_LONG_RUN)
    const after = game.ownedCardIds.reduce((s, id) => s + game.cards[id].bonusChips, 0)
    expect(after).toBeGreaterThan(before)
  })

  it('reaches jokers that count discards', () => {
    const game = gameWith('castle')
    applyMemories(game, A_LONG_RUN)
    expect(game.jokers[0].counter).toBeGreaterThan(0)
  })

  it('reaches jokers that count rounds, with no allocation at all', () => {
    const game = gameWith('egg')
    applyMemories(game, { hands: {}, discards: 0 })
    expect(game.jokers[0].bonusSellValue).toBeGreaterThan(0)
  })

  it('reaches jokers that count shop rerolls and skipped packs, with no allocation', () => {
    const flashCard = gameWith('flashCardJoker')
    applyMemories(flashCard, { hands: {}, discards: 0 })
    expect(flashCard.jokers[0].metadata?.multBonus).toBeGreaterThan(0)

    const redCard = gameWith('redCard')
    applyMemories(redCard, { hands: {}, discards: 0 })
    expect(redCard.jokers[0].counter).toBeGreaterThan(0)
  })

  it('shows something for jokers that keep no progress on themselves', () => {
    // Space Joker raises a poker hand level at random and records nothing;
    // Hiker writes chips onto the deck. Neither moves its own counter.
    for (const id of ['spaceJoker', 'hiker']) {
      const game = gameWith(id)
      const summary = summariseJokerMemory(game, A_LONG_RUN, game.jokers[0].id)
      expect(summary.inert, `${id} should not read as inert`).toBe(false)
    }
  })

  it('reports a scaling joker as added Mult, in the units a player reads', () => {
    const game = gameWith('greenJoker')
    const summary = summariseJokerMemory(game, A_LONG_RUN, game.jokers[0].id)
    expect(summary.inert).toBe(false)
    expect(summary.addMult).toBeGreaterThan(0)
  })

  it('does not credit a joker for merely initialising its own bookkeeping', () => {
    // Lucky Cat stores X1.0 as a counter of 4, Canio stores it as xMult 100.
    // Touching a fresh one moves that number without changing what it scores,
    // and the screen used to report the baseline as "+4" and "+100".
    for (const id of ['luckyCat', 'canio']) {
      const game = gameWith(id)
      const summary = summariseJokerMemory(game, A_LONG_RUN, game.jokers[0].id)
      expect(summary.inert, `${id} gained nothing, so it must read as inert`).toBe(true)
    }
  })

  it('warns rather than flatters when history and joker disagree', () => {
    // Obelisk climbs X0.2 per hand played and resets the moment you play your
    // most-played hand. A history of nothing but full houses therefore makes it
    // worse, not better, for a player who leads with full houses — which is
    // exactly what a history of nothing but full houses implies they will do.
    //
    // Measuring against the hand they remembered most is what surfaces this.
    // Measured against an arbitrary hand it would have read as a gain.
    const game = gameWith('obelisk')
    const summary = summariseJokerMemory(
      game,
      { hands: { fullHouse: 20 }, discards: 0 },
      game.jokers[0].id
    )
    expect(summary.inert).toBe(false)
    expect(summary.xMult).toBeLessThan(1)
  })

  it('credits a joker whose whole effect is sell value', () => {
    // Egg gains sell value per round and never scores a thing.
    const game = gameWith('egg')
    const summary = summariseJokerMemory(game, A_LONG_RUN, game.jokers[0].id)
    expect(summary.inert).toBe(false)
    expect(summary.sellValue).toBeGreaterThan(0)
  })

  it('does not let the backstory delete a joker the player drafted', () => {
    // Turtle Bean decays one hand size per round and destroys itself at zero.
    // Five antes behind would wipe it out between the draft and the first hand.
    const game = gameWith('turtleBeanJoker')
    const handSizeBefore = game.handSizeModifier
    applyMemories(game, { hands: {}, discards: 0 })

    expect(game.jokers).toHaveLength(1)
    expect(game.jokers[0].jokerId).toBe('turtleBeanJoker')
    // It kept its full value rather than arriving spent, and still grants the
    // hand size it is supposed to.
    expect(game.jokers[0].metadata?.handSizeBonus).toBe(5)
    expect(game.handSizeModifier).toBeGreaterThan(handSizeBefore)
  })
})

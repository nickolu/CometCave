import { describe, expect, it } from 'vitest'

import {
  LAST_ANTE_MEMORY_BUDGET,
  LAST_ANTE_ROUND_INDEX,
  LAST_ANTE_STARTING_MONEY,
} from '@/app/comet-cards/domain/daily/constants'
import { createLastAnteRun, getLastAnteDeck, getLastAnteSeed } from '@/app/comet-cards/domain/daily/create-last-ante-run'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { initializeRounds } from '@/app/comet-cards/domain/round/rounds'


describe('creating a Last Ante run', () => {
  it('is one round of three blinds', () => {
    const game = createLastAnteRun('2026-01-15')
    expect(game.rounds).toHaveLength(1)
    expect(game.roundIndex).toBe(0)
    expect(game.rounds[0].smallBlind.status).toBe('notStarted')
    expect(game.rounds[0].bigBlind.status).toBe('notStarted')
    expect(game.rounds[0].bossBlind.status).toBe('notStarted')
  })

  it('opens on the free packs with a purse and the boss already named', () => {
    const game = createLastAnteRun('2026-01-15')
    expect(game.gamePhase).toBe('opening')
    expect(game.money).toBe(LAST_ANTE_STARTING_MONEY)
    expect(game.rounds[0].bossBlindName).toBeTruthy()
    expect(game.lastAnte?.memoriesResolved).toBe(false)
  })

  it('starts at the tuned ante, not at the bottom of the ladder', () => {
    const game = createLastAnteRun('2026-01-15')
    expect(game.rounds[0].baseAnte).toBe(initializeRounds('x')[LAST_ANTE_ROUND_INDEX].baseAnte)
    // Far above where a full run begins — the player is arriving at the end.
    expect(game.rounds[0].baseAnte).toBeGreaterThan(initializeRounds('x')[1].baseAnte * 10n)
  })

  it('runs on its own seed so the two dailies never share a day', () => {
    expect(getLastAnteSeed('2026-01-15')).not.toBe('2026-01-15')
  })

  it('deals the deck from the day instead of letting the player choose', () => {
    expect(getLastAnteDeck(getLastAnteSeed('2026-01-15'))).toBe(
      getLastAnteDeck(getLastAnteSeed('2026-01-15'))
    )
    const decks = ['2026-01-15', '2026-02-02', '2026-03-09', '2026-04-20', '2026-05-31'].map(day =>
      getLastAnteDeck(getLastAnteSeed(day))
    )
    // Different days should not all land on the same deck.
    expect(new Set(decks).size).toBeGreaterThan(1)
  })

  it('never deals a deck that breaks the mode', () => {
    for (let i = 0; i < 400; i++) {
      const day = `2026-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`
      const deck = getLastAnteDeck(getLastAnteSeed(day))
      expect(deck).not.toBe('erraticDeck')
      expect(deck).not.toBe('plasmaDeck')
    }
  })
})

describe('the Last Ante flow', () => {
  /** A run advanced past the free packs, where the draft proper begins. */
  function startRun(): GameState {
    const opened = reduceGame(structuredClone(defaultGameState), { type: 'START_LAST_ANTE' })
    return reduceGame(opened, { type: 'OPENING_CONFIRMED' })
  }

  it('goes draft -> memories -> first blind', () => {
    let game = startRun()
    expect(game.mode).toBe('lastAnte')
    expect(game.gamePhase).toBe('shop')
    expect(game.lastAnte?.openingResolved).toBe(true)

    game = reduceGame(game, { type: 'SHOP_SELECT_BLIND' })
    expect(game.gamePhase).toBe('memories')
    expect(game.lastAnte?.draftResolved).toBe(true)

    game = reduceGame(game, { type: 'MEMORIES_CONFIRMED' })
    expect(game.gamePhase).toBe('blindSelection')
    expect(game.lastAnte?.memoriesResolved).toBe(true)
  })

  it('narrows the shop back to its normal width after the draft', () => {
    let game = startRun()
    const draftWidth = game.shopState.maxCardsForSale
    game = reduceGame(game, { type: 'SHOP_SELECT_BLIND' })
    expect(game.shopState.maxCardsForSale).toBeLessThan(draftWidth)
  })

  it('charges the jokers the player drafted', () => {
    // Stand in for a draft: two scaling jokers bought in Shop 0.
    const drafted = structuredClone(startRun())
    drafted.jokers = [
      initializeJoker(jokers.supernovaJoker, drafted),
      initializeJoker(jokers.greenJoker, drafted),
    ]
    let game = reduceGame(drafted, { type: 'SHOP_SELECT_BLIND' })
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'pair', count: 9 })
    game = reduceGame(game, { type: 'MEMORIES_CONFIRMED' })

    expect(game.pokerHands.pair.timesPlayed).toBe(9)
    expect(game.jokers[1].counter).toBe(9)
  })

  it('will not spend more history than the budget allows', () => {
    let game = reduceGame(startRun(), { type: 'SHOP_SELECT_BLIND' })
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'pair', count: 15 })
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'twoPair', count: 15 })
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'flush', count: 15 })

    const total = Object.values(game.lastAnte!.allocation).reduce((a, b) => a + (b ?? 0), 0)
    expect(total).toBeLessThanOrEqual(LAST_ANTE_MEMORY_BUDGET)
  })

  it('refuses history the deck could not have made', () => {
    let game = reduceGame(startRun(), { type: 'SHOP_SELECT_BLIND' })
    // No standard deck has five of a kind.
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'flushFive', count: 10 })
    expect(game.lastAnte?.allocation.flushFive).toBeUndefined()
  })

  it('ignores memory changes once the run has started', () => {
    let game = reduceGame(startRun(), { type: 'SHOP_SELECT_BLIND' })
    game = reduceGame(game, { type: 'MEMORIES_CONFIRMED' })
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'pair', count: 5 })
    expect(game.lastAnte?.allocation.pair).toBeUndefined()
  })

  it('ends the run when the boss blind is beaten instead of opening another shop', () => {
    const started = reduceGame(startRun(), { type: 'SHOP_SELECT_BLIND' })
    const atBoss = structuredClone(reduceGame(started, { type: 'MEMORIES_CONFIRMED' }))
    atBoss.rounds[0].smallBlind.status = 'completed'
    atBoss.rounds[0].bigBlind.status = 'completed'
    atBoss.rounds[0].bossBlind.status = 'inProgress'
    atBoss.gamePhase = 'blindRewards'

    const game = reduceGame(atBoss, { type: 'BLIND_REWARDS_END' })
    expect(game.gamePhase).toBe('gameOver')
    expect(game.lastAnte?.outcome).toBe('won')
    expect(game.roundIndex).toBe(0)
  })

  it('leaves the full run untouched', () => {
    const game = reduceGame(structuredClone(defaultGameState), { type: 'GAME_START' })
    expect(game.mode).toBe('endless')
    expect(game.lastAnte).toBeNull()
    expect(game.rounds.length).toBeGreaterThan(1)
  })
})

describe('the memory budget', () => {
  function atMemories(): GameState {
    const opened = reduceGame(structuredClone(defaultGameState), { type: 'START_LAST_ANTE' })
    const shopped = reduceGame(opened, { type: 'OPENING_CONFIRMED' })
    return reduceGame(shopped, { type: 'SHOP_SELECT_BLIND' })
  }

  it('spends hands and discards from one pool', () => {
    let game = atMemories()
    const budget = game.lastAnte!.memoryBudget

    // Discards have their own ceiling as well as the shared budget.
    game = reduceGame(game, { type: 'DISCARDS_REMEMBERED', count: 99 })
    const onDiscards = game.lastAnte!.discardsRemembered
    expect(onDiscards).toBeLessThanOrEqual(budget)

    // Whatever is left is all the hands can have, however much they ask for.
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'pair', count: 99 })
    expect(game.lastAnte?.allocation.pair ?? 0).toBe(budget - onDiscards)
  })

  it('lets discards take only what the hands left behind', () => {
    let game = atMemories()
    const budget = game.lastAnte!.memoryBudget

    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: 'pair', count: 15 })
    game = reduceGame(game, { type: 'DISCARDS_REMEMBERED', count: 20 })

    const spent = (game.lastAnte!.allocation.pair ?? 0) + game.lastAnte!.discardsRemembered
    expect(spent).toBeLessThanOrEqual(budget)
    expect(game.lastAnte?.discardsRemembered).toBe(budget - 15)
  })
})

import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Faceless Joker', () => {
  function getCardIdsByValue(game: GameState, value: string): string[] {
    return Object.keys(game.cards).filter(
      id => playingCards[game.cards[id].playingCardId]?.value === value
    )
  }

  function makeGameWithFacelessJoker(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.facelessJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('earns $5 when exactly 3 face cards are discarded', () => {
    const game = makeGameWithFacelessJoker()
    const jackIds = getCardIdsByValue(game, 'J')
    const queenIds = getCardIdsByValue(game, 'Q')
    const kingIds = getCardIdsByValue(game, 'K')

    expect(jackIds.length).toBeGreaterThanOrEqual(1)
    expect(queenIds.length).toBeGreaterThanOrEqual(1)
    expect(kingIds.length).toBeGreaterThanOrEqual(1)

    const selectedIds = [jackIds[0], queenIds[0], kingIds[0]]
    game.gamePlayState.selectedCardIds = selectedIds

    const initialMoney = game.money
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    expect(after.money).toBe(initialMoney + 5)
  })

  it('earns $5 when more than 3 face cards are discarded', () => {
    const game = makeGameWithFacelessJoker()
    const jackIds = getCardIdsByValue(game, 'J')
    const queenIds = getCardIdsByValue(game, 'Q')
    const kingIds = getCardIdsByValue(game, 'K')

    expect(jackIds.length).toBeGreaterThanOrEqual(2)
    expect(queenIds.length).toBeGreaterThanOrEqual(1)
    expect(kingIds.length).toBeGreaterThanOrEqual(1)

    const selectedIds = [jackIds[0], jackIds[1], queenIds[0], kingIds[0]]
    game.gamePlayState.selectedCardIds = selectedIds

    const initialMoney = game.money
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    expect(after.money).toBe(initialMoney + 5)
  })

  it('does not earn $5 when fewer than 3 face cards are discarded', () => {
    const game = makeGameWithFacelessJoker()
    const jackIds = getCardIdsByValue(game, 'J')
    const aceIds = getCardIdsByValue(game, 'A')

    expect(jackIds.length).toBeGreaterThanOrEqual(2)
    expect(aceIds.length).toBeGreaterThanOrEqual(1)

    // Only 2 face cards (Jacks), plus a non-face card (Ace)
    const selectedIds = [jackIds[0], jackIds[1], aceIds[0]]
    game.gamePlayState.selectedCardIds = selectedIds

    const initialMoney = game.money
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    expect(after.money).toBe(initialMoney)
  })

  it('does not earn $5 when no face cards are discarded', () => {
    const game = makeGameWithFacelessJoker()
    const aceIds = getCardIdsByValue(game, 'A')
    const twoIds = getCardIdsByValue(game, '2')

    expect(aceIds.length).toBeGreaterThanOrEqual(2)
    expect(twoIds.length).toBeGreaterThanOrEqual(1)

    const selectedIds = [aceIds[0], aceIds[1], twoIds[0]]
    game.gamePlayState.selectedCardIds = selectedIds

    const initialMoney = game.money
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    expect(after.money).toBe(initialMoney)
  })
})

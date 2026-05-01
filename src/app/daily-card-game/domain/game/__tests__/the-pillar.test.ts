import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('The Pillar boss blind', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Pillar'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.rounds[game.roundIndex].smallBlind.status = 'completed'
    game.rounds[game.roundIndex].bigBlind.status = 'completed'
    game.gamePhase = 'gameplay'
    return game
  }

  it('removes previously-played cards from cardsToScore at HAND_SCORING_START', () => {
    const game = setupGame()
    // Two cards played during small/big blinds earlier this ante
    const cardAId = game.ownedCardIds[0]
    const cardCId = game.ownedCardIds[1]
    game.gamePlayState.cardIdsPlayedThisAnte = [cardAId]
    game.gamePlayState.selectedCardIds = [cardAId, cardCId]
    game.gamePlayState.handIds = [cardAId, cardCId]

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).not.toContain(cardAId)
    expect(scoredIds).toContain(cardCId)
  })

  it('does not remove cards that were not played earlier this ante', () => {
    const game = setupGame()
    const cardCId = game.ownedCardIds[0]
    game.gamePlayState.cardIdsPlayedThisAnte = [] // nothing played before
    game.gamePlayState.selectedCardIds = [cardCId]
    game.gamePlayState.handIds = [cardCId]

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    const scoredIds = after.gamePlayState.cardsToScore.map(c => c.id)
    expect(scoredIds).toContain(cardCId)
  })

  it('does not accumulate cards during boss blind plays', () => {
    const game = setupGame()
    const cardId = game.ownedCardIds[0]
    game.gamePlayState.cardIdsPlayedThisAnte = ['some-earlier-card']
    game.gamePlayState.selectedCardIds = [cardId]
    game.gamePlayState.handIds = [cardId]

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    // Boss blind cards should NOT be added to cardIdsPlayedThisAnte
    expect(after.gamePlayState.cardIdsPlayedThisAnte).toEqual(['some-earlier-card'])
  })

  it('accumulates cards played in small blind into cardIdsPlayedThisAnte', () => {
    const game = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Pillar'
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.rounds[game.roundIndex].bigBlind.status = 'notStarted'
    game.rounds[game.roundIndex].bossBlind.status = 'notStarted'
    game.gamePhase = 'gameplay'

    const cardId = game.ownedCardIds[0]
    game.gamePlayState.cardIdsPlayedThisAnte = []
    game.gamePlayState.selectedCardIds = [cardId]
    game.gamePlayState.handIds = [cardId]

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    expect(after.gamePlayState.cardIdsPlayedThisAnte).toContain(cardId)
  })

  it('resets cardIdsPlayedThisAnte when boss blind completes (BLIND_REWARDS_END)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.rounds[game.roundIndex].smallBlind.status = 'completed'
    game.rounds[game.roundIndex].bigBlind.status = 'completed'
    game.gamePlayState.cardIdsPlayedThisAnte = ['card-a', 'card-b']
    game.gamePhase = 'blindRewards'

    const after = reduceGame(game, { type: 'BLIND_REWARDS_END' })

    expect(after.gamePlayState.cardIdsPlayedThisAnte).toEqual([])
  })
})

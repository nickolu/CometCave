import { describe, expect, it } from 'vitest'
import { defaultGameState } from '../default-game-state'
import { reduceGame } from '../reduce-game'
import type { GameState } from '../types'
import { collectEffects } from '../utils'
import { jokers } from '../../joker/jokers'
import { initializeJoker } from '../../joker/utils'

function createCrimsonHeartGame(): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.rounds[game.roundIndex].bossBlindName = 'Crimson Heart'
  game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
  game.gamePhase = 'gameplay'
  game.jokers = [
    initializeJoker(jokers.halfJoker, game),
    initializeJoker(jokers.splash, game),
    initializeJoker(jokers.greenJoker, game),
  ]
  game.gamePlayState.selectedCardIds = Object.keys(game.cards).slice(0, 1)
  game.gamePlayState.handIds = game.gamePlayState.selectedCardIds
  game.gamePlayState.cardsToScore = game.gamePlayState.selectedCardIds
    .map(cardId => game.cards[cardId])
    .filter(card => card !== undefined)
  return game
}

describe('Crimson Heart boss blind', () => {
  it('turns exactly one random joker face down when scoring starts', () => {
    const game = createCrimsonHeartGame()

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })

    const faceDownJokers = after.jokers.filter(joker => !joker.isFaceUp)
    const faceUpJokers = after.jokers.filter(joker => joker.isFaceUp)

    expect(faceDownJokers).toHaveLength(1)
    expect(faceUpJokers).toHaveLength(2)
  })

  it('excludes the face-down joker effects from the same scoring event', () => {
    const game = createCrimsonHeartGame()
    game.gamePlayState.selectedCardIds = Object.keys(game.cards).slice(0, 1)
    game.gamePlayState.handIds = game.gamePlayState.selectedCardIds

    const after = reduceGame(game, { type: 'HAND_SCORING_START' })
    const faceDownJoker = after.jokers.find(joker => !joker.isFaceUp)

    expect(faceDownJoker).toBeDefined()

    if (faceDownJoker?.jokerId === 'halfJoker') {
      expect(after.gamePlayState.score.mult).toBe(1)
      expect(
        after.gamePlayState.scoringEvents.some(
          event => 'source' in event && event.source === 'Half Joker'
        )
      ).toBe(false)
    }
  })
})

describe('collectEffects', () => {
  it('skips joker effects for face-down jokers while keeping boss blind effects', () => {
    const game = createCrimsonHeartGame()
    game.jokers[1].isFaceUp = false

    const effects = collectEffects(game)
    const handScoringStartEffects = effects.filter(effect => effect.event.type === 'HAND_SCORING_START')

    expect(handScoringStartEffects.some(effect => effect === jokers.splash.effects?.[0])).toBe(false)
    expect(handScoringStartEffects).toHaveLength(2)
  })
})

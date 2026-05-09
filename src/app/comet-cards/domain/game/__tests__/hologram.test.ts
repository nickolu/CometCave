import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import { initializePlayingCard } from '@/app/comet-cards/domain/playing-card/utils'
import { addOwnedCard } from '@/app/comet-cards/domain/game/card-registry-utils'

describe('Hologram joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hologram, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gamePlayState.remainingHands = 5
    game.gamePlayState.score = { chips: 10, mult: 10 }
    return game
  }

  it('applies X Mult based on cards added to deck', () => {
    const game = setupGame()
    // Initialize counter to current deck size by triggering first
    const h = game.jokers.find(j => j.jokerId === 'hologram')!
    h.counter = game.ownedCardIds.length

    // Add 2 cards to the deck
    const cardDef = Object.values(playingCards)[0]
    const card1 = initializePlayingCard(cardDef)
    const card2 = initializePlayingCard(cardDef)
    addOwnedCard(game, card1)
    addOwnedCard(game, card2)

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // 2 cards added → X1.5 Mult
    expect(
      after.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Hologram' && 'value' in e && e.value === 1.5,
      ),
    ).toBe(true)
  })

  it('no X Mult when no cards added', () => {
    const game = setupGame()
    // Set counter to current deck size (no cards added)
    const h = game.jokers.find(j => j.jokerId === 'hologram')!
    h.counter = game.ownedCardIds.length

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Hologram',
      ),
    ).toBe(false)
  })

  it('initializes counter to deck size on first use', () => {
    const game = setupGame()
    // Counter starts at 0 (uninitialized)
    expect(game.jokers[0].counter).toBe(0)

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // Counter should now be set to deck size
    const h = after.jokers.find(j => j.jokerId === 'hologram')!
    expect(h.counter).toBe(game.ownedCardIds.length)
  })
})

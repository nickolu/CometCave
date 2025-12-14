'use client'

import { create } from 'zustand'
import type { GamePhase, GameState } from './domain/types'
import { defaultGameState } from './constants/default-game-state'

const HAND_SIZE = 7

export interface DailyCardGameStore {
  game: GameState
  setGame: (game: GameState) => void
  clearGame: () => void
  setGamePhase: (gamePhase: GamePhase) => void
  dealHand: () => void
  selectCard: (id: string) => void
  deselectCard: (id: string) => void
  discardSelectedCards: () => void
  dealCards: (count: number) => void
  refillHand: () => void
}

export const useDailyCardGameStore = create<DailyCardGameStore>()(set => ({
  game: defaultGameState,
  setGame: game => set({ game }),
  clearGame: () => set({ game: defaultGameState }),
  setGamePhase: (gamePhase: GamePhase) => set(state => ({ game: { ...state.game, gamePhase } })),
  dealHand: () =>
    set(state => {
      if (state.game.gamePlayState.dealtCards.length) {
        return state
      }
      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...state.game.gamePlayState,
            dealtCards: state.game.gamePlayState.remainingDeck.slice(0, HAND_SIZE),
            remainingDeck: state.game.gamePlayState.remainingDeck.slice(HAND_SIZE),
          },
        },
      }
    }),
  dealCards: (count: number) =>
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const shouldDeal = gamePlayState.dealtCards.length + count <= HAND_SIZE
      const dealtCards = gamePlayState.dealtCards.concat(
        gamePlayState.remainingDeck.slice(0, count)
      )
      const remainingDeck = gamePlayState.remainingDeck.slice(count)

      if (shouldDeal) {
        return {
          game: {
            ...state.game,
            gamePlayState: {
              ...gamePlayState,
              dealtCards,
              remainingDeck,
            },
          },
        }
      }
      throw new Error('Not enough cards to deal')
    }),
  refillHand: () =>
    set(state => {
      const gamePlayState = state.game.gamePlayState
      const cardsToRefill = gamePlayState.remainingDeck.slice(
        0,
        HAND_SIZE - gamePlayState.dealtCards.length
      )
      return {
        game: {
          ...state.game,
          gamePlayState: {
            ...state.game.gamePlayState,
            dealtCards: state.game.gamePlayState.dealtCards.concat(cardsToRefill),
            remainingDeck: gamePlayState.remainingDeck.slice(cardsToRefill.length),
          },
        },
      }
    }),
  selectCard: (id: string) =>
    set(state => ({
      game: {
        ...state.game,
        gamePlayState: {
          ...state.game.gamePlayState,
          selectedCardIds: [...state.game.gamePlayState.selectedCardIds, id],
        },
      },
    })),
  deselectCard: (id: string) =>
    set(state => ({
      game: {
        ...state.game,
        gamePlayState: {
          ...state.game.gamePlayState,
          selectedCardIds: state.game.gamePlayState.selectedCardIds.filter(cardId => cardId !== id),
        },
      },
    })),
  discardSelectedCards: () =>
    set(state => {
      const gameState = state.game
      const gamePlayState = gameState.gamePlayState
      const cardsToDiscard = gamePlayState.dealtCards.filter(card =>
        gamePlayState.selectedCardIds.includes(card.id)
      )
      const cardsToKeep = gamePlayState.dealtCards.filter(
        card => !gamePlayState.selectedCardIds.includes(card.id)
      )
      console.log('cardsToDiscard', cardsToDiscard)
      console.log('cardsToKeep', cardsToKeep)
      return {
        game: {
          ...gameState,
          discardsPlayed: gameState.discardsPlayed + 1,
          gamePlayState: {
            ...gamePlayState,
            selectedCardIds: [],
            dealtCards: cardsToKeep,
            remainingDiscards: gamePlayState.remainingDiscards - 1,
          },
        },
      }
    }),
}))

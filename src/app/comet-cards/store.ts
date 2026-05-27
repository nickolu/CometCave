'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { GameEvent } from '@/app/comet-cards/domain/events/types'
import type { GamePhase, GameState } from '@/app/comet-cards/domain/game/types'
import { getCurrentDayAsSeedString } from '@/app/comet-cards/domain/randomness'

import { defaultGameState } from './domain/game/default-game-state'
import { reduceGame } from './domain/game/reduce-game'

export interface CometCardsStore {
  game: GameState
  setGame: (game: GameState) => void
  clearGame: () => void
  setGamePhase: (gamePhase: GamePhase) => void
  addMoney: (amount: number) => void
  dispatch: (event: GameEvent) => void
}

/**
 * Custom JSON serialization that handles bigint values.
 * bigint is stored as `{ __bigint: "123" }` and restored on parse.
 */
function serialize(state: unknown): string {
  return JSON.stringify(state, (_key, value) =>
    typeof value === 'bigint' ? { __bigint: value.toString() } : value
  )
}

function deserialize(str: string): unknown {
  return JSON.parse(str, (_key, value) => {
    if (value && typeof value === 'object' && '__bigint' in value) {
      return BigInt(value.__bigint)
    }
    return value
  })
}

export const useCometCardsStore = create<CometCardsStore>()(
  persist(
    set => ({
      game: defaultGameState,
      setGame: game => set({ game }),
      clearGame: () => set({ game: defaultGameState }),
      setGamePhase: (gamePhase: GamePhase) =>
        set(state => ({ game: { ...state.game, gamePhase } })),
      addMoney: (amount: number) =>
        set(state => ({ game: { ...state.game, money: state.game.money + amount } })),
      dispatch: (event: GameEvent) => set(state => ({ game: reduceGame(state.game, event) })),
    }),
    {
      name: 'comet-cards-game',
      partialize: state => ({ game: state.game }),
      storage: {
        getItem: name => {
          if (typeof window === 'undefined') return null
          const str = localStorage.getItem(name)
          if (!str) return null
          return deserialize(str) as { state: { game: GameState }; version: number }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return
          localStorage.setItem(name, serialize(value))
        },
        removeItem: name => {
          if (typeof window === 'undefined') return
          localStorage.removeItem(name)
        },
      },
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0 || !persisted) return { game: defaultGameState }
        return persisted as { game: GameState }
      },
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current

        const persistedState = persisted as { game?: GameState }
        if (!persistedState.game) return current

        // If the persisted seed doesn't match today, start fresh
        const todaySeed = getCurrentDayAsSeedString()
        if (persistedState.game.gameSeed !== todaySeed) {
          return current
        }

        // If the game was on mainMenu or gameOver, start fresh
        if (
          persistedState.game.gamePhase === 'mainMenu' ||
          persistedState.game.gamePhase === 'gameOver'
        ) {
          return current
        }

        return { ...current, game: persistedState.game }
      },
    }
  )
)

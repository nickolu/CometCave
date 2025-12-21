'use client'

import { create } from 'zustand'

import type { GameEvent } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

import { defaultGameState } from './domain/game/default-game-state'
import { reduceGame } from './domain/game/reduce-game'

export interface DailyCardGameStore {
  game: GameState
  setGame: (game: GameState) => void
  clearGame: () => void
  dispatch: (event: GameEvent) => void
}

export const useDailyCardGameStore = create<DailyCardGameStore>()(set => ({
  game: defaultGameState,
  setGame: game => set({ game }),
  clearGame: () => set({ game: defaultGameState }),
  dispatch: (event: GameEvent) => set(state => ({ game: reduceGame(state.game, event) })),
}))

import { create } from 'zustand'
import type { HudData } from './domain/types'

type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat'

interface SpeckWarsStore {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  winnerId: string | null
  setWinnerId: (id: string) => void
  hud: HudData | null
  setHud: (data: HudData) => void
}

export const useSpeckWarsStore = create<SpeckWarsStore>()(set => ({
  phase: 'menu',
  setPhase: phase => set({ phase }),
  winnerId: null,
  setWinnerId: winnerId => set({ winnerId }),
  hud: null,
  setHud: hud => set({ hud }),
}))

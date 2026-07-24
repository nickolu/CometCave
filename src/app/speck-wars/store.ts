import { create } from 'zustand'

type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat'

interface SpeckWarsStore {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
}

export const useSpeckWarsStore = create<SpeckWarsStore>()(set => ({
  phase: 'menu',
  setPhase: phase => set({ phase }),
}))

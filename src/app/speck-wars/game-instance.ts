import { createSim } from './domain/simulation/create-sim'
import { tick } from './domain/simulation/tick'
import type { SimulationState } from './domain/types'
import { useSpeckWarsStore } from './store'

export class GameInstance {
  private canvas: HTMLCanvasElement
  private sim: SimulationState
  private rafId: number | null = null
  private lastTime: number = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.sim = createSim()
  }

  start() {
    console.log('GameInstance started')
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private loop = (now: number) => {
    const dt = Math.min(now - this.lastTime, 50)  // cap at 50ms to avoid spiral-of-death
    this.lastTime = now

    this.sim = tick(this.sim, dt)

    // Forward sim events to Zustand store
    for (const event of this.sim.events) {
      if (event.type === 'GAME_OVER') {
        useSpeckWarsStore.getState().setPhase('victory')
      }
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    console.log('GameInstance destroyed')
  }

  getSim(): SimulationState {
    return this.sim
  }
}

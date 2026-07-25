import type { SimulationState } from '../types'

export function updateUnitAbilities(sim: SimulationState, dt: number) {
  for (let i = 0; i < sim.speckCount; i++) {
    const meta = sim.speckMeta[i]
    if (!meta) continue
    if (meta.chargeTimer && meta.chargeTimer > 0) {
      meta.chargeTimer = Math.max(0, meta.chargeTimer - dt)
    }
    if (meta.cloakTimer && meta.cloakTimer > 0) {
      meta.cloakTimer = Math.max(0, meta.cloakTimer - dt)
    }
  }
}

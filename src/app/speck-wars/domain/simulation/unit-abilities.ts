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
    if (meta.stunTimer && meta.stunTimer > 0) {
      meta.stunTimer = Math.max(0, meta.stunTimer - dt)
    }
    if (meta.commanderAbilityCooldown && meta.commanderAbilityCooldown > 0) {
      meta.commanderAbilityCooldown = Math.max(0, meta.commanderAbilityCooldown - dt)
    }
    if (meta.commanderAbilityActive && meta.commanderAbilityActive > 0) {
      meta.commanderAbilityActive = Math.max(0, meta.commanderAbilityActive - dt)
    }
    if (meta.speedBoostTimer && meta.speedBoostTimer > 0) {
      meta.speedBoostTimer = Math.max(0, meta.speedBoostTimer - dt)
    }
  }
}

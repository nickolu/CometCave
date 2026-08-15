/**
 * Spawner tick — emit one creature per placed spawner when its cooldown expires.
 */
import type { SimEvent } from './creature-sim'
import { countByBlueprint, spawnCreature } from './world'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { WorldState } from '@/app/micro-land/domain/types'
import { deltaX } from '@/app/micro-land/domain/wrap'

/**
 * Radius in tiles that counts as "local" for the per-spawner population cap.
 * Any creature of the same species within this range counts toward maxLocal.
 */
const SPAWNER_LOCAL_RADIUS = 10

export function tickSpawners(w: WorldState, dt: number, events: SimEvent[]): void {
  if (w.spawners.length === 0) return

  // Count creatures per species once for all spawners this tick.
  const globalCount = countByBlueprint(w)

  for (const spawner of w.spawners) {
    spawner.cooldown -= dt
    if (spawner.cooldown > 0) continue

    // Reset for next emission before the cap checks — so a capped tick still
    // delays the next attempt by a full interval, not by zero.
    spawner.cooldown = spawner.intervalSeconds

    const bp = w.blueprints[spawner.blueprintId]
    if (!bp) continue

    // Global species cap: don't flood the world beyond its carrying capacity.
    const isPlant = bp.move.kind === 'root'
    const globalCap = isPlant ? TUNING.plantSpeciesCap : TUNING.speciesSoftCap
    if ((globalCount[spawner.blueprintId] ?? 0) >= globalCap) continue

    // Local population cap: don't pile creatures at the spawner position.
    // Walk the population once per spawner — spawners are rare, so this is fine.
    const r2 = SPAWNER_LOCAL_RADIUS * SPAWNER_LOCAL_RADIUS
    let nearby = 0
    for (const c of w.creatures) {
      if (c.blueprintId !== spawner.blueprintId) continue
      // deltaX handles horizontal world wrapping.
      const dx = deltaX(spawner.x, c.x)
      const dy = c.y - spawner.y
      if (dx * dx + dy * dy <= r2) {
        nearby++
        if (nearby >= spawner.maxLocal) break
      }
    }
    if (nearby >= spawner.maxLocal) continue

    // Place one creature at the spawner position.
    const creature = spawnCreature(w, bp, spawner.x, spawner.y)
    if (!creature) continue // global creature ceiling (TUNING.maxCreatures) reached

    // Update the running count so a cluster of spawners in the same tick
    // each sees the previous one's contribution.
    globalCount[spawner.blueprintId] = (globalCount[spawner.blueprintId] ?? 0) + 1

    events.push({ kind: 'born', blueprintId: spawner.blueprintId, x: spawner.x, y: spawner.y })
  }
}

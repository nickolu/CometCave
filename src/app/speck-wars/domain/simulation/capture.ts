import type { SimulationState } from '../types'
import { CAPTURE_RADIUS, CAPTURE_TIME } from '../constants'

export function updateCapture(sim: SimulationState, dt: number) {
  for (const building of Object.values(sim.buildings)) {
    if (building.typeId !== 'outpost') continue

    // Count nearby specks by owner (not neutral)
    const counts: Record<string, number> = {}
    const nearby = sim.spatialGrid.query(building.x, building.y)
    const r2 = CAPTURE_RADIUS * CAPTURE_RADIUS
    for (const idx of nearby) {
      const meta = sim.speckMeta[idx]
      if (!meta || meta.ownerId === 'neutral') continue
      const dx = sim.speckX[idx] - building.x
      const dy = sim.speckY[idx] - building.y
      if (dx * dx + dy * dy > r2) continue
      counts[meta.ownerId] = (counts[meta.ownerId] ?? 0) + 1
    }

    // Find player-owned specks (exclude neutral)
    const sides = Object.entries(counts).filter(([, n]) => n > 0)
    if (sides.length === 0) return  // nobody near — decay progress slowly
    if (sides.length > 1) continue  // contested — pause capture

    const [dominantOwner, dominantCount] = sides[0]
    if (dominantOwner === building.ownerId) continue  // already owned by them

    // Start or continue capture
    if (building.captureSide !== dominantOwner) {
      building.captureSide = dominantOwner
      building.captureProgress = 0
    }

    // Scale capture speed with speck count: 5 specks = 1×, capped at 3× (15 specks)
    const captureSpeed = Math.min(3, dominantCount / 5)
    building.captureProgress = (building.captureProgress ?? 0) + (dt / CAPTURE_TIME) * captureSpeed
    if ((building.captureProgress ?? 0) >= 1) {
      const previousOwner = building.ownerId
      building.ownerId = dominantOwner
      building.captureProgress = 0
      building.captureSide = null
      // Reset spawn timer so it starts fresh for the new owner
      building.spawnTimer = 0
      sim.events.push({
        type: 'OUTPOST_CAPTURED',
        outpostId: building.id,
        newOwner: dominantOwner,
        previousOwner,
      })
    }
  }
}

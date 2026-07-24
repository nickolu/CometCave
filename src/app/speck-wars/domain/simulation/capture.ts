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
    if (sides.length === 0) continue  // nobody near — decay progress slowly
    if (sides.length > 1) {
      // Contested tug-of-war: dominant side (more specks) reverses enemy capture progress.
      // Neither side can GAIN progress — only erase the enemy's progress.
      sides.sort((a, b) => b[1] - a[1])
      const [topOwner, topCount] = sides[0]
      const [, secondCount] = sides[1]
      if (topCount > secondCount) {
        const hasEnemyProgress = (building.captureProgress ?? 0) > 0 &&
          building.captureSide && building.captureSide !== topOwner
        if (hasEnemyProgress) {
          const captureTimeMs = sim.dailyModifier === 'siege' ? CAPTURE_TIME * 2 : CAPTURE_TIME
          const reverseSpeed = Math.min(1.5, (topCount - secondCount) / 5)
          building.captureProgress = Math.max(0, (building.captureProgress ?? 0) - (dt / captureTimeMs) * reverseSpeed * 0.5)
          if ((building.captureProgress ?? 0) <= 0) building.captureSide = null
        }
      }
      continue  // never allow capture completion when contested
    }

    const [dominantOwner, dominantCount] = sides[0]
    if (dominantOwner === building.ownerId) continue  // already owned by them

    // Start or continue capture
    if (building.captureSide !== dominantOwner) {
      building.captureSide = dominantOwner
      building.captureProgress = 0
    }

    // Scale capture speed with speck count: 5 specks = 1×, capped at 3× (15 specks)
    const captureTimeMs = sim.dailyModifier === 'siege' ? CAPTURE_TIME * 2 : CAPTURE_TIME
    const captureSpeed = Math.min(3, dominantCount / 5)
    building.captureProgress = (building.captureProgress ?? 0) + (dt / captureTimeMs) * captureSpeed
    if ((building.captureProgress ?? 0) >= 1) {
      const previousOwner = building.ownerId
      building.ownerId = dominantOwner
      building.fortifyDuration = 0
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

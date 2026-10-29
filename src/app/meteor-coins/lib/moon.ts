import type { Vec } from '@/app/meteor-coins/lib/cannon'

/**
 * Gravity Assist's moon: a small moon circling above the table that pulls on
 * everything in the air, so falling coins visibly bend toward it.
 *
 * Under the arm it pulled across and up or down, never toward the front: the
 * drop line hugs the back wall because that's where the pusher clears the
 * shelf, and a coin pulled forward landed on top of the pile and rode it.
 * (Measured: with a full 3D pull, timed drops scored no better than random
 * ones.) A stage can set `pullZ` for a delivery that flies coins front to
 * back, where how hard you launch makes up for the pull (see Gravity Assist).
 *
 * The pull is applied the same way every step — added to an airborne body's
 * velocity just before the physics steps — so lib/cannon's flightPath, given
 * the same pull, predicts a fall exactly. Objects resting on the table
 * (anything below `minY`) don't feel it: the pile never creeps toward it.
 */
export type MoonConfig = {
  /** The middle of its orbit, and how far the orbit reaches across and front to back. */
  center: Vec
  radiusX: number
  radiusZ: number
  /** Seconds per orbit, in arm time, so the slower arm slows it too. */
  periodS: number
  /** Pull at distance d: strength / (d² + softening²), toward the moon. */
  strength: number
  softening: number
  /** Only things higher than this feel the pull. */
  minY: number
  /** Whether it pulls front to back too, not only across and up or down. */
  pullZ?: boolean
}

/** Where the moon is at arm time `t`. */
export function moonAt(t: number, m: MoonConfig): Vec {
  const a = (2 * Math.PI * t) / m.periodS
  return {
    x: m.center.x + m.radiusX * Math.sin(a),
    y: m.center.y,
    z: m.center.z + m.radiusZ * Math.cos(a),
  }
}

/** The moon's pull (an acceleration) on a body at `p`, with the moon at `moon`. */
export function moonPull(p: Vec, moon: Vec, m: MoonConfig): Vec {
  if (p.y < m.minY) return { x: 0, y: 0, z: 0 }
  const dx = moon.x - p.x
  const dy = moon.y - p.y
  const d = Math.hypot(dx, dy, moon.z - p.z)
  if (d === 0) return { x: 0, y: 0, z: 0 }
  const a = m.strength / (d * d + m.softening * m.softening) / d
  return { x: dx * a, y: dy * a, z: m.pullZ ? (moon.z - p.z) * a : 0 }
}

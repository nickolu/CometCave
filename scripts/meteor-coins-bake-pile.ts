/**
 * Bakes a Meteor Coins stage's starting pile into src/app/meteor-coins/lib/piles/<name>.json.
 *
 *   npx tsx scripts/meteor-coins-bake-pile.ts <stage> [seed=1] [floorCoins=150]
 *
 * Drops coins at random onto an empty table, runs the pusher until a full
 * cycle passes with nothing falling, and saves every resting coin's pose.
 * The result looks like a machine already in play — heaped unevenly, coins
 * hanging at the edge — and since it's a file, every player gets exactly the
 * same start. (Simulating it at load wouldn't be fair: this physics build
 * isn't guaranteed bit-identical across devices.)
 *
 * The stage's own table settings (pusher timing) are used, and the pile is
 * written to lib/piles/<stage>.json; a new stage also needs its pile added
 * to lib/piles.ts. Re-run after changing puck size or table geometry, then
 * check the result with scripts/meteor-coins-sim.ts.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  FIELD_FRONT_Z,
  PHYSICS_STEP_S,
  PUCK_RADIUS,
  PUCK_THICKNESS,
} from '@/app/meteor-coins/lib/cabinet'
import { PusherEngine, initPhysics } from '@/app/meteor-coins/lib/engine'
import type { PuckPose } from '@/app/meteor-coins/lib/piles'
import { findStage } from '@/app/meteor-coins/lib/stages'

const MAX_CYCLES = 15

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000

async function main() {
  const stage = findStage(process.argv[2] ?? '')
  if (!stage?.playable)
    throw new Error('Usage: meteor-coins-bake-pile.ts <stage> [seed] [floorCoins]')
  const OUT = join(process.cwd(), `src/app/meteor-coins/lib/piles/${stage.slug}.json`)
  const STEPS_PER_CYCLE = Math.round(stage.table.pusherPeriodS / PHYSICS_STEP_S)
  const seed = Number(process.argv[3] ?? 1)
  const floorCoins = Number(process.argv[4] ?? 150)
  const topCoins = 16
  await initPhysics()
  const rand = rng(seed)
  const engine = new PusherEngine({ pile: [], ...stage.table })
  let steps = 0
  const step = () => {
    steps++
    return engine.step()
  }

  // Low drops, one every 3 steps, scattered across the floor and pusher top.
  const drops: [number, number, number][] = []
  for (let i = 0; i < floorCoins; i++) {
    drops.push([(rand() - 0.5) * 6.6, 0.6 + rand(), -0.6 + rand() * (FIELD_FRONT_Z - 0.3 + 0.6)])
  }
  for (let i = 0; i < topCoins; i++)
    drops.push([(rand() - 0.5) * 6.6, 1.2 + rand() * 0.5, -5 + rand() * 2.4])
  for (const [x, y, z] of drops) {
    engine.spawn(x, y, z, 'seed', rand() * Math.PI * 2)
    for (let s = 0; s < 3; s++) step()
  }

  // Finish the current pusher cycle, then run whole cycles until one passes
  // with nothing falling. Ending on a cycle boundary means the pusher is
  // exactly where a new game starts it.
  while (steps % STEPS_PER_CYCLE !== 0) step()
  let cycles = 0
  let fellLastCycle = Infinity
  while (fellLastCycle > 0 && cycles < MAX_CYCLES) {
    fellLastCycle = 0
    for (let s = 0; s < STEPS_PER_CYCLE; s++) fellLastCycle += step().length
    cycles++
  }
  if (fellLastCycle > 0) throw new Error(`Pile still shedding coins after ${MAX_CYCLES} cycles`)

  const pile: PuckPose[] = engine.pucks
    .filter(p => p.active)
    .map(p => {
      const t = p.body.translation()
      const q = p.body.rotation()
      return {
        p: [round(t.x), round(t.y), round(t.z)],
        q: [round(q.x), round(q.y), round(q.z), round(q.w)],
      }
    })
  engine.dispose()

  writeFileSync(OUT, JSON.stringify(pile) + '\n')
  const overhang = pile.filter(c => c.p[2] > FIELD_FRONT_Z - PUCK_RADIUS).length
  console.log(
    `seed ${seed}: ${pile.length} coins (thickness ${PUCK_THICKNESS}), ${overhang} hanging over the edge, ` +
      `settled after ${cycles} pusher cycles → ${OUT}`
  )
}

main()

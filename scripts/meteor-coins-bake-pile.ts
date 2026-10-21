/**
 * Bakes a Meteor Coins stage's starting pile into src/app/meteor-coins/lib/piles/<name>.json.
 *
 *   npx tsx scripts/meteor-coins-bake-pile.ts <stage> [seed] [floorCoins]
 *
 * Follows the stage's recipe (`bake` in lib/stages.ts; the seed and floor
 * count can be overridden to try variants). Places the stage's special
 * objects in their zones, then drops its pool object at random, runs the pusher until a full
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
  deckDir,
  overEdge,
} from '@/app/meteor-coins/lib/cabinet'
import { PusherEngine, initPhysics } from '@/app/meteor-coins/lib/engine'
import { OBJECTS } from '@/app/meteor-coins/lib/objects'
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
  const recipe = stage.bake
  if (!recipe) throw new Error(`${stage.name} starts on a bare table; there's no pile to bake`)
  const seed = Number(process.argv[3] ?? recipe.seed)
  const floorCoins = process.argv[4] ? Number(process.argv[4]) : recipe.floor
  const topCoins = recipe.top
  await initPhysics()
  const rand = rng(seed)
  const engine = new PusherEngine({ pile: [], ...stage.table, poolObject: stage.objects.drop })

  // Specials first, spread evenly across their zone (jittered) so they don't
  // land on each other; the pile then settles around them.
  for (const { object, count, x, z } of recipe.specials ?? []) {
    for (let i = 0; i < count; i++) {
      const px = x[0] + ((x[1] - x[0]) * (i + 0.2 + rand() * 0.6)) / count
      const pz = z[0] + (z[1] - z[0]) * rand()
      const yaw = rand() * Math.PI * 2
      engine.addSpecial(OBJECTS[object], {
        p: [px, 0.4, pz],
        q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      })
    }
  }
  for (let s = 0; s < 30; s++) engine.step()
  let steps = 0
  const step = () => {
    steps++
    return engine.step()
  }

  // Low drops, one every 3 steps, scattered across the floor and pusher top.
  const drops: [number, number, number][] = []
  const layout = engine.layout
  if (typeof floorCoins === 'number' && typeof topCoins === 'number') {
    for (let i = 0; i < floorCoins; i++) {
      drops.push([(rand() - 0.5) * 6.6, 0.6 + rand(), -0.6 + rand() * (FIELD_FRONT_Z - 0.3 + 0.6)])
    }
    for (let i = 0; i < topCoins; i++)
      drops.push([(rand() - 0.5) * 6.6, 1.2 + rand() * 0.5, -5 + rand() * 2.4])
  } else {
    // Several decks: each deck's coins over its shelf, from its pusher's
    // face at full reach to its edge, then each one's pusher top, so those
    // land on a pile. (Written out per direction, so a deck facing the
    // usual way scatters exactly as it always has.)
    const floors = typeof floorCoins === 'number' ? [floorCoins] : floorCoins
    const tops = typeof topCoins === 'number' ? [topCoins] : topCoins
    layout.forEach((deck, i) => {
      const dir = deckDir(deck)
      const faceMax = deck.pusher.midZ + dir * deck.pusher.ampZ + (dir * deck.pusher.depth) / 2
      for (let n = 0; n < (floors[i] ?? 0); n++) {
        const z = faceMax - dir * 0.6 + rand() * (deck.frontZ - dir * 0.3 - faceMax + dir * 0.6)
        drops.push([(rand() - 0.5) * 6.6, deck.floorY + 0.6 + rand(), z])
      }
    })
    layout.forEach((deck, i) => {
      const dir = deckDir(deck)
      const faceMin = deck.pusher.midZ - dir * deck.pusher.ampZ + (dir * deck.pusher.depth) / 2
      for (let n = 0; n < (tops[i] ?? 0); n++) {
        const z = deck.backZ + dir * 0.5 + rand() * (faceMin - dir * 0.6 - deck.backZ - dir * 0.5)
        drops.push([(rand() - 0.5) * 6.6, deck.floorY + 1.2 + rand() * 0.5, z])
      }
    })
  }
  for (const [x, y, z] of drops) {
    if (engine.spawn(x, y, z, 'seed', rand() * Math.PI * 2) === null) break
    for (let s = 0; s < 3; s++) step()
  }

  // Finish the current pusher cycle, then run whole cycles until one passes
  // with nothing falling. Ending on a cycle boundary means the pusher is
  // exactly where a new game starts it.
  while (steps % STEPS_PER_CYCLE !== 0) step()
  const cycles = settle(engine, STEPS_PER_CYCLE)

  // The game loads a pile with its bodies in a different order (pool first,
  // specials after), and a coin balanced on the lip can tip under the new
  // order. So reload the pile exactly as the game will and check it holds
  // for two cycles; if it doesn't, settle the reloaded table and try again.
  let current = engine
  let pile = exportPile(current)
  for (let attempt = 0; ; attempt++) {
    const loaded = new PusherEngine({ ...stage.table, poolObject: stage.objects.drop, pile })
    let fell = 0
    for (let s = 0; s < STEPS_PER_CYCLE * 2; s++) fell += loaded.step().length
    if (fell === 0) {
      loaded.dispose()
      break
    }
    if (attempt === 4) throw new Error('Pile keeps shedding coins once reloaded')
    current.dispose()
    current = loaded
    settle(current, STEPS_PER_CYCLE)
    pile = exportPile(current)
  }
  current.dispose()

  const overhang = pile.filter(c => overEdge(layout, c.p[2]) > -PUCK_RADIUS).length
  const specials = pile.filter(c => c.o).map(c => `${c.o} z=${c.p[2].toFixed(1)}`)
  // Same bound as piles.test.ts: a coin propped further out than this may
  // fall before the first drop on some devices.
  const precarious = pile.filter(c => {
    const reach = (c.o ? OBJECTS[c.o] : stage.objects.drop).reach
    return overEdge(layout, c.p[2]) >= reach / 2
  })
  if (precarious.length) {
    throw new Error(`${precarious.length} objects propped too far over the lip; try another seed`)
  }
  const placed = (recipe.specials ?? []).reduce((n, s) => n + s.count, 0)
  if (specials.length < placed) {
    throw new Error(`Only ${specials.length} of ${placed} special objects survived the bake`)
  }
  writeFileSync(OUT, JSON.stringify(pile) + '\n')
  console.log(
    `seed ${seed}: ${pile.length} objects (coin thickness ${PUCK_THICKNESS}), ${overhang} hanging over the edge, ` +
      `settled after ${cycles} pusher cycles → ${OUT}` +
      (specials.length ? `\n  specials: ${specials.join(', ')}` : '')
  )
}

/** Runs whole pusher cycles until one passes with nothing falling. Returns the count. */
function settle(engine: PusherEngine, stepsPerCycle: number): number {
  let cycles = 0
  let fellLastCycle = Infinity
  while (fellLastCycle > 0 && cycles < MAX_CYCLES) {
    fellLastCycle = 0
    for (let s = 0; s < stepsPerCycle; s++) fellLastCycle += engine.step().length
    cycles++
  }
  if (fellLastCycle > 0) throw new Error(`Pile still shedding coins after ${MAX_CYCLES} cycles`)
  return cycles
}

function exportPile(engine: PusherEngine): PuckPose[] {
  return engine.pucks
    .filter(p => p.active)
    .map(p => {
      const t = p.body.translation()
      const q = p.body.rotation()
      const pose: PuckPose = {
        p: [round(t.x), round(t.y), round(t.z)],
        q: [round(q.x), round(q.y), round(q.z), round(q.w)],
      }
      if (p.kind === 'special') pose.o = p.spec.id as PuckPose['o']
      return pose
    })
}

main()

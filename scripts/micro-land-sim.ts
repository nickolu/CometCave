/**
 * Headless Micro Land harness.
 *
 * The world is only interesting if populations rise and fall instead of
 * flatlining at zero, and you cannot see that in a screenshot — a browser tells
 * you what one instant looks like, not whether the ecosystem survives ten
 * minutes. This runs the real simulation with no canvas and prints the
 * population over time.
 *
 * Usage:
 *   npx tsx scripts/micro-land-sim.ts                       # earth, 300s
 *   npx tsx scripts/micro-land-sim.ts --theme tidepool --seconds 600
 *   npx tsx scripts/micro-land-sim.ts --runs 5              # average of 5 seeds
 *   npx tsx scripts/micro-land-sim.ts --set nativePlantTarget=60 --set maxPlants=300
 *
 * `--set` moves the same knobs the in-game settings panel moves, which is what
 * makes a value found by dragging a slider testable: drag until the world looks
 * right, then run the ten-minute ecosystem check on that number before it
 * becomes the default.
 */
import { THEMES, THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import { TICK_S } from '@/app/micro-land/domain/constants'
import { type SimEvent, tickCreatures } from '@/app/micro-land/domain/sim/creature-sim'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { tickTiles } from '@/app/micro-land/domain/sim/tile-sim'
import {
  applyTheme,
  countByBlueprint,
  createWorld,
  seedStarters,
} from '@/app/micro-land/domain/sim/world'
import {
  TUNING,
  TUNING_DEFAULTS,
  type TuningKey,
  changedKnobs,
  setTuning,
} from '@/app/micro-land/domain/tuning'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const themeId = arg('theme', 'earth')
const seconds = Number(arg('seconds', '300'))
const runs = Number(arg('runs', '1'))
const quiet = process.argv.includes('--quiet')

if (!THEME_BY_ID[themeId]) {
  console.error(`Unknown theme "${themeId}". Try: ${THEMES.map(t => t.id).join(', ')}`)
  process.exit(1)
}

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] !== '--set') continue
  const [key, raw] = (process.argv[i + 1] ?? '').split('=')
  if (!(key in TUNING_DEFAULTS) || !Number.isFinite(Number(raw))) {
    console.error(
      `Bad --set "${process.argv[i + 1] ?? ''}". Knobs: ${Object.keys(TUNING_DEFAULTS).join(', ')}`
    )
    process.exit(1)
  }
  setTuning({ [key as TuningKey]: Number(raw) })
}

// Printed rather than assumed. A run whose numbers were quietly moved is worth
// nothing as a before-and-after unless the header says what moved.
const tuned = changedKnobs()
if (tuned.length > 0 && !quiet) {
  console.log(
    `tuning: ${tuned.map(k => `${k}=${TUNING[k]} (was ${TUNING_DEFAULTS[k]})`).join(', ')}`
  )
}

interface RunResult {
  survivors: Record<string, number>
  extinctions: string[]
  peak: number
  minAfterSettle: number
  /** blueprintId → cause → count. The only way to tell starvation from lava. */
  deaths: Record<string, Record<string, number>>
  /** blueprintId → { plants, animals } eaten. Predation you can actually see. */
  meals: Record<string, { plants: number; animals: number }>
  /** Share of the world still made of something, 0..1. */
  solidFraction: number
  /** Tiles tunnelled through by creatures still alive at the end. */
  dug: number
}

function runOnce(seed: number): RunResult {
  const world = createWorld(seed)
  const rng = makeRng(seed ^ 0x9e3779b9)
  applyTheme(world, themeId, seed)
  seedStarters(world, themeId, rng)

  const theme = THEME_BY_ID[themeId]
  const seeded = new Set(Object.keys(countByBlueprint(world)))

  const totalTicks = Math.floor(seconds / TICK_S)
  const sampleEvery = Math.floor(totalTicks / 10)
  let tileCounter = 0
  let peak = world.creatures.length
  let minAfterSettle = Infinity
  const deaths: Record<string, Record<string, number>> = {}
  const meals: Record<string, { plants: number; animals: number }> = {}

  if (!quiet) {
    console.log(`\n── ${theme.name} · seed ${seed} ─────────────────────────`)
    console.log(`t=0s   ${format(countByBlueprint(world), world)}`)
  }

  for (let tick = 1; tick <= totalTicks; tick++) {
    const events: SimEvent[] = []
    world.elapsed += TICK_S
    if (++tileCounter >= 3) {
      tileCounter = 0
      tickTiles(world)
    }
    tickCreatures(world, TICK_S, rng, theme.gravity, events)

    for (const e of events) {
      if (e.kind === 'born') continue
      if (e.kind === 'ate') {
        // A meal is not a death — it's the hunter's side of someone else's.
        meals[e.blueprintId] ??= { plants: 0, animals: 0 }
        const victim = e.victimId ? world.blueprints[e.victimId] : undefined
        if (victim?.move.kind === 'root') meals[e.blueprintId].plants++
        else meals[e.blueprintId].animals++
        continue
      }
      deaths[e.blueprintId] ??= {}
      deaths[e.blueprintId][e.kind] = (deaths[e.blueprintId][e.kind] ?? 0) + 1
    }

    peak = Math.max(peak, world.creatures.length)
    // Ignore the first 20s — the opening scramble is not the steady state.
    if (world.elapsed > 20) {
      minAfterSettle = Math.min(minAfterSettle, world.creatures.length)
    }

    if (!quiet && sampleEvery > 0 && tick % sampleEvery === 0) {
      console.log(
        `t=${Math.round(world.elapsed)}s`.padEnd(7) + format(countByBlueprint(world), world)
      )
    }
  }

  // How much of the map got eaten by diggers? A tunnel network is the point;
  // a world with no walls left is a bug.
  let solidLeft = 0
  for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] !== 0) solidLeft++
  const dug = world.creatures.reduce((a, c) => a + c.tilesDug, 0)

  const survivors = countByBlueprint(world)
  const extinctions = [...seeded].filter(id => !survivors[id])

  return {
    survivors,
    extinctions,
    peak,
    minAfterSettle: minAfterSettle === Infinity ? 0 : minAfterSettle,
    deaths,
    meals,
    solidFraction: solidLeft / world.tiles.length,
    dug,
  }
}

function format(counts: Record<string, number>, world: ReturnType<typeof createWorld>) {
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${world.blueprints[id]?.name ?? id}:${n}`)
  return `total=${world.creatures.length.toString().padEnd(4)} ${parts.join('  ') || '(empty)'}`
}

const results: RunResult[] = []
for (let i = 0; i < runs; i++) results.push(runOnce(1000 + i * 7919))

console.log(`\n══ Summary over ${runs} run(s), ${seconds}s each ══════════`)

const allSpecies = new Set<string>()
for (const r of results) {
  for (const id of Object.keys(r.survivors)) allSpecies.add(id)
  for (const id of r.extinctions) allSpecies.add(id)
}

for (const id of [...allSpecies].sort()) {
  const counts = results.map(r => r.survivors[id] ?? 0)
  const avg = counts.reduce((a, b) => a + b, 0) / runs
  const extinctIn = results.filter(r => r.extinctions.includes(id)).length
  const flag =
    extinctIn === runs
      ? '  ← EXTINCT in every run'
      : extinctIn > 0
        ? `  ← extinct in ${extinctIn}/${runs}`
        : ''

  // Aggregate causes of death so a collapse can be attributed, not guessed at.
  const causes: Record<string, number> = {}
  for (const r of results) {
    for (const [cause, n] of Object.entries(r.deaths[id] ?? {})) {
      causes[cause] = (causes[cause] ?? 0) + n
    }
  }
  const causeText = Object.entries(causes)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, n]) => `${cause} ${Math.round(n / runs)}`)
    .join(', ')
  let plants = 0
  let animals = 0
  for (const r of results) {
    plants += r.meals[id]?.plants ?? 0
    animals += r.meals[id]?.animals ?? 0
  }

  console.log(`  ${id.padEnd(16)} avg ${avg.toFixed(1).padStart(6)}${flag}`)
  if (causeText) console.log(`  ${''.padEnd(16)} died: ${causeText}`)
  if (plants + animals > 0) {
    console.log(
      `  ${''.padEnd(16)} ate: ${Math.round(plants / runs)} plants, ` +
        `${Math.round(animals / runs)} animals`
    )
  }
}

const avgPeak = results.reduce((a, r) => a + r.peak, 0) / runs
const avgMin = results.reduce((a, r) => a + r.minAfterSettle, 0) / runs
const totalAlive = results.reduce(
  (a, r) => a + Object.values(r.survivors).reduce((x, y) => x + y, 0),
  0
)
console.log(`\n  peak population   ${avgPeak.toFixed(0)}`)
console.log(`  low water mark    ${avgMin.toFixed(0)}`)
console.log(`  alive at the end  ${(totalAlive / runs).toFixed(0)}`)
console.log(
  `  world still solid ${((results.reduce((a, r) => a + r.solidFraction, 0) / runs) * 100).toFixed(0)}%`
)
console.log(
  `  tunnelled (live)  ${(results.reduce((a, r) => a + r.dug, 0) / runs).toFixed(0)} tiles`
)
console.log(
  totalAlive === 0
    ? '\n  ✗ Everything died. The world is not self-sustaining.\n'
    : '\n  ✓ Still alive.\n'
)

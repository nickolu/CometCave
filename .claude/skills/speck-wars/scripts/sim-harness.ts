/**
 * Speck Wars headless simulation harness.
 *
 * Drives createSim + tick + AIController in Node with no Pixi and no DOM, so balance
 * questions can be answered in seconds instead of by playing the game twenty times.
 *
 * Usage (from repo root):
 *   npx tsx .claude/skills/speck-wars/scripts/sim-harness.ts
 *   npx tsx .claude/skills/speck-wars/scripts/sim-harness.ts --games 20 --difficulty medium,hard
 *   npx tsx .claude/skills/speck-wars/scripts/sim-harness.ts --games 1 --seed 12345 --json
 *
 * Flags:
 *   --games N          games per difficulty (default 5)
 *   --difficulty a,b   easy | medium | hard | very-hard (default easy,medium,hard)
 *   --map NAME         random | open | canyon | river | pillars | walls (default open)
 *   --personality P    aggressive | macro | balanced (default balanced)
 *   --seed N           base seed; game i uses seed+i (default 1)
 *   --max-mins N       give up after N sim-minutes and record a timeout (default 15)
 *   --json             emit raw JSON instead of the summary table
 *
 * NOTE: the sim is NOT deterministic at runtime — only map layout and daily modifier are
 * seeded. The same seed gives different outcomes each run. Never draw a conclusion from a
 * single game; use --games 20+ and compare win-rate bands.
 *
 * The simulated player is fully passive: it issues no commands at all. This measures the
 * game's own drift, which is the right baseline for spawn/damage/capture tuning. To model
 * an active player, push InputEvents onto sim.inputQueue inside the loop below.
 */
import { AIController, type AIPersonality } from '@/app/speck-wars/domain/ai/ai-controller'
import { createSim } from '@/app/speck-wars/domain/simulation/create-sim'
import { tick } from '@/app/speck-wars/domain/simulation/tick'
import type { Difficulty, MapPreset } from '@/app/speck-wars/store'

const DT = 16 // ms per tick, matching the ~60fps game loop

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (name: string) => process.argv.includes(`--${name}`)

const GAMES = parseInt(arg('games', '5'))
const DIFFICULTIES = arg('difficulty', 'easy,medium,hard').split(',') as Difficulty[]
const MAP = arg('map', 'open') as MapPreset
const PERSONALITY = arg('personality', 'balanced') as AIPersonality
const BASE_SEED = parseInt(arg('seed', '1'))
const MAX_TICKS = parseFloat(arg('max-mins', '15')) * 60_000 / DT

interface GameResult {
  seed: number
  difficulty: Difficulty
  winner: string
  victoryType: string | null
  simMinutes: number
  peakSpecks: number
  outpostFlips: number
  modifier: string
}

function runGame(seed: number, difficulty: Difficulty): GameResult {
  const sim = createSim(seed, difficulty, MAP)
  const ai = new AIController('ai', 30, PERSONALITY, difficulty === 'very-hard')

  let winner: string | null = null
  let victoryType: string | null = null
  let peakSpecks = 0
  let outpostFlips = 0
  let t = 0

  for (; t < MAX_TICKS && !winner; t++) {
    ai.update(sim, DT)
    tick(sim, DT)

    for (const e of sim.events) {
      if (e.type === 'GAME_OVER') { winner = e.winnerId; victoryType = e.victoryType }
      if (e.type === 'OUTPOST_CAPTURED') outpostFlips++
    }
    // The real game drains the queue via GameInstance; nothing does that here.
    sim.inputQueue.length = 0

    if (t % 60 === 0) {
      let live = 0
      for (let i = 0; i < sim.speckCount; i++) if (sim.speckMeta[i]) live++
      if (live > peakSpecks) peakSpecks = live
    }
  }

  return {
    seed, difficulty,
    winner: winner ?? 'timeout',
    victoryType,
    simMinutes: +(t * DT / 60_000).toFixed(2),
    peakSpecks, outpostFlips,
    modifier: sim.dailyModifier,
  }
}

const started = process.hrtime.bigint()
const all: GameResult[] = []
for (const difficulty of DIFFICULTIES) {
  for (let i = 0; i < GAMES; i++) all.push(runGame(BASE_SEED + i, difficulty))
}
const wallSeconds = +(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)

if (has('json')) {
  console.log(JSON.stringify({ config: { GAMES, DIFFICULTIES, MAP, PERSONALITY, BASE_SEED }, wallSeconds, games: all }, null, 2))
} else {
  const median = (ns: number[]) => {
    if (!ns.length) return 0
    const s = [...ns].sort((a, b) => a - b)
    return +s[Math.floor(s.length / 2)].toFixed(2)
  }
  console.log(`\nmap=${MAP}  ai=${PERSONALITY}  games=${GAMES}/difficulty  seeds=${BASE_SEED}..${BASE_SEED + GAMES - 1}`)
  console.log('(player is passive — issues no commands)\n')
  console.log('difficulty  playerWin  aiWin  timeout  medMins  medPeakSpecks  medFlips')
  for (const d of DIFFICULTIES) {
    const rs = all.filter(r => r.difficulty === d)
    const p = rs.filter(r => r.winner === 'player').length
    const a = rs.filter(r => r.winner === 'ai').length
    const to = rs.filter(r => r.winner === 'timeout').length
    console.log(
      d.padEnd(11) +
      `${p}/${rs.length}`.padEnd(11) +
      `${a}`.padEnd(7) +
      `${to}`.padEnd(9) +
      `${median(rs.map(r => r.simMinutes))}`.padEnd(9) +
      `${median(rs.map(r => r.peakSpecks))}`.padEnd(15) +
      `${median(rs.map(r => r.outpostFlips))}`
    )
  }
  console.log(`\n${all.length} games in ${wallSeconds}s`)
}

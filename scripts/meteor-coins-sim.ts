/**
 * Plays Fifty Coins headless and reports how the numbers come out.
 *
 *   npx tsx scripts/meteor-coins-sim.ts [games=6]
 *
 * Two bots: one taps at random moments, one leads the ring the way a good
 * player would. Their gap is the skill in the skill shot. Reports score,
 * hit rate, game length, peak live pucks and physics cost per step — the
 * numbers to tune the table against.
 */
import { FIELD_FRONT_Z, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import { RING_Y, armTip, ringX } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { COIN_BUDGET } from '@/app/meteor-coins/lib/rules'

type Bot = 'random' | 'skilled'

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

/** Rough fall time from the arm tip to the ring (starts at -1 vy, g = 20). */
function fallTime(fromY: number) {
  const dy = fromY - RING_Y
  return (-1 + Math.sqrt(1 + 40 * dy)) / 20
}

function play(bot: Bot, seed: number) {
  const game = new DropGame()
  const rand = rng(seed)
  let nextTapAt = 0.5 + rand() * 1.5
  let pendingTapAt: number | null = null
  let waitingSince = 0
  let peakLive = 0
  let throughTable = 0
  // Count pucks that leave the table anywhere but over the front edge.
  const engineStep = game.engine.step.bind(game.engine)
  game.engine.step = () => {
    const falls = engineStep()
    for (const f of falls) if (f.z < FIELD_FRONT_Z - 0.5) throughTable++
    return falls
  }
  let firstPointAfter = -1
  let scoreAtLastDrop = 0
  const stepMs: number[] = []

  while (game.state.phase !== 'over' && game.engine.time < 600) {
    const t = game.engine.time
    if (pendingTapAt !== null && t >= pendingTapAt) {
      game.tapDrop()
      if (game.state.coinsLeft === 0) scoreAtLastDrop = game.state.score
      pendingTapAt = null
      nextTapAt = t + 0.6 + rand() * 1.2
      waitingSince = nextTapAt
    }
    if (pendingTapAt === null && game.canDrop && t >= nextTapAt) {
      let tap = bot === 'random'
      if (bot === 'skilled') {
        // Lead the ring: tap when the coin would arrive where the ring will be.
        const tip = armTip(game.dropperTime)
        // Aims for a tap 50ms from now; human timing lands it 0–100ms late.
        const arrive = game.dropperTime + (0.05 + fallTime(tip.y)) * game.speed
        // No ring until the first point: nothing to aim for, so just drop.
        tap = !game.ringActive || Math.abs(tip.x - ringX(arrive)) < 0.25 || t - waitingSince > 6
      }
      if (tap) pendingTapAt = t + (bot === 'skilled' ? rand() * 0.1 : 0)
    }
    const t0 = performance.now()
    game.step()
    if (firstPointAfter < 0 && game.state.score > 0)
      firstPointAfter = COIN_BUDGET - game.state.coinsLeft
    stepMs.push(performance.now() - t0)
    if (game.engine.pucks.length && (game.engine.time * 60) % 30 < 1) {
      peakLive = Math.max(peakLive, game.engine.countActive().live)
    }
  }
  stepMs.sort((a, b) => a - b)
  const s = game.state
  game.dispose()
  return {
    score: s.score,
    lost: s.lost,
    hits: s.hits,
    shots: s.shots,
    bestStreak: s.bestStreak,
    throughTable,
    firstPointAfter,
    scoreAtLastDrop,
    seconds: Math.round(game.engine.time),
    peakLive,
    p50: stepMs[stepMs.length >> 1],
    p95: stepMs[Math.floor(stepMs.length * 0.95)],
  }
}

async function main() {
  const games = Number(process.argv[2] ?? 6)
  await initPhysics()
  for (const bot of ['random', 'skilled'] as Bot[]) {
    const runs = Array.from({ length: games }, (_, i) => play(bot, i + 1))
    const avg = (k: keyof (typeof runs)[0]) =>
      (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(1)
    console.log(
      `${bot.padEnd(8)} thickness=${PUCK_THICKNESS} score avg ${avg('score')} [${runs.map(r => r.score).join(' ')}]` +
        ` · first point after ${avg('firstPointAfter')} drops · scored by last drop ${avg('scoreAtLastDrop')}` +
        ` · through table ${avg('throughTable')}` +
        ` · gutters ${avg('lost')} · hits ${avg('hits')}/${avg('shots')} · best streak ${avg('bestStreak')}` +
        ` · ${avg('seconds')}s · peak ${avg('peakLive')} live · step p50 ${avg('p50')}ms p95 ${avg('p95')}ms`
    )
  }
}

main()

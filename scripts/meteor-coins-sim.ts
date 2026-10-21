/**
 * Plays a Meteor Coins stage headless and reports how the numbers come out.
 *
 *   npx tsx scripts/meteor-coins-sim.ts [stage=penny-falls] [games=6]
 *
 * Two bots: one taps at random moments; one plays the way a good player
 * would, leading the ring when a lineup is coming and otherwise timing its
 * drop to land while the pusher slides forward, with 0–100ms of human
 * lateness. Their gap is the skill in the stage. Reports score, how often
 * each bot earns each star, hit rate, stage length, peak live pucks and
 * physics cost per step — the numbers to set a stage's stars against.
 */
import { FIELD_FRONT_Z, PUSHER_AMP_Z, pusherCenterZ } from '@/app/meteor-coins/lib/cabinet'
import { RING_Y, ringX } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { starsFor } from '@/app/meteor-coins/lib/rules'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

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

function play(stage: StageDef, bot: Bot, seed: number) {
  const game = new DropGame(stage)
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
  let drops = 0
  let scoreAtLastDrop = 0
  const stepMs: number[] = []

  while (game.state.phase !== 'over' && game.engine.time < 600) {
    const t = game.engine.time
    if (pendingTapAt !== null && t >= pendingTapAt) {
      if (game.tapDrop()) drops++
      if (game.state.coinsLeft === 0) scoreAtLastDrop = game.state.score
      pendingTapAt = null
      nextTapAt = t + 0.6 + rand() * 1.2
      waitingSince = nextTapAt
    }
    if (pendingTapAt === null && game.canDrop && t >= nextTapAt) {
      let tap = bot === 'random'
      if (bot === 'skilled') {
        // Aims for a tap 50ms from now; human timing lands it 0–100ms late.
        const tip = game.armTip()
        const fall = 0.05 + fallTime(tip.y)
        // Lead the ring: tap when the coin would arrive where the ring will be.
        const ringLineup =
          stage.ring.enabled && Math.abs(tip.x - ringX(game.dropperTime + fall * game.speed)) < 0.25
        // Otherwise land it while the pusher slides forward onto clear shelf.
        const landAt = t + fall
        const z = (dt: number) => pusherCenterZ(landAt + dt, stage.table.pusherPeriodS)
        const pusherForward = z(0.01) > z(0) && z(0) < pusherCenterZ(0) + PUSHER_AMP_Z * 0.5
        tap = ringLineup || (pusherForward && t - waitingSince > 1.5) || t - waitingSince > 6
      }
      if (tap) pendingTapAt = t + (bot === 'skilled' ? rand() * 0.1 : 0)
    }
    const t0 = performance.now()
    game.step()
    if (firstPointAfter < 0 && game.state.score > 0) firstPointAfter = drops
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
  const stage = playableStage(process.argv[2] ?? 'penny-falls')
  if (!stage) throw new Error(`No playable stage "${process.argv[2]}"`)
  const games = Number(process.argv[3] ?? 6)
  await initPhysics()
  console.log(`Stage ${stage.number}: ${stage.name} · stars at ${stage.rules.stars.join(' / ')}`)
  for (const bot of ['random', 'skilled'] as Bot[]) {
    const runs = Array.from({ length: games }, (_, i) => play(stage, bot, i + 1))
    const avg = (k: keyof (typeof runs)[0]) =>
      (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(1)
    const atLeast = (n: number) =>
      `${Math.round((100 * runs.filter(r => starsFor(r.score, stage.rules.stars) >= n).length) / runs.length)}%`
    const sorted = runs.map(r => r.score).sort((a, b) => a - b)
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
    console.log(
      `${bot.padEnd(8)} score avg ${avg('score')} · p15 ${pct(0.15)} p50 ${pct(0.5)} p75 ${pct(0.75)}` +
        ` · ★ ${atLeast(1)} ★★ ${atLeast(2)} ★★★ ${atLeast(3)}` +
        ` · first point after ${avg('firstPointAfter')} drops · scored by last drop ${avg('scoreAtLastDrop')}` +
        ` · through table ${avg('throughTable')}` +
        ` · gutters ${avg('lost')} · hits ${avg('hits')}/${avg('shots')} · best streak ${avg('bestStreak')}` +
        ` · ${avg('seconds')}s · peak ${avg('peakLive')} live · step p50 ${avg('p50')}ms p95 ${avg('p95')}ms`
    )
  }
}

main()

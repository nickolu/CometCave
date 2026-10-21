/**
 * Plays a Meteor Coins stage headless and reports how the numbers come out.
 *
 *   npx tsx scripts/meteor-coins-sim.ts [stage=penny-falls] [games=6]
 *
 * Three bots: one taps at random moments; one only follows the timing rule
 * the on-table cue shows (drop when the coin would land on bare shelf),
 * ignoring the ring; one plays the way a good player would, leading the ring
 * when a lineup is coming, otherwise following the cue and aiming its drop
 * behind the special object nearest the lip. The two that time
 * their drops are 0–100ms late, like people. The gaps are the skill in the
 * stage. Reports score, how often
 * each bot earns each star, hit rate, stage length, peak live pucks and
 * physics cost per step — the numbers to set a stage's stars against.
 */
import { FIELD_FRONT_Z } from '@/app/meteor-coins/lib/cabinet'
import { RING_Y, ringX } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { resultValue, starsFor } from '@/app/meteor-coins/lib/rules'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

type Bot = 'random' | 'cue' | 'skilled'

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

/** The x of the special object still on the table that's closest to the lip, if any. */
function frontmostSpecial(game: DropGame): number | null {
  let best: { x: number; z: number } | null = null
  for (const puck of game.engine.pucks) {
    if (!puck.active || puck.kind !== 'special') continue
    const p = puck.body.translation()
    if (!best || p.z > best.z) best = { x: p.x, z: p.z }
  }
  return best?.x ?? null
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
      if (bot === 'cue') {
        tap = (game.dropLandsClear && t - waitingSince > 1.5) || t - waitingSince > 6
      }
      if (bot === 'skilled') {
        // Aims for a tap 50ms from now; human timing lands it 0–100ms late.
        const tip = game.armTip()
        const fall = 0.05 + fallTime(tip.y)
        // Lead the ring: tap when the coin would arrive where the ring will be.
        const ringLineup =
          stage.ring.enabled && Math.abs(tip.x - ringX(game.dropperTime + fall * game.speed)) < 0.25
        // Otherwise drop when it would land on bare shelf.
        // Without a ring lineup, aim: drop behind the special object
        // nearest the lip, so the push lands on it.
        const target = frontmostSpecial(game)
        const aimed = target === null || Math.abs(tip.x - target) < 0.8
        tap =
          ringLineup ||
          (game.dropLandsClear && aimed && t - waitingSince > 1.5) ||
          t - waitingSince > 6
      }
      if (tap) pendingTapAt = t + (bot === 'random' ? 0 : rand() * 0.1)
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
    value: resultValue(s, stage.rules.goal) ?? -1,
    stars: starsFor(s, stage.rules.goal),
    score: s.score,
    specials: Object.entries(s.collected)
      .filter(([id]) => id !== stage.objects.drop.id)
      .reduce((n, [, c]) => n + c, 0),
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
  const { goal } = stage.rules
  console.log(
    `Stage ${stage.number}: ${stage.name} · ${goal.type} goal, stars at ${goal.stars.join(' / ')}` +
      ` (${stage.measure.caption}; -1 = target missed)`
  )
  for (const bot of ['random', 'cue', 'skilled'] as Bot[]) {
    const runs = Array.from({ length: games }, (_, i) => play(stage, bot, i + 1))
    const avg = (k: keyof (typeof runs)[0]) =>
      (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(1)
    const atLeast = (n: number) =>
      `${Math.round((100 * runs.filter(r => r.stars >= n).length) / runs.length)}%`
    const sorted = runs.map(r => r.value).sort((a, b) => a - b)
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
    console.log(
      `${bot.padEnd(8)} result avg ${avg('value')} · p15 ${pct(0.15)} p50 ${pct(0.5)} p75 ${pct(0.75)}` +
        ` · score ${avg('score')} · specials ${avg('specials')}` +
        ` · ★ ${atLeast(1)} ★★ ${atLeast(2)} ★★★ ${atLeast(3)}` +
        ` · first point after ${avg('firstPointAfter')} drops · scored by last drop ${avg('scoreAtLastDrop')}` +
        ` · through table ${avg('throughTable')}` +
        ` · gutters ${avg('lost')} · hits ${avg('hits')}/${avg('shots')} · best streak ${avg('bestStreak')}` +
        ` · ${avg('seconds')}s · peak ${avg('peakLive')} live · step p50 ${avg('p50')}ms p95 ${avg('p95')}ms`
    )
  }
}

main()

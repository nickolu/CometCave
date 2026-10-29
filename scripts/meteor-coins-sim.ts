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
import { FIELD_FRONT_Z, deckDir, overEdge } from '@/app/meteor-coins/lib/cabinet'
import {
  type Hoop,
  cannonYaw,
  flightPath,
  launchVelocity,
  muzzleAt,
  throughHoop,
} from '@/app/meteor-coins/lib/cannon'
import type { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import type { CraneDelivery } from '@/app/meteor-coins/lib/deliveries/crane'
import { RING_Y, ringX } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { resultValue, starsFor } from '@/app/meteor-coins/lib/rules'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'
import { shelfOpenAt } from '@/app/meteor-coins/lib/timing'

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

/**
 * The x of the special object closest to the edge of the deck the next drop
 * lands on, if any is on it.
 */
function frontmostSpecial(game: DropGame): number | null {
  const deck = game.dropDeck
  const dir = deckDir(deck)
  const [lo, hi] = [Math.min(deck.frontZ, deck.backZ), Math.max(deck.frontZ, deck.backZ)]
  let best: { x: number; ahead: number } | null = null
  for (const puck of game.engine.pucks) {
    if (!puck.active || puck.kind !== 'special') continue
    const p = puck.body.translation()
    if (p.z < lo || p.z > hi) continue
    if (!best || dir * p.z > best.ahead) best = { x: p.x, ahead: dir * p.z }
  }
  return best?.x ?? null
}

/**
 * Where the moon bends coins, whether one dropped 50ms from now would pass
 * through the ring: read off the game's own (exact) preview.
 */
function bentLineup(game: DropGame, stage: StageDef): boolean {
  const path = game.dropPath(0.05)
  const k = path.findIndex(p => p.y < RING_Y)
  if (k < 0) return false
  const t = game.dropperTime + (0.05 + k / 60) * game.speed
  const p = path[k]
  return Math.abs(p.x - ringX(t, stage.ring)) < 0.2
}

/**
 * The middle of the band of charges that thread a hoop from aim `yaw`, or
 * null if none do.
 */
function hoopPower(c: CannonDelivery['config'], yaw: number, hoop: Hoop): number | null {
  const passing: number[] = []
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const path = flightPath(muzzleAt(yaw, c), launchVelocity(yaw, p, c), q => q.z < hoop.z - 0.1)
    for (let i = 1; i < path.length; i++) {
      if (throughHoop(hoop, path[i - 1], path[i], 0.5, 0.09)) {
        passing.push(p)
        break
      }
    }
  }
  return passing.length ? passing[passing.length >> 1] : null
}

/**
 * The cannon bots. Random presses at random moments and holds for a random
 * time. Cue charges fully (a full shot drops off the backboard onto the
 * pusher, like the arm's coin) and lets go when it would land on bare shelf.
 * Skilled does the same, but whenever the swing is about to line up with a
 * hoop it locks there and holds for that hoop's charge, best hoop first.
 * Both are 0–100ms late, like people.
 */
function cannonBot(game: DropGame, bot: Bot, rand: () => number) {
  const cannon = game.delivery as CannonDelivery
  const c = cannon.config
  let nextAt = 0.5 + rand() * 1.5
  let pressAt: number | null = null
  let releaseAt: number | null = null
  let holdingSince = 0
  return () => {
    const t = game.engine.time
    if (pressAt !== null && t >= pressAt) {
      game.press()
      pressAt = null
      holdingSince = t
    }
    if (releaseAt !== null && t >= releaseAt) {
      game.release()
      releaseAt = null
      nextAt = t + 0.6 + rand() * 1.2
      return
    }
    if (cannon.charge !== null && releaseAt === null && pressAt === null) {
      // Holding a full charge: let go when the coin would land on bare shelf.
      const full = cannon.charge >= 1
      const flight = cannon.previewPath().length / 60
      if (
        (full && shelfOpenAt(t + 0.05 + flight, game.engine.pusherPeriodS)) ||
        t - holdingSince > 5
      ) {
        releaseAt = t + rand() * 0.1
      }
      return
    }
    if (cannon.charge !== null || pressAt !== null || !game.canDrop || t < nextAt) return
    if (bot === 'random') {
      pressAt = t
      releaseAt = t + rand() * 1.5
      return
    }
    if (bot === 'skilled') {
      const yaw = cannonYaw(game.dropperTime + 0.05 * game.speed, c)
      const best = [...c.hoops].sort((a, b) => b.bonus - a.bonus)
      for (const hoop of best) {
        const p = hoopPower(c, yaw, hoop)
        if (p === null) continue
        pressAt = t + rand() * 0.1
        releaseAt = pressAt + p * c.chargeS + (rand() - 0.5) * 0.1
        return
      }
    }
    // Charge fully; the release waits for the shelf (above).
    pressAt = t + rand() * 0.1
  }
}

/** The special object nearest the lip on a crane's shelf, if any. */
function frontmostSpecialAt(game: DropGame): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null
  for (const puck of game.engine.pucks) {
    if (!puck.active || puck.kind !== 'special') continue
    const p = puck.body.translation()
    if (p.z > FIELD_FRONT_Z || p.y < -0.2) continue
    if (!best || p.z > best.z) best = { x: p.x, z: p.z }
  }
  return best
}

/**
 * The crane bots, all played by pointing (where the claw should go) and
 * pressing, as the UI sends them. Random points anywhere the claw reaches
 * and drops as soon as it gets there, swinging or not. Cue trusts the
 * marker: it lets the swing settle and sets each coin down in front of
 * the pusher (where the hint says), anywhere across, whenever it's ready.
 * Skilled sets each coin in line with the moonstone nearest the lip, and
 * waits for the pusher to be pulled back, so the coin lands in the gap in
 * front of it and the next push carries it into the pile. Both are
 * 0-100ms late, like people.
 */
function craneBot(game: DropGame, bot: Bot, rand: () => number) {
  const crane = game.delivery as CraneDelivery
  const { x: xs, z: zs } = crane.config
  const period = game.engine.pusherPeriodS
  let nextAt = 0.5 + rand() * 1.5
  let aim: { x: number; z: number } | null = null
  let aimedAt = 0
  let pressAt: number | null = null
  return () => {
    const t = game.engine.time
    if (pressAt !== null && t >= pressAt) {
      // As the UI does: where the pointer is, then the press.
      if (aim) game.input({ type: 'point', ...aim })
      game.press()
      pressAt = null
      aim = null
      nextAt = t + 0.4 + rand() * (bot === 'random' ? 1.4 : 0.6)
      return
    }
    if (pressAt !== null || !game.canDrop || !crane.loaded || t < nextAt) return
    if (!aim) {
      const stone = bot === 'skilled' ? frontmostSpecialAt(game) : null
      aim =
        bot === 'random'
          ? { x: xs[0] + rand() * (xs[1] - xs[0]), z: zs[0] + rand() * (zs[1] - zs[0]) }
          : { x: stone?.x ?? (rand() - 0.5) * 6, z: CRANE_GAP_Z }
      // Only as far as the claw reaches.
      aim.x = Math.min(xs[1], Math.max(xs[0], aim.x))
      aim.z = Math.min(zs[1], Math.max(zs[0], aim.z))
      aimedAt = t
      game.input({ type: 'point', ...aim })
      return
    }
    // Wait for the claw to get there (a few seconds at most).
    const there = Math.hypot(crane.trolley.x - aim.x, crane.trolley.z - aim.z) < 0.15
    const late = t - aimedAt > 6
    if (!there && !late) return
    if (bot === 'random') {
      pressAt = t
      return
    }
    // Then for it to stop swinging, and (skilled) for the pusher to be
    // pulled back when the coin lands, so it lands in front of the pusher
    // rather than on its top.
    if (crane.swing > 0.08 && !late) return
    const land = t + 0.05 + crane.fallPath().length / 60
    const pulledBack = Math.sin((2 * Math.PI * land) / period) < CRANE_PULLED_BACK
    if (bot === 'cue' || pulledBack || late) pressAt = t + rand() * 0.1
  }
}

/**
 * Where the crane bots that aim set coins down: just in front of the
 * pusher's face when it's pulled all the way back (at z -2); and how far
 * back in its stroke (sin of its phase) it must be when the coin lands.
 */
const CRANE_GAP_Z = -1
const CRANE_PULLED_BACK = -0.5

/**
 * Bots for every delivery but the arm, by kind. Each is made once per game
 * and returns a function run before every step; it plays the delivery
 * through game.input as random, cue and skilled players would.
 */
const DELIVERY_BOTS: Record<string, (game: DropGame, bot: Bot, rand: () => number) => () => void> =
  {
    cannon: cannonBot,
    crane: craneBot,
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
    for (const f of falls) if (overEdge(game.engine.layout, f.z) < -0.5) throughTable++
    return falls
  }
  let firstPointAfter = -1
  let drops = 0
  let scoreAtLastDrop = 0
  const stepMs: number[] = []

  const deliveryBot = DELIVERY_BOTS[game.delivery.kind]?.(game, bot, rand) ?? null

  while (game.state.phase !== 'over' && game.engine.time < 600) {
    const t = game.engine.time
    if (deliveryBot) {
      const before = game.state.coinsLeft
      deliveryBot()
      if (game.state.coinsLeft !== before) drops++
      if (game.state.coinsLeft === 0 && before === 1) scoreAtLastDrop = game.state.score
    } else if (pendingTapAt !== null && t >= pendingTapAt) {
      if (game.tapDrop()) drops++
      if (game.state.coinsLeft === 0) scoreAtLastDrop = game.state.score
      pendingTapAt = null
      nextTapAt = t + 0.6 + rand() * 1.2
      waitingSince = nextTapAt
    }
    if (!deliveryBot && pendingTapAt === null && game.canDrop && t >= nextTapAt) {
      let tap = bot === 'random'
      if (bot === 'cue') {
        // A tempo stage rewards every beat, so don't sit one out.
        const wait = stage.rules.tempo ? 0 : 1.5
        tap = (game.cueLit && t - waitingSince > wait) || t - waitingSince > 6
      }
      if (bot === 'skilled') {
        // Aims for a tap 50ms from now; human timing lands it 0–100ms late.
        const tip = game.armTip()
        const fall = 0.05 + fallTime(tip.y)
        // Lead the ring: tap when the coin would arrive where the ring will be.
        const ringLineup =
          stage.ring.enabled &&
          (stage.moon
            ? bentLineup(game, stage)
            : Math.abs(tip.x - ringX(game.dropperTime + fall * game.speed, stage.ring)) < 0.25)
        // Where a stage keeps a tempo, an off-beat lineup costs it: only
        // worth taking while the tempo is low anyway.
        const keepsTempo = stage.rules.tempo !== undefined
        const worthIt = !keepsTempo || game.dropLandsClear || game.state.tempo <= 2
        // Otherwise drop when it would land on bare shelf.
        // Without a ring lineup, aim: drop behind the special object
        // nearest the lip, so the push lands on it.
        const target = frontmostSpecial(game)
        // Under the moon, aim by where the coin will land, not where it starts.
        const landX = stage.moon ? game.dropLanding(0.05).x : tip.x
        const aimed = target === null || Math.abs(landX - target) < 0.8
        // On a stacking stage, wait for a drop square on a post's center,
        // holding out a few seconds for the post that counts most.
        const landing = game.landing(0.05)
        const weights = stage.rules.goal.type === 'stack' ? stage.rules.goal.weights : []
        const best = landing.post !== null && weights[landing.post] === Math.max(...weights)
        const stacking =
          stage.cue === 'dot' && landing.offset < 0.12 && (best || t - waitingSince > 4)
        // On a pachinko board, aim for the cup: drop over it.
        const board = stage.table.board
        const overCup = board?.cups.some(c => Math.abs(tip.x - c.x) < 0.4) ?? false
        tap =
          overCup ||
          (ringLineup && worthIt) ||
          stacking ||
          (stage.cue !== 'dot' &&
            game.dropLandsClear &&
            aimed &&
            (keepsTempo || t - waitingSince > 1.5)) ||
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
  const board = stage.table.board
  const inBoard = board
    ? game.engine.pucks.filter(p => {
        if (!p.active) return false
        const t = p.body.translation()
        return t.y > board.bottomY && Math.abs(t.z - board.z) < board.slot
      }).length
    : 0
  const s = game.state
  game.dispose()
  return {
    value: resultValue(s, stage.rules.goal) ?? -1,
    stars: starsFor(s, stage.rules.goal),
    score: s.score,
    towers: s.towers.join('/'),
    specials: Object.entries(s.collected)
      .filter(([id]) => id !== stage.objects.drop.id)
      .reduce((n, [, c]) => n + c, 0),
    lost: s.lost,
    hits: s.hits,
    shots: s.shots,
    bestStreak: s.bestStreak,
    bestTempo: s.bestTempo,
    inBoard,
    home: stage.lastPush ? (s.collected[stage.lastPush.object] ?? 0) > 0 : false,
    redline: stage.rules.tempo && s.bestTempo >= stage.rules.tempo.max ? 1 : 0,
    timeUp: s.timeUp ? 1 : 0,
    clock: Math.round(game.clockS),
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
  const board = stage.table.board
  console.log(
    `Stage ${stage.number}: ${stage.name} · ${goal.type} goal, stars at ${goal.stars.join(' / ')}` +
      ` (${stage.measure.caption}; -1 = target missed)`
  )
  for (const bot of ['random', 'cue', 'skilled'] as Bot[]) {
    const runs = Array.from({ length: games }, (_, i) => play(stage, bot, i + 1))
    type Run = (typeof runs)[0]
    const avg = (k: { [K in keyof Run]: Run[K] extends number ? K : never }[keyof Run]) =>
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
        (stage.lastPush ? ` · core home ${runs.filter(r => r.home).length}/${runs.length}` : '') +
        (board ? ` · stuck in board ${avg('inBoard')}` : '') +
        ` · gutters ${avg('lost')} · hits ${avg('hits')}/${avg('shots')} · best streak ${avg('bestStreak')}` +
        (goal.type === 'stack' ? ` · towers ${runs.map(r => r.towers).join(' ')}` : '') +
        (stage.rules.tempo
          ? ` · best tempo ${avg('bestTempo')} · redline ${avg('redline')} · time up ${avg('timeUp')} · clock ${avg('clock')}s`
          : '') +
        ` · ${avg('seconds')}s · peak ${avg('peakLive')} live · step p50 ${avg('p50')}ms p95 ${avg('p95')}ms`
    )
  }
}

main()

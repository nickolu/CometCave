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
import { FIELD_FRONT_Z, PHYSICS_STEP_S, deckDir, overEdge } from '@/app/meteor-coins/lib/cabinet'
import {
  type Hoop,
  type Vec,
  cannonYaw,
  dropsThroughHoop,
  flightPath,
  hoopX,
  launchVelocity,
  muzzleAt,
} from '@/app/meteor-coins/lib/cannon'
import type { BeltDelivery } from '@/app/meteor-coins/lib/deliveries/belt'
import type { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import type { CraneDelivery } from '@/app/meteor-coins/lib/deliveries/crane'
import {
  OVER_BOOK_X,
  type Owl,
  type OwlsDelivery,
  landsWell,
  peaAt,
  peaHits,
  peaShot,
} from '@/app/meteor-coins/lib/deliveries/owls'
import type { PlungerDelivery } from '@/app/meteor-coins/lib/deliveries/plunger'
import { type SlideDelivery, rideTime, slideFlight } from '@/app/meteor-coins/lib/deliveries/slide'
import { type SpiderDelivery, spiderCueLit } from '@/app/meteor-coins/lib/deliveries/spider'
import {
  PLATE_RESET_S,
  type SwitchesDelivery,
  type Track,
  type Way,
} from '@/app/meteor-coins/lib/deliveries/switches'
import { RING_Y, ringX } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { resultValue, starsFor } from '@/app/meteor-coins/lib/rules'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'
import { fallTimeToShelf, shelfOpenAt } from '@/app/meteor-coins/lib/timing'

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
 * The shot from aim `yaw` that drops down through a flat hoop centered at
 * `atX` (where a sliding hoop will be): the middle of the band of charges
 * that do it, and how long that coin flies to the rim. Null if none do.
 */
function hoopShot(
  c: CannonDelivery['config'],
  yaw: number,
  hoop: Hoop,
  atX: number
): { power: number; flightS: number } | null {
  const passing: { power: number; flightS: number }[] = []
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const path = flightPath(
      muzzleAt(yaw, c),
      launchVelocity(yaw, p, c),
      q => q.y < 0.7 || q.z < hoop.z - 2
    )
    for (let i = 1; i < path.length; i++) {
      if (dropsThroughHoop(hoop, atX, path[i - 1], path[i], 0.5)) {
        passing.push({ power: p, flightS: i * PHYSICS_STEP_S })
        break
      }
    }
  }
  return passing.length ? passing[passing.length >> 1] : null
}

/** Where along x the flat aim line from `yaw` passes a hoop's depth. */
function lineXAt(c: CannonDelivery['config'], yaw: number, z: number): number {
  const m = muzzleAt(yaw, c)
  return m.x + (m.z - z) * Math.tan(yaw)
}

/**
 * The hoop a shot from `yaw` can drop through, best first among `hoops`,
 * and where its center has to be: a fixed hoop where it stands, a sliding
 * one where the aim line crosses its track.
 */
function hoopPlan(c: CannonDelivery['config'], yaw: number, hoops: readonly Hoop[]) {
  for (const hoop of [...hoops].sort((a, b) => b.bonus - a.bonus)) {
    const atX = hoop.sweep ? lineXAt(c, yaw, hoop.z) : hoop.x
    if (hoop.sweep && Math.abs(atX - hoop.x) > hoop.sweep.ampX * 0.95) continue
    const shot = hoopShot(c, yaw, hoop, atX)
    if (shot) return { hoop, atX, ...shot }
  }
  return null
}

/**
 * The plunger bots, all reading the live dotted path as a player would.
 * Random presses at random moments and lets go after a random time. Cue
 * holds until the landing marker fills (the ball would come down on the
 * strip by the back wall while the pusher is forward) inside the chute's
 * width. Skilled waits for the same, and also for the path to end right
 * behind the special object nearest the lip. Both judge a release 50ms
 * ahead and let go 0–100ms late, like people, and give up waiting after 6s.
 */
function plungerBot(game: DropGame, bot: Bot, rand: () => number) {
  const plunger = game.delivery as PlungerDelivery
  const { chargeS } = plunger.config
  let nextAt = 0.5 + rand() * 1.5
  let releaseAt: number | null = null
  let pressedAt = 0
  return () => {
    const t = game.engine.time
    if (releaseAt !== null) {
      if (t < releaseAt) return
      game.release()
      releaseAt = null
      nextAt = t + 0.4 + rand() * 0.8
      return
    }
    if (plunger.charge !== null) {
      const ahead = 0.05
      const power = Math.min(1, plunger.charge + (ahead * game.speed) / chargeS)
      const land = plunger.landing(power, ahead)
      const waited = t - pressedAt
      // Skilled holds out for the special for a few seconds, then settles for the beat.
      const target = bot === 'skilled' && waited < 4 ? frontmostSpecial(game) : null
      const good =
        plunger.landsClear(power, ahead) &&
        Math.abs(land.x) < game.stage.table.chuteHalfWidth - 0.4 &&
        (target === null || Math.abs(land.x - target) < 0.45)
      if (good || waited > 6) releaseAt = t + rand() * 0.1
      return
    }
    if (!game.canDrop || t < nextAt) return
    game.press()
    pressedAt = t
    if (bot === 'random') releaseAt = t + rand() * 1.6
  }
}

/**
 * The cannon bots, played in its two steps: lock the direction, then hold
 * for distance. Random locks at a random moment, waits a random while and
 * holds a random time. Cue locks wherever it points, charges fully (a full
 * shot drops against the back wall onto the pusher, like the arm's coin)
 * and lets go when it would land on bare shelf. Skilled waits for the
 * swing to line up with a hoop — the +10 first, any after a moment, a
 * full shot like cue's after a whole swing — locks there and holds for
 * that hoop's charge; for the sliding +10 it starts the charge so the
 * coin arrives as the hoop does. Both time everything 0–100ms late, like
 * people: aiming for 50ms from now, so each press and release is ±50ms.
 */
function cannonBot(game: DropGame, bot: Bot, rand: () => number) {
  const cannon = game.delivery as CannonDelivery
  const c = cannon.config
  let nextAt = 0.5 + rand() * 1.5
  let pending: { at: number; act: 'press' | 'release' } | null = null
  // Random's wait before charging and how long it holds.
  let chargeAt = 0
  let holdS = 0
  // Skilled's target, once it has one.
  let plan: ReturnType<typeof hoopPlan> = null
  let chargingSince = 0
  // When a planned hold lets go, queued once the charge has started.
  let nextRelease: number | null = null
  const late = () => rand() * 0.1
  return () => {
    const t = game.engine.time
    if (pending && t >= pending.at) {
      const { act } = pending
      pending = null
      if (act === 'press') {
        const wasLocked = cannon.isLocked
        game.press()
        if (cannon.charge !== null) chargingSince = t
        // A person sees where it locked: re-aim the distance from there.
        if (!wasLocked && cannon.isLocked && plan) {
          const hoop = plan.hoop
          const atX = hoop.sweep ? lineXAt(c, cannon.yaw, hoop.z) : hoop.x
          const shot = hoopShot(c, cannon.yaw, hoop, atX)
          if (shot) plan = { hoop, atX, ...shot }
        }
      } else {
        game.release()
        plan = null
        nextAt = t + 0.6 + rand() * 1.2
      }
      return
    }
    if (pending) return
    const charge = cannon.charge
    if (charge !== null && nextRelease !== null) {
      pending = { at: nextRelease, act: 'release' }
      nextRelease = null
      return
    }
    if (charge !== null) {
      // Holding for a full shot: let go when the coin would land on bare shelf.
      const flight = cannon.previewPath().length * PHYSICS_STEP_S
      if (
        (charge >= 1 && shelfOpenAt(t + 0.05 + flight, game.engine.pusherPeriodS)) ||
        t - chargingSince > 5
      ) {
        pending = { at: t + late(), act: 'release' }
      }
      return
    }
    if (cannon.isLocked) {
      // Second step: start the charge.
      if (bot === 'random') {
        if (t < chargeAt) return
        // The release is queued once the press lands.
        pending = { at: t, act: 'press' }
        nextRelease = t + holdS
        return
      }
      if (bot === 'skilled' && plan) {
        const holdFor = plan.power * c.chargeS
        if (plan.hoop.sweep) {
          // Lead the slide: go when the hoop would reach the line as the coin does.
          const arrive = game.dropperTime + (0.05 + holdFor + plan.flightS) * game.speed
          if (Math.abs(hoopX(plan.hoop, arrive) - plan.atX) > 0.05) return
        }
        const at = t + late()
        pending = { at, act: 'press' }
        nextRelease = at + holdFor + (rand() - 0.5) * 0.1
        return
      }
      pending = { at: t + late(), act: 'press' }
      return
    }
    if (!game.canDrop || t < nextAt) return
    // First step: lock the direction.
    if (bot === 'random') {
      pending = { at: t, act: 'press' }
      chargeAt = t + rand() * 1.5
      holdS = rand() * 1.5
      return
    }
    if (bot === 'skilled') {
      const waited = t - nextAt
      const hoops = waited < 1.5 ? c.hoops.filter(h => h.bonus >= 10) : waited < 3 ? c.hoops : []
      plan = hoopPlan(c, cannonYaw(game.dropperTime + 0.05 * game.speed, c), hoops)
      if (!plan && waited < 3) return
    }
    pending = { at: t + late(), act: 'press' }
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
 * How far ahead the belt's skilled bot leads the mouth: roughly how long a
 * drop takes to tip the lip. Measured: anything from 3s to 9s did about as well.
 */
const BELT_LEAD_S = 6

/**
 * The belt bots (Bramble's Midnight Snack). Random presses at random
 * moments, whatever is over the shelf. Cue presses when the marked
 * chocolate would land on bare shelf, wherever it is. Skilled also waits
 * until the marked chocolate is over where the mouth will be once that
 * drop has pushed through to the lip, giving up on aim after a few seconds.
 * Both are 0–100ms late, like people.
 */
function beltBot(game: DropGame, bot: Bot, rand: () => number) {
  const belt = game.delivery as BeltDelivery
  const c = belt.config
  let nextAt = 0.5 + rand() * 1.5
  let pressAt: number | null = null
  let waitingSince = 0
  return () => {
    const t = game.engine.time
    if (pressAt !== null && t >= pressAt) {
      game.press()
      pressAt = null
      nextAt = t + 0.6 + rand() * (bot === 'random' ? 1.2 : 0.4)
      waitingSince = nextAt
      return
    }
    if (pressAt !== null || !game.canDrop || t < nextAt) return
    const next = belt.next()
    if (!next) return
    if (bot === 'random') {
      pressAt = t
      return
    }
    // Judged for a press 50ms from now.
    const ahead = 0.05
    const clear = shelfOpenAt(t + ahead + fallTimeToShelf(c.y), game.engine.pusherPeriodS)
    if (!clear) return
    if (bot === 'skilled') {
      const target = game.engine.chuteX(t + BELT_LEAD_S)
      const x = next.x + c.speed * game.speed * ahead
      const aim = Math.max(-c.dropHalfWidth + 0.3, Math.min(c.dropHalfWidth - 0.3, target))
      if (Math.abs(x - aim) > 0.5 && t - waitingSince < 5) return
    }
    pressAt = t + rand() * 0.1
  }
}

/**
 * The Cairn's spider bots. Random walks to a random spot and lets go at a
 * random moment. Cue walks to a post picked at random and lets go when the
 * landing dot fills (square on the post and low enough to land soft).
 * Skilled waits over the middle post for the dot, which means the bob's low
 * point as the post crosses, and falls back on a side post after a few
 * seconds. Both are 0–100ms late, like people.
 */
function spiderBot(game: DropGame, bot: Bot, rand: () => number) {
  const MIDDLE_LEAD = 3
  const spider = game.delivery as SpiderDelivery
  const posts = game.towerPosts
  const weights = game.stage.rules.goal.type === 'stack' ? game.stage.rules.goal.weights : []
  const middle = weights.indexOf(Math.max(...weights))
  let goalX = 0
  let nextAt = 0.5 + rand() * 1.5
  let releaseAt: number | null = null
  let since = 0
  let fallback = false
  const aim = (t: number) => {
    since = t
    fallback = false
    if (bot === 'random') goalX = (rand() * 2 - 1) * spider.config.halfWidth
    else if (bot === 'cue') goalX = posts[Math.floor(rand() * posts.length)].x
    else {
      // Spread the coins, shortest tower first, but let the middle run a
      // few coins taller: it counts twice, and a tower past a dozen coins
      // tends to come down.
      const towers = game.state.towers
      const need = (i: number) => towers[i] - (i === middle ? MIDDLE_LEAD : 0)
      const next = posts.map((_, i) => i).sort((a, b) => need(a) - need(b))[0]
      goalX = posts[next].x
    }
    game.input({ type: 'point', x: goalX, z: spider.config.z })
  }
  aim(0)
  return () => {
    const t = game.engine.time
    if (releaseAt !== null) {
      if (t < releaseAt) return
      game.press()
      game.release()
      releaseAt = null
      nextAt = t + 0.2 + rand() * 0.6
      aim(nextAt)
      return
    }
    if (!spider.holding || t < nextAt || Math.abs(spider.x - goalX) > 0.05) return
    if (bot === 'random') {
      releaseAt = t + rand() * 2
      return
    }
    if (bot === 'skilled' && !fallback && t - since > 6) {
      // The middle isn't lining up: take whichever side post is nearer.
      fallback = true
      const sides = posts.filter((_, i) => i !== middle)
      goalX = sides[Math.floor(rand() * sides.length)].x
      game.input({ type: 'point', x: goalX, z: spider.config.z })
      return
    }
    const tip = spider.tipAt(0.05)
    const landing = game.landing(0.05, tip)
    const square = bot === 'skilled' ? landing.offset < 0.15 : true
    if ((spiderCueLit(landing, tip) && square) || t - since > 12) releaseAt = t + rand() * 0.1
  }
}

/**
 * The waterslide bots. The slide only picks a direction: a duck flies out
 * along it, away from the slide's top. Random sends one at random moments.
 * Cue sends one when the slide points at the drain. Skilled first looks
 * for a duck in the water between the slide and the drain, Mama Ducks
 * first, and points at it so the hit knocks it in; and it waits for the
 * duck to land while the pusher is on its way forward, so the push helps.
 * Both are 0–100ms late, like people.
 */
function slideBot(game: DropGame, bot: Bot, rand: () => number) {
  const slide = game.delivery as SlideDelivery
  const c = slide.config
  const drain = game.stage.table.drain
  const ride = rideTime(c)
  const bearing = (p: { x: number; z: number }) => Math.atan2(p.x - c.pivot.x, p.z - c.pivot.z)
  const range = (p: { x: number; z: number }) => Math.hypot(p.x - c.pivot.x, p.z - c.pivot.z)
  let nextAt = 0.5 + rand() * 1.5
  let pressAt: number | null = null
  let waitingSince = 0
  return () => {
    const t = game.engine.time
    if (pressAt !== null && t >= pressAt) {
      if (game.press()) nextAt = t + 0.6 + rand() * 1.2
      pressAt = null
      waitingSince = nextAt
      return
    }
    if (pressAt !== null || !slide.ready || t < nextAt) return
    if (bot === 'random' || !drain) {
      pressAt = t
      return
    }
    // Judged for a press 50ms from now.
    const yaw = slide.yawAfter(0.05)
    let aimAt = bearing(drain)
    let onBeat = true
    if (bot === 'skilled') {
      let best: { at: number; value: number; range: number } | null = null
      for (const puck of game.engine.pucks) {
        if (!puck.active || puck.kind === 'player') continue
        const p = puck.body.translation()
        if (p.y > 0.6) continue
        const off = Math.abs(bearing(p) - bearing(drain))
        const short = range(drain) - range(p)
        if (off > 0.15 || short < 0.3 || short > 1.2) continue
        const value = puck.spec.points
        if (!best || value > best.value || (value === best.value && range(p) > best.range))
          best = { at: bearing(p), value, range: range(p) }
      }
      if (best) aimAt = best.at
      const flight = slideFlight(yaw, c).length / 60
      onBeat = shelfOpenAt(t + 0.05 + ride + flight, game.engine.pusherPeriodS)
    }
    const aimed = Math.abs(yaw - aimAt) < 0.05
    if ((aimed && onBeat) || t - waitingSince > 6) pressAt = t + rand() * 0.1
  }
}

/**
 * An aim that hits `owl` with a pea fired `delay` seconds from now, if
 * there is one: leads it by the pea's flight, then checks the shot step by
 * step against where the owl will be, nudging the aim nearer or further
 * until one connects.
 */
function leadAim(owls: OwlsDelivery, owl: Owl, delay: number): { aim: Vec; reach: number } | null {
  const c = owls.config
  let reach = 1
  for (let i = 0; i < 4; i++) {
    const p = owls.owlAhead(owl, delay + reach)
    reach = peaShot(c.shooter, { ...p, y: c.aimY }).reach
  }
  const ahead = owls.owlAhead(owl, delay + reach)
  for (const dz of [0, -0.3, 0.3, -0.6, 0.6, -0.9, 0.9]) {
    const aim = { x: ahead.x, y: c.aimY, z: ahead.z + dz }
    const shot = peaShot(c.shooter, aim)
    let last = c.shooter
    for (let t = PHYSICS_STEP_S; t < shot.reach + 0.45; t += PHYSICS_STEP_S) {
      const at = peaAt(c.shooter, shot.velocity, t)
      const o = owls.owlAhead(owl, delay + t)
      if (Math.abs(o.x) <= OVER_BOOK_X && peaHits(last, at, o)) return { aim, reach: t }
      last = at
    }
  }
  return null
}

/**
 * The pea-shooter bots. Random fires at random spots over the pages at
 * random moments. Cue leads the nearest owl carrying a word as soon as it
 * can: good aim, no choosing. Skilled leads too, but picks its owl: one
 * whose word would land on bare page in front of a pulled-back pusher
 * (landsWell, what the aim mark shows), nearest first, holding out up to
 * 10s for one. Both aim ±0.25 off and fire 0–100ms late, like people.
 */
function owlsBot(game: DropGame, bot: Bot, rand: () => number) {
  const owls = game.delivery as OwlsDelivery
  const c = owls.config
  let nextAt = 0.5 + rand()
  let waitingSince = 0
  let pending: { at: number; aim: Vec } | null = null
  const fire = (aim: Vec, t: number) => {
    pending = { at: t + (bot === 'random' ? 0 : rand() * 0.1), aim }
  }
  return () => {
    const t = game.engine.time
    if (pending && t >= pending.at) {
      const { aim } = pending
      game.input({ type: 'point', x: aim.x, z: aim.z })
      if (game.press()) waitingSince = t
      game.release()
      pending = null
      nextAt = t + (bot === 'random' ? 0.3 + rand() * 1.2 : 0.4)
      return
    }
    if (pending || !owls.ready || t < nextAt) return
    if (bot === 'random') {
      const page = c.pages[Math.floor(rand() * c.pages.length)]
      const z = page[0] + rand() * (page[1] - page[0])
      fire({ x: (rand() * 2 - 1) * OVER_BOOK_X, y: c.aimY, z }, t)
      return
    }
    let shots = owls.owls
      .filter(o => o.backAt === null && o.carrying)
      .flatMap(o => {
        const lead = leadAim(owls, o, 0.05)
        return lead ? [{ o, ...lead }] : []
      })
    if (bot === 'skilled') {
      const { layout, pusherPeriodS } = game.engine
      const good = shots.filter(({ o, reach }) => {
        const land = owls.landing(o, 0.05 + reach)
        return landsWell(layout, land.z, t + land.afterS, pusherPeriodS)
      })
      if (good.length || t - waitingSince > 10) shots = good.length ? good : shots
      else return
    }
    if (!shots.length) return
    const { aim } = shots.reduce((a, b) => (b.reach < a.reach ? b : a))
    const jitter = () => (rand() - 0.5) * 0.5
    fire({ x: aim.x + jitter(), y: aim.y, z: aim.z + jitter() }, t)
  }
}

/**
 * The track-switch bots (The Cascade Engine). All three send a coin every
 * 0.6–1.8s, like the arm bots tap; they differ only in the route. Random
 * flips each junction at random first. Cue routes once, into the top-deck
 * lane over the middle step's gold, and never touches the switches again:
 * a player who found the gold and stopped watching it move. Skilled
 * re-routes every coin: to the middle step's gold, unless its spill would
 * land on a bottom-step red that's half full; while the middle plates are
 * moving, or to dodge that red, it goes for the bottom step's gold the most
 * direct way. (Weighing lanes by how loaded the top deck's lip already was
 * scored worse than this.) All flips and sends go through game.input, as taps.
 */
function switchesBot(game: DropGame, bot: Bot, rand: () => number) {
  const d = game.delivery as SwitchesDelivery
  const c = d.config
  let nextAt = 0.5 + rand() * 1.5
  let routed = false
  const tap = (x: number, z: number) => {
    game.input({ type: 'point', x, z })
    game.input({ type: 'press' })
    game.input({ type: 'release' })
  }
  /** Sets the junctions to come out at `exit`, a tap per junction that needs flipping. */
  const routeTo = (exit: number) => {
    for (let k = 0; k < c.junctions.length; k++) {
      const route = d.route()
      if (route.exit === exit) return
      // Flip the first junction on the way that points the wrong way.
      for (const j of route.junctions) {
        const flipped = [...d.ways]
        flipped[j] = flipped[j] === 'left' ? 'right' : 'left'
        if (reaches(flipped, j, exit)) {
          tap(c.junctions[j].at.x, c.junctions[j].at.z)
          break
        }
      }
    }
  }
  const reaches = (ways: Way[], j: number, exit: number) => {
    // Whether, with these ways, the route from junction j leads to exit (any setting beyond).
    const visit = (track: Track): boolean =>
      'exit' in track.to ? track.to.exit === exit : visitJ(track.to.junction)
    const visitJ = (k: number): boolean =>
      k === j
        ? visit(c.junctions[k][ways[k]])
        : visit(c.junctions[k].left) || visit(c.junctions[k].right)
    return visitJ(j)
  }
  const plateIndex = (deck: number) => c.plates.decks.findIndex(p => p.deck === deck)
  /** Whether a plate deck can trip now: not moving lanes, and its lip not barred. */
  const live = (i: number) => {
    const p = d.plates[i]
    const moving = p.tripped !== null && game.engine.time - p.tripped.at < PLATE_RESET_S
    return !moving
  }
  const topExit = (lane: number) => c.exits.findIndex(e => e.deck === 2 && e.lane === lane)
  const directExit = (lane: number) => c.exits.findIndex(e => e.deck === 1 && e.lane === lane)
  /** How near a plate deck's red is to tripping, 0 to 1. */
  const redNear = (i: number) => d.plates[i].red / c.plates.redCoins
  /**
   * Skilled: the middle step's gold while it's live, unless its spill would
   * land on a bottom-step red that's nearly full; then the bottom step's
   * gold, by the most direct way, keeping clear of the middle step's red.
   */
  const skilledExit = () => {
    const middle = plateIndex(1)
    const bottom = plateIndex(0)
    const mid = d.plateLanes(middle)
    const low = d.plateLanes(bottom)
    const risky = mid.gold === low.red && redNear(bottom) > 0.5
    if (live(middle) && !risky) return topExit(mid.gold)
    const direct = directExit(low.gold)
    if (direct >= 0) return direct
    if (low.gold !== mid.red) return topExit(low.gold)
    // The bottom gold is under the middle red: go round by the neutral lane.
    return topExit(3 - mid.gold - mid.red)
  }
  return () => {
    const t = game.engine.time
    if (t < nextAt || !d.ready) return
    if (bot === 'random') {
      for (const j of c.junctions) if (rand() < 0.5) tap(j.at.x, j.at.z)
    } else if (bot === 'cue') {
      if (!routed) routeTo(topExit(d.plateLanes(plateIndex(1)).gold))
      routed = true
    } else {
      routeTo(skilledExit())
    }
    // Send: a tap well away from every junction.
    tap(0, 0)
    nextAt = t + 0.6 + rand() * 1.2
  }
}

/**
 * Bots for every delivery but the arm, by kind. Each is made once per game
 * and returns a function run before every step; it plays the delivery
 * through game.input as random, cue and skilled players would.
 */
const DELIVERY_BOTS: Record<string, (game: DropGame, bot: Bot, rand: () => number) => () => void> =
  {
    cannon: cannonBot,
    switches: switchesBot,
    owls: owlsBot,
    plunger: plungerBot,
    crane: craneBot,
    belt: beltBot,
    spider: spiderBot,
    slide: slideBot,
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
  const plates = { gold: 0, red: 0 }

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
    for (const e of game.step()) if (e.type === 'plate') plates[e.plate]++
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
    gold: plates.gold,
    red: plates.red,
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
        (stage.delivery?.kind === 'switches' ? ` · gold ${avg('gold')} red ${avg('red')}` : '') +
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

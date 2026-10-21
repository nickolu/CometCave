import type { FallResult } from '@/app/meteor-coins/lib/cabinet'

/**
 * The scoring rules every stage shares, configured per stage.
 *
 * A stage gives you a coin budget — or unlimited coins and a clock. Anything
 * pushed into the chute scores its points (a coin is 1), and some objects
 * hand coins back to the budget; gutters score nothing. Dropping a
 * coin through the moving ring (where a stage has one) starts or extends a
 * streak, and each hit pours a bonus out of the arm sized by the stage's
 * bonus table. A miss resets the streak. Bonuses are earned, never random —
 * a random payout would decide the score, and it's the slot-machine
 * mechanic this game keeps out.
 *
 * Bonus coins pour onto the table automatically; they never go back into
 * the budget, so a perfect run still ends.
 *
 * Pure state transitions, no physics — the game loop feeds events in.
 */

/** After the last coin, the stage ends once nothing has fallen for this long… */
export const SETTLE_QUIET_S = 5
/** …or after this long regardless, so a slowly creeping pile can't stall it. */
export const SETTLE_MAX_S = 30

export type Phase = 'ready' | 'playing' | 'settling' | 'over'

/** What it takes for one, two and three stars, in the goal's own measure. */
export type StarThresholds = readonly [number, number, number]

/**
 * What a stage asks for, and how its stars are counted.
 *
 * - score: points into the chute.
 * - collect: how many of one object reach the chute. A first threshold of 0
 *   means finishing the stage earns a star. Collecting them all ends it.
 * - target: get `count` points (or `count` of one object) into the chute
 *   before the budget runs out — that ends the stage — and the stars count
 *   the coins still unspent.
 */
export type Goal =
  | { type: 'score'; stars: StarThresholds }
  | { type: 'collect'; object: string; total: number; stars: StarThresholds }
  | { type: 'target'; object?: string; count: number; stars: StarThresholds }

export type RuleConfig = {
  /** Coins the player can drop, or null for unlimited. */
  coins: number | null
  /** Required when coins is unlimited: drops stop after this many seconds. */
  timeLimitS?: number
  /** Bonus coins poured for the nth consecutive ring hit (n ≥ 1). */
  bonusForStreak: (streak: number) => number
  goal: Goal
}

export type GameState = {
  phase: Phase
  /** Null when the stage gives unlimited coins. */
  coinsLeft: number | null
  /** Set once an unlimited stage's clock runs out; no more drops. */
  timeUp: boolean
  score: number
  /** Objects into the chute, by object id. */
  collected: Record<string, number>
  /** Coins still unspent when a target goal was met; null until then. */
  spareAtGoal: number | null
  lost: number
  streak: number
  bestStreak: number
  hits: number
  shots: number
  /** Bonus coins still to pour out of the arm. */
  showerLeft: number
  settleStartedAt: number | null
  lastFallAt: number | null
}

/** The bonus table from Fifty Coins: +5 per consecutive hit, up to +25. */
export function classicBonus(streak: number): number {
  return Math.min(5 * streak, 25)
}

export function validateRules(rules: RuleConfig): void {
  if (rules.coins === null && !(rules.timeLimitS && rules.timeLimitS > 0)) {
    throw new Error('A stage with unlimited coins needs a time limit to end on')
  }
  const { goal } = rules
  const [one, two, three] = goal.stars
  const lowest = goal.type === 'score' ? 1 : 0
  if (!(one >= lowest && one < two && two < three)) throw new Error('Star thresholds must rise')
  if (goal.type === 'collect' && three > goal.total) {
    throw new Error('Three stars asks for more than the stage holds')
  }
  if (goal.type === 'target' && (rules.coins === null || three > rules.coins)) {
    throw new Error('A target goal counts spare coins, so it needs a budget that covers its stars')
  }
}

export function initialState(rules: RuleConfig): GameState {
  validateRules(rules)
  return {
    phase: 'ready',
    coinsLeft: rules.coins,
    timeUp: false,
    score: 0,
    collected: {},
    spareAtGoal: null,
    lost: 0,
    streak: 0,
    bestStreak: 0,
    hits: 0,
    shots: 0,
    showerLeft: 0,
    settleStartedAt: null,
    lastFallAt: null,
  }
}

function outOfCoins(s: GameState): boolean {
  return s.coinsLeft === null ? s.timeUp : s.coinsLeft <= 0
}

export function canDrop(s: GameState): boolean {
  return (s.phase === 'ready' || s.phase === 'playing') && !outOfCoins(s)
}

export function drop(s: GameState): GameState {
  if (!canDrop(s)) return s
  return { ...s, phase: 'playing', coinsLeft: s.coinsLeft === null ? null : s.coinsLeft - 1 }
}

/** A player's coin has passed the ring's height: through it, or not. */
export function resolveShot(s: GameState, hit: boolean, rules: RuleConfig): GameState {
  if (!hit) return { ...s, shots: s.shots + 1, streak: 0 }
  const streak = s.streak + 1
  return {
    ...s,
    shots: s.shots + 1,
    hits: s.hits + 1,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    showerLeft: s.showerLeft + rules.bonusForStreak(streak),
  }
}

export function pourBonus(s: GameState): GameState {
  return s.showerLeft > 0 ? { ...s, showerLeft: s.showerLeft - 1 } : s
}

/** What the rules need to know about a fallen object. */
export type Fallen = { id: string; points: number; refund: number }

const COIN_FALL: Fallen = { id: 'coin', points: 1, refund: 0 }

export function fall(
  s: GameState,
  result: FallResult,
  t: number,
  object: Fallen = COIN_FALL,
  rules?: RuleConfig
): GameState {
  if (s.phase === 'over') return s
  if (result === 'gutter') return { ...s, lost: s.lost + 1, lastFallAt: t }
  let next: GameState = {
    ...s,
    score: s.score + object.points,
    collected: { ...s.collected, [object.id]: (s.collected[object.id] ?? 0) + 1 },
    lastFallAt: t,
  }
  if (object.refund > 0 && next.coinsLeft !== null) {
    next = { ...next, coinsLeft: next.coinsLeft + object.refund }
    // Coins came back after the last one was spent: play on.
    if (next.phase === 'settling') next = { ...next, phase: 'playing', settleStartedAt: null }
  }
  if (rules && goalMet(next, rules.goal)) {
    return { ...next, phase: 'over', spareAtGoal: next.coinsLeft }
  }
  return next
}

/** Progress toward the goal in its own measure (target goals count toward `count`). */
export function goalCount(s: GameState, goal: Goal): number {
  if (goal.type === 'score') return s.score
  if (goal.type === 'collect') return s.collected[goal.object] ?? 0
  return goal.object ? (s.collected[goal.object] ?? 0) : s.score
}

/** True once the stage's goal is complete, which ends it. Score goals never complete. */
export function goalMet(s: GameState, goal: Goal): boolean {
  if (goal.type === 'collect') return goalCount(s, goal) >= goal.total
  if (goal.type === 'target') return goalCount(s, goal) >= goal.count
  return false
}

/**
 * Moves the game toward its end. `t` is the stage clock. `inFlight` counts
 * player coins that haven't reached the ring yet — the game can't start
 * settling with a shot unresolved.
 */
export function tick(s: GameState, t: number, inFlight: number, rules: RuleConfig): GameState {
  let next = s
  if (
    next.coinsLeft === null &&
    !next.timeUp &&
    rules.timeLimitS !== undefined &&
    t >= rules.timeLimitS
  ) {
    next = { ...next, timeUp: true }
  }
  if (next.phase === 'ready' && next.timeUp) next = { ...next, phase: 'playing' }
  if (next.phase === 'playing' && outOfCoins(next) && next.showerLeft === 0 && inFlight === 0) {
    return { ...next, phase: 'settling', settleStartedAt: t }
  }
  if (next.phase === 'settling' && next.settleStartedAt !== null) {
    const quietSince = Math.max(next.settleStartedAt, next.lastFallAt ?? 0)
    if (t - quietSince >= SETTLE_QUIET_S || t - next.settleStartedAt >= SETTLE_MAX_S) {
      return { ...next, phase: 'over' }
    }
  }
  return next
}

/** Stars for a value in the goal's measure, against its thresholds. */
export function starsAt(value: number, thresholds: StarThresholds): 0 | 1 | 2 | 3 {
  if (value >= thresholds[2]) return 3
  if (value >= thresholds[1]) return 2
  if (value >= thresholds[0]) return 1
  return 0
}

/**
 * Stars earned so far: 0 to 3. A star for merely finishing (a 0 threshold)
 * only counts once the stage is over; a target goal earns nothing until met.
 */
export function starsFor(s: GameState, goal: Goal): 0 | 1 | 2 | 3 {
  if (goal.type === 'target') {
    return s.spareAtGoal === null ? 0 : starsAt(s.spareAtGoal, goal.stars)
  }
  const stars = starsAt(goalCount(s, goal), goal.stars)
  if (stars === 1 && goal.stars[0] === 0 && s.phase !== 'over') return 0
  return stars
}

/**
 * The next star still to earn, in the goal's own measure, or null with all
 * three. For a target goal `at` is the spare coins it needs.
 */
export function nextStar(s: GameState, goal: Goal): { stars: 1 | 2 | 3; at: number } | null {
  const earned = starsFor(s, goal)
  if (earned === 3) return null
  return { stars: (earned + 1) as 1 | 2 | 3, at: goal.stars[earned] }
}

/**
 * The run's headline number, kept as the stage's best: points, objects
 * collected, or coins to spare. Null for a target goal that wasn't met —
 * there's nothing to compare.
 */
export function resultValue(s: GameState, goal: Goal): number | null {
  if (goal.type === 'target') return s.spareAtGoal
  return goalCount(s, goal)
}

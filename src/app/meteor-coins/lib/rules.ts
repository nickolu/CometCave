import type { FallResult } from '@/app/meteor-coins/lib/cabinet'

/**
 * The scoring rules every stage shares, configured per stage.
 *
 * A stage gives you a coin budget — or unlimited coins and a clock. Each
 * coin pushed into the chute is a point; gutters score nothing. Dropping a
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

/** Score needed for one, two and three stars. */
export type StarThresholds = readonly [number, number, number]

export type RuleConfig = {
  /** Coins the player can drop, or null for unlimited. */
  coins: number | null
  /** Required when coins is unlimited: drops stop after this many seconds. */
  timeLimitS?: number
  /** Bonus coins poured for the nth consecutive ring hit (n ≥ 1). */
  bonusForStreak: (streak: number) => number
  stars: StarThresholds
}

export type GameState = {
  phase: Phase
  /** Null when the stage gives unlimited coins. */
  coinsLeft: number | null
  /** Set once an unlimited stage's clock runs out; no more drops. */
  timeUp: boolean
  score: number
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
  const [one, two, three] = rules.stars
  if (!(one > 0 && one < two && two < three)) throw new Error('Star thresholds must rise')
}

export function initialState(rules: RuleConfig): GameState {
  validateRules(rules)
  return {
    phase: 'ready',
    coinsLeft: rules.coins,
    timeUp: false,
    score: 0,
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

export function fall(s: GameState, result: FallResult, t: number): GameState {
  if (s.phase === 'over') return s
  return result === 'chute'
    ? { ...s, score: s.score + 1, lastFallAt: t }
    : { ...s, lost: s.lost + 1, lastFallAt: t }
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

/** Stars earned for a score: 0 to 3. */
export function starsFor(score: number, thresholds: StarThresholds): 0 | 1 | 2 | 3 {
  if (score >= thresholds[2]) return 3
  if (score >= thresholds[1]) return 2
  if (score >= thresholds[0]) return 1
  return 0
}

/** The next star still to earn, or null with all three. */
export function nextStar(
  score: number,
  thresholds: StarThresholds
): { stars: 1 | 2 | 3; at: number } | null {
  const earned = starsFor(score, thresholds)
  if (earned === 3) return null
  return { stars: (earned + 1) as 1 | 2 | 3, at: thresholds[earned] }
}

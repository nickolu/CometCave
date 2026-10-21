import type { FallResult } from '@/app/meteor-coins/lib/cabinet'

/**
 * Rules for the first game: Fifty Coins.
 *
 * You get 50 coins and a fixed starting pile, the same for everyone. Each
 * coin pushed into the chute is a point; gutters score nothing. After the
 * first point the moving ring appears, and dropping a coin through it
 * starts or extends a streak, and each hit
 * pours a bonus out of the arm: +5, +10, +15, +20, then +25 per hit. A miss
 * resets the streak. The bonus is earned, never random — with a 50-coin
 * budget a random payout would decide the score, and it's the slot-machine
 * mechanic this game keeps out.
 *
 * Bonus coins pour onto the table automatically; they never go back into
 * the 50, so a perfect run still ends.
 *
 * Pure state transitions, no physics — the game loop feeds events in.
 */

export const COIN_BUDGET = 50
/** After the last coin, the game ends once nothing has fallen for this long… */
export const SETTLE_QUIET_S = 5
/** …or after this long regardless, so a slowly creeping pile can't stall it. */
export const SETTLE_MAX_S = 30

export type Phase = 'ready' | 'playing' | 'settling' | 'over'

export type GameState = {
  phase: Phase
  coinsLeft: number
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

export function bonusForStreak(streak: number): number {
  return Math.min(5 * streak, 25)
}

export function initialState(): GameState {
  return {
    phase: 'ready',
    coinsLeft: COIN_BUDGET,
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

export function canDrop(s: GameState): boolean {
  return (s.phase === 'ready' || s.phase === 'playing') && s.coinsLeft > 0
}

export function drop(s: GameState): GameState {
  if (!canDrop(s)) return s
  return { ...s, phase: 'playing', coinsLeft: s.coinsLeft - 1 }
}

/** A player's coin has passed the ring's height: through it, or not. */
export function resolveShot(s: GameState, hit: boolean): GameState {
  if (!hit) return { ...s, shots: s.shots + 1, streak: 0 }
  const streak = s.streak + 1
  return {
    ...s,
    shots: s.shots + 1,
    hits: s.hits + 1,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    showerLeft: s.showerLeft + bonusForStreak(streak),
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
 * Moves the game toward its end. `inFlight` counts player coins that haven't
 * reached the ring yet — the game can't start settling with a shot unresolved.
 */
export function tick(s: GameState, t: number, inFlight: number): GameState {
  if (s.phase === 'playing' && s.coinsLeft === 0 && s.showerLeft === 0 && inFlight === 0) {
    return { ...s, phase: 'settling', settleStartedAt: t }
  }
  if (s.phase === 'settling' && s.settleStartedAt !== null) {
    const quietSince = Math.max(s.settleStartedAt, s.lastFallAt ?? 0)
    if (t - quietSince >= SETTLE_QUIET_S || t - s.settleStartedAt >= SETTLE_MAX_S) {
      return { ...s, phase: 'over' }
    }
  }
  return s
}

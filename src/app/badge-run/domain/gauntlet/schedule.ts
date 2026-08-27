import { ARENA_SCHEDULE } from '../data/arenas'

/** The 29-round gauntlet schedule. Boss rounds are fixed. */
export interface RoundInfo {
  round: number
  arenaId: string
  isBoss: boolean
  bossId: string | null   // matches a key in BOSS_BOARDS
  draftEnabled: boolean   // B-5.7: false for rounds 25-29
}

/**
 * Arena IDs for boss rounds (each gym leader plays in their home arena).
 * For Elite Four / Champion, we reuse the closest thematic arena.
 */
const BOSS_ARENAS: Record<string, string> = {
  'brock':     'rock-tunnel',
  'misty':     'tidal-shelf',
  'surge':     'storm-plateau',
  'erika':     'overgrown-ruins',
  'koga':      'poison-marsh',
  'sabrina':   'silph-rooftop',
  'blaine':    'volcanic-cavern',
  'giovanni':  'excavation-site',
  'lorelei':   'frozen-pass',
  'bruno':     'rock-tunnel',       // Fighting → physical Rock arena
  'agatha':    'silph-rooftop',     // Ghost → Psychic rooftop (lore)
  'lance':     'storm-plateau',     // Dragon → Storm Plateau (flying adjacent)
  'champion':  'excavation-site',   // Champion (mixed) → neutral excavation
}

/** Boss rounds and their boss IDs. */
const BOSS_ROUNDS: Record<number, string> = {
  3:  'brock',
  6:  'misty',
  9:  'surge',
  12: 'erika',
  15: 'koga',
  18: 'sabrina',
  21: 'blaine',
  24: 'giovanni',
  25: 'lorelei',
  26: 'bruno',
  27: 'agatha',
  28: 'lance',
  29: 'champion',
}

/**
 * The full 29-round gauntlet schedule.
 * Free rounds cycle through ARENA_SCHEDULE (all 9 arenas, wrapping).
 */
export const GAUNTLET_SCHEDULE: RoundInfo[] = (() => {
  const schedule: RoundInfo[] = []
  let freeArenaIdx = 0

  for (let r = 1; r <= 29; r++) {
    const bossId = BOSS_ROUNDS[r] ?? null
    const isBoss = bossId !== null
    const draftEnabled = r < 25   // B-5.7: no drafting rounds 25-29

    let arenaId: string
    if (isBoss && bossId) {
      arenaId = BOSS_ARENAS[bossId]
    } else {
      // Cycle through arenas for free rounds
      arenaId = ARENA_SCHEDULE[freeArenaIdx % ARENA_SCHEDULE.length]
      freeArenaIdx++
    }

    schedule.push({ round: r, arenaId, isBoss, bossId, draftEnabled })
  }

  return schedule
})()

/** Look up schedule info for a given round (1-indexed). */
export function getRoundInfo(round: number): RoundInfo {
  if (round < 1 || round > 29) {
    throw new Error(`Round ${round} out of range (1-29)`)
  }
  return GAUNTLET_SCHEDULE[round - 1]
}

/** Return true if the given round is a gym/boss battle. */
export function isGymRound(round: number): boolean {
  return getRoundInfo(round).isBoss
}

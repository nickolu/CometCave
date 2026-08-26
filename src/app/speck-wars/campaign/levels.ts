import type { Difficulty, MapPreset } from '../store'

export interface LevelConfig {
  id: number
  name: string
  flavor: string          // 1-2 line cosmic narrator intro shown before the level
  difficulty: Difficulty
  seed: number            // fixed seed for consistent layout
  outpostCount: number    // 0 = no outposts
  mapPreset?: MapPreset   // terrain preset; defaults to 'open' if omitted
  preSpawn: {
    player: number        // basic units pre-spawned for player
    ai: number            // basic units pre-spawned for AI
  }
  starThresholds: {       // player base HP% required for each star count
    three: number         // e.g. 0.75 = 75% HP remaining
    two: number
  }
  allowTurrets?: boolean        // enables turret placement UI this level
  turretBudget?: number         // starting turret placement budget (default 0)
  survivalWaves?: number        // win when waveNumber reaches this (null = no survival win)
  isSurvival?: boolean
  surviveLengthMs?: number      // total survival time in ms
  noAiBase?: boolean            // skip AI base creation
  playerBaseCenter?: boolean    // place player base at world center (1500,1500)
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'First Contact',
    flavor: 'One base. No tricks. Just you and them.',
    difficulty: 'easy',
    seed: 1001,
    outpostCount: 0,
    mapPreset: 'open',
    preSpawn: { player: 15, ai: 5 },
    starThresholds: { three: 0.75, two: 0.40 },
  },
  {
    id: 2,
    name: 'Middle Ground',
    flavor: 'One outpost between you. Whoever holds it wins.',
    difficulty: 'easy',
    seed: 1002,
    outpostCount: 1,
    mapPreset: 'open',
    preSpawn: { player: 12, ai: 5 },
    starThresholds: { three: 0.70, two: 0.35 },
  },
  {
    id: 3,
    name: 'The Split',
    flavor: 'Two prizes. One army. Pick your fights.',
    difficulty: 'medium',
    seed: 1003,
    outpostCount: 2,
    mapPreset: 'open',
    preSpawn: { player: 10, ai: 10 },
    starThresholds: { three: 0.65, two: 0.30 },
  },
  {
    id: 4,
    name: 'Forward Command',
    flavor: 'Push your rally past the midline. Make them play your game.',
    difficulty: 'medium',
    seed: 1004,
    outpostCount: 1,
    mapPreset: 'pillars',
    preSpawn: { player: 8, ai: 8 },
    starThresholds: { three: 0.60, two: 0.28 },
  },
  {
    id: 5,
    name: 'Two Fronts',
    flavor: 'Two outposts. One army. Choose which fights are worth having.',
    difficulty: 'medium',
    seed: 1011,
    outpostCount: 3,
    mapPreset: 'open',
    preSpawn: { player: 6, ai: 6 },
    starThresholds: { three: 0.60, two: 0.25 },
  },
  {
    id: 6,
    name: 'The Crossing',
    flavor: 'One gap in the river wall. Control the crossing, control the game.',
    difficulty: 'hard',
    seed: 1006,
    outpostCount: 0,
    mapPreset: 'river',
    preSpawn: { player: 8, ai: 8 },
    starThresholds: { three: 0.55, two: 0.25 },
  },
  {
    id: 7,
    name: 'The Burst',
    flavor: 'They outpace you. Wait for the right moment — then strike.',
    difficulty: 'hard',
    seed: 1007,
    outpostCount: 1,
    mapPreset: 'walls',
    preSpawn: { player: 5, ai: 10 },
    starThresholds: { three: 0.55, two: 0.22 },
  },
  {
    id: 8,
    name: 'Full Board',
    flavor: 'Three prizes. The board is full. Everything is contested.',
    difficulty: 'hard',
    seed: 1008,
    outpostCount: 3,
    mapPreset: 'walls',
    preSpawn: { player: 5, ai: 5 },
    starThresholds: { three: 0.50, two: 0.20 },
  },
  {
    id: 9,
    name: 'Outnumbered',
    flavor: 'They start with more. Work smarter, not harder.',
    difficulty: 'hard',
    seed: 1009,
    outpostCount: 3,
    mapPreset: 'pillars',
    preSpawn: { player: 3, ai: 18 },
    starThresholds: { three: 0.45, two: 0.18 },
  },
  {
    id: 10,
    name: 'Endgame',
    flavor: 'No favors. No head start. Just you against the apex threat.',
    difficulty: 'very-hard',
    seed: 1010,
    outpostCount: 3,
    mapPreset: 'random',
    preSpawn: { player: 0, ai: 0 },
    starThresholds: { three: 0.40, two: 0.15 },
  },
  {
    id: 11,
    name: 'Last Stand',
    flavor: 'Hold the center. Survive the onslaught.',
    difficulty: 'very-hard',
    seed: 1111,
    outpostCount: 0,
    mapPreset: 'pillars',
    preSpawn: { player: 30, ai: 0 },
    starThresholds: { three: 0.65, two: 0.30 },
    allowTurrets: true,
    isSurvival: true,
    surviveLengthMs: 5 * 60 * 1000,
    noAiBase: true,
    playerBaseCenter: true,
  },
]

export function getLevelStars(levelId: number): number {
  try {
    const raw = localStorage.getItem(`speckwars-level-${levelId}-stars`)
    return raw ? parseInt(raw, 10) : 0
  } catch { return 0 }
}

export function saveLevelStars(levelId: number, stars: number): void {
  try {
    const existing = getLevelStars(levelId)
    if (stars > existing) localStorage.setItem(`speckwars-level-${levelId}-stars`, String(stars))
  } catch {}
}

export function getLevelBestTime(levelId: number): number | null {
  try {
    const raw = localStorage.getItem(`speckwars-level-${levelId}-time`)
    const n = raw ? parseInt(raw, 10) : NaN
    return isNaN(n) ? null : n
  } catch { return null }
}

export function saveLevelBestTime(levelId: number, ms: number): boolean {
  try {
    const prev = getLevelBestTime(levelId)
    if (prev === null || ms < prev) {
      localStorage.setItem(`speckwars-level-${levelId}-time`, String(ms))
      return true
    }
    return false
  } catch { return false }
}

// Level 1 is always unlocked. Level N requires at least 1 star on level N-1.
export function isLevelUnlocked(levelId: number): boolean {
  if (levelId <= 1) return true
  return getLevelStars(levelId - 1) >= 1
}

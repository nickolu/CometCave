import type { Difficulty } from '../store'

export interface LevelConfig {
  id: number
  name: string
  flavor: string          // 1-2 line cosmic narrator intro shown before the level
  difficulty: Difficulty
  seed: number            // fixed seed for consistent layout
  outpostCount: number    // 0 = no outposts
  preSpawn: {
    player: number        // basic units pre-spawned for player
    ai: number            // basic units pre-spawned for AI
  }
  starThresholds: {       // player base HP% required for each star count
    three: number         // e.g. 0.75 = 75% HP remaining
    two: number
  }
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'First Contact',
    flavor: 'One base. No tricks. Just you and them.',
    difficulty: 'easy',
    seed: 1001,
    outpostCount: 0,
    preSpawn: { player: 15, ai: 5 },
    starThresholds: { three: 0.75, two: 0.40 },
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

// Level 1 is always unlocked. Level N requires at least 1 star on level N-1.
export function isLevelUnlocked(levelId: number): boolean {
  if (levelId <= 1) return true
  return getLevelStars(levelId - 1) >= 1
}

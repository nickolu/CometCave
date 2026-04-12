export interface DifficultyModifiers {
  enemyHpMultiplier: number
  enemyAttackMultiplier: number
  goldMultiplier: number
  healRateMultiplier: number
  permadeath: boolean
  lootChanceMultiplier: number
}

export interface DifficultyMode {
  id: string
  name: string
  description: string
  icon: string
  modifiers: DifficultyModifiers
}

export const DIFFICULTY_MODES: DifficultyMode[] = [
  {
    id: 'normal',
    name: 'Normal',
    description: 'The standard adventure.',
    icon: '\u2694\uFE0F',
    modifiers: {
      enemyHpMultiplier: 1,
      enemyAttackMultiplier: 1,
      goldMultiplier: 1,
      healRateMultiplier: 1,
      permadeath: false,
      lootChanceMultiplier: 1,
    },
  },
  {
    id: 'hard',
    name: 'Hard',
    description: 'For seasoned adventurers.',
    icon: '\uD83D\uDC80',
    modifiers: {
      enemyHpMultiplier: 1.5,
      enemyAttackMultiplier: 1.5,
      goldMultiplier: 1.25,
      healRateMultiplier: 1,
      permadeath: false,
      lootChanceMultiplier: 1.25,
    },
  },
  {
    id: 'ironman',
    name: 'Ironman',
    description: 'One life, no second chances.',
    icon: '\uD83D\uDD25',
    modifiers: {
      enemyHpMultiplier: 1,
      enemyAttackMultiplier: 1,
      goldMultiplier: 1,
      healRateMultiplier: 1,
      permadeath: true,
      lootChanceMultiplier: 1,
    },
  },
  {
    id: 'casual',
    name: 'Casual',
    description: 'Enjoy the journey.',
    icon: '\uD83C\uDF3F',
    modifiers: {
      enemyHpMultiplier: 0.7,
      enemyAttackMultiplier: 0.7,
      goldMultiplier: 1.5,
      healRateMultiplier: 2,
      permadeath: false,
      lootChanceMultiplier: 1,
    },
  },
]

export function getDifficultyMode(id: string): DifficultyMode {
  return DIFFICULTY_MODES.find(m => m.id === id) ?? DIFFICULTY_MODES[0]
}

export function getDifficultyModifiers(id: string | undefined): DifficultyModifiers {
  return getDifficultyMode(id ?? 'normal').modifiers
}

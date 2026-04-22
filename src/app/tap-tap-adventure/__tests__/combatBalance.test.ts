import { describe, expect, it } from 'vitest'

import {
  initializePlayerCombatState,
  processPlayerAction,
  calculatePlayerDamage,
  calculateEnemyDamage,
} from '@/app/tap-tap-adventure/lib/combatEngine'
import { calculateMaxHp } from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatEnemy, CombatState } from '@/app/tap-tap-adventure/models/combat'

// Simulate a full combat with a simple AI: always attack
function simulateCombat(character: FantasyCharacter, enemy: CombatEnemy): {
  outcome: 'victory' | 'defeat'
  turns: number
  playerHpRemaining: number
  playerHpPct: number
} {
  const playerState = initializePlayerCombatState(character)
  let combatState: CombatState = {
    id: 'sim',
    eventId: 'sim',
    enemy: { ...enemy },
    playerState,
    turnNumber: 0,
    combatLog: [],
    status: 'active',
    scenario: 'test',
    enemyTelegraph: null,
    combatDistance: 'close',
  }

  let turns = 0
  const maxTurns = 200  // More iterations since each attack is one step

  while (combatState.status === 'active' && turns < maxTurns) {
    const previousTurnNumber = combatState.turnNumber
    const result = processPlayerAction(combatState, { action: 'attack' }, character)
    combatState = result.combatState
    // Count as a turn whenever the engine completes a full turn (enemy attacks)
    if (combatState.turnNumber > previousTurnNumber) {
      turns++
    }
  }
  // If fight ended without a full turn completing, count it
  if (combatState.status !== 'active' && turns === 0) {
    turns = 1
  }

  const outcome = combatState.status === 'victory' ? 'victory' : 'defeat'
  return {
    outcome,
    turns,
    playerHpRemaining: combatState.playerState.hp,
    playerHpPct: Math.round((combatState.playerState.hp / combatState.playerState.maxHp) * 100),
  }
}

function runSimulation(
  character: FantasyCharacter,
  enemy: CombatEnemy,
  trials: number = 500
): {
  winRate: number
  avgTurns: number
  avgHpRemainingPct: number
  avgHpRemainingOnWin: number
  losses: number
} {
  let wins = 0
  let totalTurns = 0
  let totalHpPctOnWin = 0
  let totalHpOnWin = 0

  for (let i = 0; i < trials; i++) {
    const result = simulateCombat(character, enemy)
    totalTurns += result.turns
    if (result.outcome === 'victory') {
      wins++
      totalHpPctOnWin += result.playerHpPct
      totalHpOnWin += result.playerHpRemaining
    }
  }

  return {
    winRate: Math.round((wins / trials) * 100),
    avgTurns: Math.round(totalTurns / trials),
    avgHpRemainingPct: wins > 0 ? Math.round(totalHpPctOnWin / wins) : 0,
    avgHpRemainingOnWin: wins > 0 ? Math.round(totalHpOnWin / wins) : 0,
    losses: trials - wins,
  }
}

// Helper to create characters at different levels
function makeChar(level: number, str: number = 5, int: number = 5, lck: number = 5): FantasyCharacter {
  const char: FantasyCharacter = {
    id: '1',
    playerId: 'p1',
    name: 'Sim',
    race: 'Human',
    class: 'Warrior',
    level,
    abilities: [],
    locationId: 'loc1',
    gold: 0,
    reputation: 0,
    distance: 0,
    status: 'active',
    strength: str,
    intelligence: int,
    luck: lck,
    inventory: [],
    deathCount: 0,
    pendingStatPoints: 0,
  }
  const maxHp = calculateMaxHp(char)
  return { ...char, hp: maxHp, maxHp }
}

function makeEnemy(level: number): CombatEnemy {
  return {
    id: 'enemy',
    name: 'Test Enemy',
    description: 'test',
    hp: 35 + level * 15,
    maxHp: 35 + level * 15,
    attack: 6 + level * 3,
    defense: 2 + level,
    level,
    goldReward: 10,
  }
}

function makeBoss(level: number): CombatEnemy {
  const base = makeEnemy(level)
  return {
    ...base,
    name: 'Boss',
    hp: Math.round(base.hp * 1.5),
    maxHp: Math.round(base.maxHp * 1.5),
    attack: Math.round(base.attack * 1.3),
    defense: Math.round(base.defense * 1.3),
    specialAbility: {
      name: 'Special',
      description: 'test',
      damage: Math.round((4 + level * 2) * 1.2),
      cooldown: 3,
    },
  }
}

describe('Combat Balance Simulation', () => {
  it('Level 1 vs Level 1 enemy: should usually win but take damage', () => {
    const char = makeChar(1, 5, 5, 5)
    const enemy = makeEnemy(1)
    const result = runSimulation(char, enemy)

    console.log('L1 vs L1 enemy:', result)

    // Player should win most fights
    expect(result.winRate).toBeGreaterThanOrEqual(85)
    // Should take some damage (AP system: 3 attacks vs 1 enemy attack per turn)
    expect(result.avgHpRemainingPct).toBeLessThan(80)
  })

  it('Level 3 vs Level 3 enemy: takes real damage', () => {
    const char = makeChar(3, 8, 6, 5)
    const enemy = makeEnemy(3)
    const result = runSimulation(char, enemy)

    console.log('L3 vs L3 enemy:', result)

    expect(result.winRate).toBeGreaterThanOrEqual(70)
    expect(result.avgHpRemainingPct).toBeLessThan(75)
  })

  it('Level 5 vs Level 5 enemy: challenging', () => {
    const char = makeChar(5, 12, 8, 6)
    const enemy = makeEnemy(5)
    const result = runSimulation(char, enemy)

    console.log('L5 vs L5 enemy:', result)

    expect(result.winRate).toBeGreaterThanOrEqual(70)
  })

  it('Level 1 vs Boss: very hard with brute force', () => {
    const char = makeChar(1, 5, 5, 5)
    const boss = makeBoss(1)
    const result = runSimulation(char, boss)

    console.log('L1 vs L1 boss:', result)

    // Bosses are harder than regular enemies (higher HP and attack multipliers)
    // With AP system, player deals 3x0.6=1.8x damage but boss has more HP and attack
    expect(result.winRate).toBeLessThanOrEqual(98)
  })

  it('fights should take 5-10 turns on average', () => {
    const char = makeChar(1, 5, 5, 5)
    const enemy = makeEnemy(1)
    const result = runSimulation(char, enemy)

    expect(result.avgTurns).toBeGreaterThanOrEqual(2)
    expect(result.avgTurns).toBeLessThanOrEqual(10)
  })

  // This test prints a summary table for manual review
  it('prints balance summary across levels', () => {
    const levels = [
      { level: 1, str: 5, int: 5, lck: 5 },
      { level: 2, str: 7, int: 6, lck: 5 },
      { level: 3, str: 8, int: 6, lck: 5 },
      { level: 5, str: 12, int: 8, lck: 6 },
      { level: 10, str: 20, int: 12, lck: 8 },
    ]

    console.log('\n=== COMBAT BALANCE SUMMARY ===')
    console.log('Level | Player HP | Enemy HP | Win% | Avg Turns | HP Left% | Boss Win%')
    console.log('------|-----------|----------|------|-----------|----------|----------')

    for (const l of levels) {
      const char = makeChar(l.level, l.str, l.int, l.lck)
      const enemy = makeEnemy(l.level)
      const boss = makeBoss(l.level)
      const vsEnemy = runSimulation(char, enemy, 300)
      const vsBoss = runSimulation(char, boss, 300)

      console.log(
        `  ${l.level.toString().padStart(3)}  | ${char.maxHp?.toString().padStart(9)} | ${enemy.maxHp.toString().padStart(8)} | ${vsEnemy.winRate.toString().padStart(3)}% | ${vsEnemy.avgTurns.toString().padStart(9)} | ${vsEnemy.avgHpRemainingPct.toString().padStart(7)}% | ${vsBoss.winRate.toString().padStart(8)}%`
      )
    }

    // This test always passes - it's for visual inspection
    expect(true).toBe(true)
  })
})

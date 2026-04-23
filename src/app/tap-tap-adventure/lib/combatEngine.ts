import { CLASS_ABILITIES, getClassElement, getSpellConfigForCharacter } from '@/app/tap-tap-adventure/config/characterOptions'
import { WEATHER_TYPES, WeatherId } from '@/app/tap-tap-adventure/config/weather'
import { AP_COSTS, MAX_AP } from '@/app/tap-tap-adventure/config/apCosts'
import { getElementalMultiplier, getEffectivenessText } from '@/app/tap-tap-adventure/config/elements'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Skill } from '@/app/tap-tap-adventure/models/skill'
import { getSkillBonus, hasSkill } from '@/app/tap-tap-adventure/lib/skillTracker'
import {
  CombatActionRequest,
  CombatDistance,
  CombatEnemy,
  CombatLogEntry,
  CombatPlayerState,
  CombatState,
  EnemyTelegraph,
  StatusEffect,
  TurnPhase,
} from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getRandomMount, getMountFreeMoves, getMountFleeBonus, getMountMaxHp } from '@/app/tap-tap-adventure/config/mounts'
import { calculateMercenaryDamage, getMercenaryMaxHp } from '@/app/tap-tap-adventure/config/mercenaries'

import { getDifficultyModifiers } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getCampBonuses } from '@/app/tap-tap-adventure/config/baseBuildings'

import { applyCombatItemEffect, isUsableInCombat } from './combatItemEffects'
import { calculateMaxMana } from './leveling'
import { generateSpellForLevel } from './spellGenerator'
import {
  applyShieldAbsorption,
  castSpell,
  getActiveDamageReduction,
  tickSpellCooldowns,
  tickSpellEffects,
} from './spellEngine'
import {
  applyStatusEffect,
  checkFearSkip,
  checkStunSkip,
  createStatusEffectFromAbility,
  getBerserkAttackMultiplier,
  getBerserkDefenseMultiplier,
  getBurnDefenseMultiplier,
  getFreezeMultiplier,
  getSlowMultiplier,
  getThornsDamage,
  hasStatusEffect,
  processReflect,
  tickStatusEffects,
} from './statusEffects'

/** Resolve all unlocked Skill objects: global skills plus class skill tree nodes. */
function resolveSkills(character: FantasyCharacter): Skill[] {
  const globalIds = character.unlockedSkills ?? []
  const globalSkills = SKILLS.filter(s => globalIds.includes(s.id))

  const tree = character.classSkillTree
  if (!tree) return globalSkills
  const treeIds = new Set(character.unlockedTreeSkillIds ?? [])
  const treeSkills: Skill[] = tree.nodes
    .filter(n => treeIds.has(n.id))
    .map(n => ({
      id: n.id,
      name: n.name,
      description: n.description,
      icon: n.icon,
      category: 'combat' as const,
      effect: n.effect,
      requirement: { type: 'level' as const, value: n.requiredLevel },
    }))

  return [...globalSkills, ...treeSkills]
}

export function initializePlayerCombatState(character: FantasyCharacter): CombatPlayerState {
  // Calculate equipment bonuses
  const equipment = character.equipment ?? { weapon: null, armor: null, accessory: null }
  const weaponBonus = equipment.weapon?.effects?.strength ?? 0
  const armorBonus = equipment.armor?.effects?.intelligence ?? 0
  const accessoryLuckBonus = equipment.accessory?.effects?.luck ?? 0

  // Calculate mount bonuses
  const mountStrBonus = character.activeMount?.bonuses?.strength ?? 0
  const mountIntBonus = character.activeMount?.bonuses?.intelligence ?? 0
  const mountLuckBonus = character.activeMount?.bonuses?.luck ?? 0

  // Calculate camp bonuses
  const campBonuses = getCampBonuses(character.campState?.buildingLevels ?? {})

  // Resolve passive skill bonuses
  const skills = resolveSkills(character)
  const attackBonus = getSkillBonus(skills, 'attack')
  const allStatsBonus = getSkillBonus(skills, 'all_stats')

  // Use persistent HP from character, falling back to max if not set
  const maxHp = character.maxHp ?? (30 + character.strength * 3 + character.level * 8)
  const currentHp = character.hp ?? maxHp
  const maxMana = character.maxMana ?? calculateMaxMana(character)
  const currentMana = character.mana ?? maxMana

  const baseAttack = 2 + character.strength + mountStrBonus + campBonuses.bonusStrength + Math.floor(character.level / 2) + weaponBonus * 2
  const baseDefense = 1 + Math.floor((character.intelligence + mountIntBonus) / 2) + Math.floor(campBonuses.bonusIntelligence / 2) + Math.floor(character.level / 2) + armorBonus

  // Calculate total luck for crit chance
  const totalLuck = character.luck + mountLuckBonus + accessoryLuckBonus

  const mountFreeMoves = character.activeMount
    ? getMountFreeMoves(character.activeMount.rarity)
    : 0

  // Gather passive effects from equipped items and apply drawback stat penalties
  const equippedItems = [equipment.weapon, equipment.armor, equipment.accessory].filter(Boolean) as Item[]
  let bonusCritChance = 0
  let dodgeChance = 0
  const initialStatusEffects: StatusEffect[] = []

  for (const item of equippedItems) {
    // Passive effects
    if (item.passiveEffect) {
      const pe = item.passiveEffect
      if (pe.type === 'crit_bonus') bonusCritChance += pe.value
      if (pe.type === 'dodge') dodgeChance += pe.value
      if (pe.type === 'thorns') {
        // Inject thorns as a persistent status effect (turnsRemaining = large number)
        initialStatusEffects.push({
          id: `passive-thorns-${item.id}`,
          name: 'Thorns',
          type: 'thorns',
          value: pe.value,
          turnsRemaining: 9999,
          source: 'player',
        })
      }
    }

    // Note: drawback stat penalties are already applied to character stats on equip,
    // so we do not re-apply them here to avoid double-counting.
  }

  return {
    hp: currentHp,
    maxHp,
    attack: baseAttack + attackBonus.flat + allStatsBonus.flat,
    defense: baseDefense + allStatsBonus.flat,
    isDefending: false,
    activeBuffs: [
      ...(accessoryLuckBonus > 0 ? [{ stat: 'attack' as const, value: accessoryLuckBonus, turnsRemaining: 999 }] : []),
      ...(mountLuckBonus > 0 ? [{ stat: 'attack' as const, value: mountLuckBonus, turnsRemaining: 999 }] : []),
    ],
    comboCount: 0,
    abilityCooldown: 0,
    enemyStunned: false,
    mana: currentMana,
    maxMana,
    spellCooldowns: {},
    activeSpellEffects: [],
    spellTagsUsed: [],
    shield: character.explorationShield ?? 0,
    statusEffects: initialStatusEffects,
    ap: MAX_AP,
    maxAp: MAX_AP,
    turnActions: [],
    luck: totalLuck,
    mountMovesRemaining: mountFreeMoves,
    mountHp: character.activeMount ? (character.activeMount.hp ?? getMountMaxHp(character.activeMount.rarity)) : undefined,
    mountMaxHp: character.activeMount ? getMountMaxHp(character.activeMount.rarity) : undefined,
    mercenaryHp: character.activeMercenary
      ? (character.activeMercenary.hp ?? getMercenaryMaxHp(character.activeMercenary.rarity))
      : undefined,
    mercenaryMaxHp: character.activeMercenary
      ? getMercenaryMaxHp(character.activeMercenary.rarity)
      : undefined,
    bonusCritChance: bonusCritChance > 0 ? bonusCritChance : undefined,
    dodgeChance: dodgeChance > 0 ? dodgeChance : undefined,
  }
}

function randomVariance(base: number, pct: number = 0.2): number {
  const variance = base * pct
  return base + (Math.random() * 2 - 1) * variance
}

/**
 * Combo multiplier: consecutive attacks build damage.
 * 0 combo = 1x, 1 = 1.25x, 2 = 1.5x, 3+ = 1.75x (capped)
 */
function getComboMultiplier(comboCount: number): number {
  return Math.min(1.75, 1 + comboCount * 0.25)
}

/**
 * Calculate the player's crit chance based on luck.
 * Base 5% + 1% per luck point, capped at 40%.
 */
function getPlayerCritChance(luck: number, bonusCritChance: number = 0): number {
  const baseCritChance = 0.05 + luck * 0.01 + bonusCritChance
  return Math.min(0.4, baseCritChance)
}

/**
 * Return weather-based combat modifiers.
 * - accuracyPenalty: probability (0.0–0.15) that an enemy attack misses entirely.
 * - critBonus: flat addition to player crit chance.
 * - fireMultiplier / iceMultiplier / lightningMultiplier: multiplicative on elemental damage.
 *
 * Note: weather modifiers apply to basic attacks only (calculatePlayerDamage / calculateEnemyDamage).
 * Spell damage in spellEngine.ts is intentionally excluded to avoid double-application.
 */
export function getWeatherCombatModifiers(weatherId: string | undefined): {
  accuracyPenalty: number
  critBonus: number
  fireMultiplier: number
  iceMultiplier: number
  lightningMultiplier: number
} {
  const weather = WEATHER_TYPES[( weatherId ?? 'clear') as WeatherId]
  if (!weather) {
    return { accuracyPenalty: 0, critBonus: 0, fireMultiplier: 1, iceMultiplier: 1, lightningMultiplier: 1 }
  }
  return {
    accuracyPenalty: weather.accuracyMod,
    critBonus: weather.critChanceMod,
    fireMultiplier: 1 + weather.fireDamageMod,
    iceMultiplier: 1 + weather.iceDamageMod,
    lightningMultiplier: 1 + weather.lightningDamageMod,
  }
}

export function calculatePlayerDamage(
  playerState: CombatPlayerState,
  enemy: CombatEnemy,
  character?: FantasyCharacter,
  bonusCritChance: number = 0
): { damage: number; elementalMultiplier: number; isCritical: boolean } {
  const buffedAttack =
    playerState.attack +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'attack')
      .reduce((sum, b) => sum + b.value, 0)
  const comboMultiplier = getComboMultiplier(playerState.comboCount)
  const berserkMultiplier = getBerserkAttackMultiplier(playerState.statusEffects)
  const enemyDefense = enemy.defense * getBurnDefenseMultiplier(enemy.statusEffects)

  const attackElement = character
    ? getClassElement(character.class, character.classData)
    : undefined
  const baseElementalMultiplier = getElementalMultiplier(attackElement, enemy.element)

  // Weather modifiers: boost elemental damage based on current weather
  const weatherMods = getWeatherCombatModifiers(character?.currentWeather)
  const weatherElementalBoost =
    attackElement === 'fire' ? weatherMods.fireMultiplier
    : attackElement === 'ice' ? weatherMods.iceMultiplier
    : attackElement === 'lightning' ? weatherMods.lightningMultiplier
    : 1.0
  const elementalMultiplier = baseElementalMultiplier * weatherElementalBoost

  const raw = randomVariance(buffedAttack) * comboMultiplier * berserkMultiplier * elementalMultiplier - enemyDefense
  // AP system: reduce per-action damage so 3 attacks ≈ 1.8x old single attack
  const apScaled = raw * 0.6

  // Critical strike check (weather can add crit bonus)
  const luck = playerState.luck ?? 0
  const critChance = getPlayerCritChance(luck, bonusCritChance + weatherMods.critBonus)
  const isCritical = Math.random() < critChance
  const critMultiplier = isCritical ? 2.0 : 1.0

  return { damage: Math.max(1, Math.round(apScaled * critMultiplier)), elementalMultiplier, isCritical }
}

/**
 * Weapon range damage multiplier.
 * close weapon at close: 1.0x, mid/far: can't attack (blocked earlier)
 * mid weapon at close: 0.9x, mid: 1.0x, far: can't attack
 * far weapon at close: 0.8x, mid: 0.9x, far: 1.0x
 */
function getWeaponRangeMultiplier(weaponRange: string, combatDist: string): number {
  const order = ['close', 'mid', 'far']
  const wIdx = order.indexOf(weaponRange)
  const dIdx = order.indexOf(combatDist)
  if (wIdx < 0 || dIdx < 0) return 1.0
  const diff = wIdx - dIdx
  if (diff <= 0) return 1.0
  if (diff === 1) return 0.9
  return 0.8
}

/**
 * Enemy range damage multiplier.
 * Ranged enemies deal reduced damage at distance:
 * far: 0.7x, mid: 0.85x, close: 1.0x
 */
function getEnemyRangeMultiplier(
  enemyRange: string | undefined,
  combatDist: string
): number {
  if (enemyRange !== 'ranged') return 1.0
  if (combatDist === 'far') return 0.7
  if (combatDist === 'mid') return 0.85
  return 1.0
}

/** Flat 5% crit chance for enemies, dealing 1.5x damage. */
const ENEMY_CRIT_CHANCE = 0.05
const ENEMY_CRIT_MULTIPLIER = 1.5

export function calculateEnemyDamage(
  enemy: CombatEnemy,
  playerState: CombatPlayerState,
  isHeavyAttack: boolean = false,
  character?: FantasyCharacter
): { damage: number; elementalMultiplier: number; isCritical: boolean } {
  // Weather-based miss chance: enemy may miss entirely due to poor visibility
  const enemyWeatherMods = getWeatherCombatModifiers(character?.currentWeather)
  if (enemyWeatherMods.accuracyPenalty > 0 && Math.random() < enemyWeatherMods.accuracyPenalty) {
    return { damage: 0, elementalMultiplier: 1, isCritical: false }
  }

  const effectiveDefense = playerState.isDefending
    ? playerState.defense * 2
    : playerState.defense
  const burnDefMult = getBurnDefenseMultiplier(playerState.statusEffects)
  const berserkDefMult = getBerserkDefenseMultiplier(playerState.statusEffects)
  const buffedDefense =
    (effectiveDefense * burnDefMult * berserkDefMult) +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'defense')
      .reduce((sum, b) => sum + b.value, 0)
  const slowMultiplier = getSlowMultiplier(enemy.statusEffects)
  const freezeMultiplier = getFreezeMultiplier(enemy.statusEffects)

  const defenseElement = character
    ? getClassElement(character.class, character.classData)
    : undefined
  const elementalMultiplier = getElementalMultiplier(enemy.element, defenseElement)

  // Weather can boost enemy elemental attacks (e.g., lightning enemies deal more in storms)
  const enemyWeatherElementalBoost =
    enemy.element === 'fire' ? enemyWeatherMods.fireMultiplier
    : enemy.element === 'ice' ? enemyWeatherMods.iceMultiplier
    : enemy.element === 'lightning' ? enemyWeatherMods.lightningMultiplier
    : 1.0

  const attackPower = (isHeavyAttack ? enemy.attack * 1.5 : enemy.attack) * slowMultiplier * freezeMultiplier * elementalMultiplier * enemyWeatherElementalBoost
  const raw = randomVariance(attackPower) - buffedDefense

  // Enemy critical strike check
  const isCritical = Math.random() < ENEMY_CRIT_CHANCE
  const critMultiplier = isCritical ? ENEMY_CRIT_MULTIPLIER : 1.0

  return { damage: Math.max(1, Math.round(raw * critMultiplier)), elementalMultiplier, isCritical }
}

export function calculateFleeChance(
  character: FantasyCharacter,
  enemy: CombatEnemy
): number {
  const skills = resolveSkills(character)
  const fleeBonus = getSkillBonus(skills, 'flee_chance')
  const allStatsBonus = getSkillBonus(skills, 'all_stats')
  const effectiveLuck = character.luck + allStatsBonus.flat
  const mountFleeBonus = character.activeMount
    ? getMountFleeBonus(character.activeMount.rarity) / 100
    : 0
  const personalityFleeBonus = (() => {
    const p = character.activeMount?.personality
    if (p === 'loyal') return 0.05
    if (p === 'skittish') return -0.05
    if (p === 'cautious') return 0.15
    return 0
  })()
  const chance = 0.3 + effectiveLuck * 0.02 - enemy.level * 0.05 + fleeBonus.percentage / 100 + mountFleeBonus + personalityFleeBonus
  return Math.max(0.1, Math.min(0.9, chance))
}

function tickBuffs(playerState: CombatPlayerState): CombatPlayerState {
  const activeBuffs = (playerState.activeBuffs ?? [])
    .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
    .filter(b => b.turnsRemaining > 0)
  return { ...playerState, activeBuffs }
}

/**
 * Generate a telegraph for the enemy's NEXT action.
 * This lets the player see what's coming and react.
 */
function generateEnemyTelegraph(enemy: CombatEnemy, turnNumber: number, isBoss: boolean): EnemyTelegraph {
  const hasSpecial = !!enemy.specialAbility
  const specialReady = hasSpecial && enemy.specialAbility!.cooldown > 0
    ? turnNumber > 0 && (turnNumber + 1) % enemy.specialAbility!.cooldown === 0
    : hasSpecial && Math.random() < 0.3

  if (specialReady) {
    return {
      action: 'special',
      description: `${enemy.name} is preparing ${enemy.specialAbility!.name}!`,
    }
  }

  const heavyChance = isBoss ? 0.35 : 0.2
  if (Math.random() < heavyChance) {
    return {
      action: 'heavy_attack',
      description: `${enemy.name} winds up for a powerful strike!`,
    }
  }

  const defendChance = isBoss ? 0.2 : 0.1
  if (Math.random() < defendChance) {
    return {
      action: 'defend',
      description: `${enemy.name} braces and raises their guard.`,
    }
  }

  // Telegraph status ability
  if (enemy.statusAbility && Math.random() < 0.3) {
    const statusNames: Record<string, string> = {
      poison: 'venomous',
      burn: 'fiery',
      slow: 'chilling',
      curse: 'cursed',
      fear: 'terrifying',
    }
    const adjective = statusNames[enemy.statusAbility.type] ?? 'empowered'
    return {
      action: 'normal_attack',
      description: `${enemy.name} prepares a ${adjective} strike!`,
    }
  }

  return {
    action: 'normal_attack',
    description: `${enemy.name} readies an attack.`,
  }
}

/**
 * Execute the enemy's telegraphed action.
 */
function executeEnemyTelegraph(
  telegraph: EnemyTelegraph,
  enemy: CombatEnemy,
  playerState: CombatPlayerState,
  turnNumber: number,
  character?: FantasyCharacter,
  combatDist?: CombatDistance
): {
  playerState: CombatPlayerState
  logs: CombatLogEntry[]
  enemyDefenseBoost: boolean
  moveCloser: boolean
} {
  const logs: CombatLogEntry[] = []
  let updatedPlayer = { ...playerState }
  let enemyDefenseBoost = false
  const dist = combatDist ?? 'mid'

  // Melee enemies can't attack from non-close range — they move closer instead
  if (enemy.range !== 'ranged' && dist !== 'close' && telegraph.action !== 'defend') {
    logs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'move',
      description: `${enemy.name} closes the distance!`,
    })
    return { playerState: updatedPlayer, logs, enemyDefenseBoost: false, moveCloser: true }
  }

  // Ranged enemy damage multiplier
  const rangeMult = getEnemyRangeMultiplier(enemy.range, dist)

  switch (telegraph.action) {
    case 'heavy_attack': {
      const { damage: rawDmg, elementalMultiplier, isCritical } = calculateEnemyDamage(
        enemy,
        updatedPlayer,
        true,
        character
      )
      if (rawDmg === 0) {
        // Weather miss
        logs.push({ turn: turnNumber, actor: 'enemy', action: 'heavy_attack', damage: 0, description: `${enemy.name}'s powerful blow goes wide in the poor visibility!` })
        break
      }
      const dmg = Math.max(1, Math.round(rawDmg * rangeMult))
      updatedPlayer.hp = Math.max(0, updatedPlayer.hp - dmg)
      const elemText = getEffectivenessText(elementalMultiplier)
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'heavy_attack',
        damage: dmg,
        description: `${isCritical ? 'CRITICAL! ' : ''}${enemy.name} unleashes a powerful blow for ${dmg} damage!${elemText ? ` ${elemText}` : ''}`,
        isCritical,
      })
      break
    }
    case 'special': {
      if (enemy.specialAbility) {
        const specialDmg = Math.max(
          1,
          Math.round(
            randomVariance(enemy.specialAbility.damage) -
              (updatedPlayer.isDefending ? updatedPlayer.defense : updatedPlayer.defense / 2)
          )
        )
        updatedPlayer.hp = Math.max(0, updatedPlayer.hp - specialDmg)
        logs.push({
          turn: turnNumber,
          actor: 'enemy',
          action: 'special',
          damage: specialDmg,
          description: `${enemy.name} uses ${enemy.specialAbility.name}! You take ${specialDmg} damage!`,
        })
      }
      break
    }
    case 'defend': {
      enemyDefenseBoost = true
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'defend',
        description: `${enemy.name} takes a defensive stance, reducing incoming damage.`,
      })
      break
    }
    case 'normal_attack':
    default: {
      const { damage: rawNormalDmg, elementalMultiplier, isCritical } = calculateEnemyDamage(
        enemy,
        updatedPlayer,
        false,
        character
      )
      if (rawNormalDmg === 0) {
        // Weather miss
        logs.push({ turn: turnNumber, actor: 'enemy', action: 'attack', damage: 0, description: `${enemy.name} swings wildly and misses in the poor visibility!` })
        break
      }
      const dmg = Math.max(1, Math.round(rawNormalDmg * rangeMult))
      updatedPlayer.hp = Math.max(0, updatedPlayer.hp - dmg)
      const elemText = getEffectivenessText(elementalMultiplier)
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'attack',
        damage: dmg,
        description: `${isCritical ? 'CRITICAL! ' : ''}${enemy.name} attacks you for ${dmg} damage!${elemText ? ` ${elemText}` : ''}`,
        isCritical,
      })
      break
    }
  }

  return { playerState: updatedPlayer, logs, enemyDefenseBoost, moveCloser: false }
}

/**
 * Mercenary auto-attack: fires at the end of each full turn.
 * Returns updated enemy, combat logs, and a flag for whether the merc killed the enemy.
 */
function applyMercenaryAutoAttack(
  character: FantasyCharacter,
  playerState: CombatPlayerState,
  enemy: CombatEnemy,
  turnNumber: number
): { enemy: CombatEnemy; logs: CombatLogEntry[]; killedEnemy: boolean } {
  if (!character.activeMercenary || (playerState.mercenaryHp ?? 1) <= 0) {
    return { enemy, logs: [], killedEnemy: false }
  }
  const merc = character.activeMercenary
  const damage = calculateMercenaryDamage(merc, enemy.defense)
  const updatedEnemy = { ...enemy, hp: Math.max(0, enemy.hp - damage) }
  const logs: CombatLogEntry[] = [
    {
      turn: turnNumber,
      actor: 'player',
      action: 'mercenary_attack',
      damage,
      description: `${merc.icon} ${merc.name} strikes ${enemy.name} for ${damage} damage!`,
    },
  ]
  const killedEnemy = updatedEnemy.hp <= 0
  return { enemy: updatedEnemy, logs, killedEnemy }
}

/**
 * Boss phase change: when a boss drops below 50% HP, boost their stats.
 * For the final boss, supports 3 phases triggered at 66% and 33% HP.
 */
function checkBossPhaseChange(
  enemy: CombatEnemy,
  isBoss: boolean,
  alreadyPhased: boolean,
  isFinalBoss?: boolean
): { enemy: CombatEnemy; phaseChanged: boolean; log?: CombatLogEntry } {
  if (!isBoss) return { enemy, phaseChanged: false }

  if (isFinalBoss) {
    const isPhase2 = enemy.name.includes('(Phase 2)')
    const isPhase3 = enemy.name.includes('(Phase 3)')

    if (!isPhase2 && !isPhase3) {
      // Phase 1 → 2 at 66% HP
      if (enemy.hp > enemy.maxHp * 0.66) return { enemy, phaseChanged: false }
      const originalName = enemy.name
      const phase2Enemy = {
        ...enemy,
        attack: Math.round(enemy.attack * 1.3),
        defense: Math.round(enemy.defense * 1.2),
        name: `${originalName} (Phase 2)`,
      }
      return {
        enemy: phase2Enemy,
        phaseChanged: true,
        log: {
          turn: 0,
          actor: 'enemy',
          action: 'phase_change',
          description: `${originalName} enters Phase 2! Power intensifies!`,
        },
      }
    } else if (isPhase2 && !isPhase3) {
      // Phase 2 → 3 at 33% HP
      if (enemy.hp > enemy.maxHp * 0.33) return { enemy, phaseChanged: false }
      const baseName = enemy.name.replace(' (Phase 2)', '')
      const phase3Enemy = {
        ...enemy,
        attack: Math.round(enemy.attack * 1.4),
        defense: Math.round(enemy.defense * 1.3),
        name: `${baseName} (Phase 3)`,
      }
      return {
        enemy: phase3Enemy,
        phaseChanged: true,
        log: {
          turn: 0,
          actor: 'enemy',
          action: 'phase_change',
          description: `${baseName} ascends to Phase 3! Celestial fury unleashed!`,
        },
      }
    }
    // Already Phase 3 — no further change
    return { enemy, phaseChanged: false }
  }

  // Regular boss: single enrage at 50% HP
  if (alreadyPhased) return { enemy, phaseChanged: false }
  if (enemy.hp > enemy.maxHp * 0.5) return { enemy, phaseChanged: false }

  const enragedEnemy = {
    ...enemy,
    attack: Math.round(enemy.attack * 1.4),
    defense: Math.round(enemy.defense * 1.3),
    name: `${enemy.name} (Enraged)`,
  }

  return {
    enemy: enragedEnemy,
    phaseChanged: true,
    log: {
      turn: 0,
      actor: 'enemy',
      action: 'phase_change',
      description: `${enemy.name} becomes enraged! Attack and defense increased!`,
    },
  }
}

/**
 * Apply weapon on-hit effects after a successful attack.
 * Returns updated enemy, playerState, and combat log entries.
 */
function applyWeaponOnHitEffect(
  weapon: Item,
  enemy: CombatEnemy,
  playerState: CombatPlayerState,
  damageDealt: number,
  turnNumber: number
): { enemy: CombatEnemy; playerState: CombatPlayerState; logs: CombatLogEntry[] } {
  const logs: CombatLogEntry[] = []
  const onHit = weapon.onHitEffect
  if (!onHit || damageDealt <= 0) return { enemy, playerState, logs }

  if (Math.random() >= onHit.chance) return { enemy, playerState, logs }

  const effectDamage = onHit.damage ?? 0
  const effectDuration = onHit.duration ?? 2

  switch (onHit.type) {
    case 'poison':
    case 'burn':
    case 'bleed': {
      const typeNames = { poison: 'Poisoned', burn: 'Burning', bleed: 'Bleeding' }
      const effect: StatusEffect = {
        id: `weapon-${onHit.type}-${Date.now()}`,
        name: typeNames[onHit.type],
        type: onHit.type,
        value: effectDamage,
        turnsRemaining: effectDuration,
        source: 'player',
      }
      enemy = {
        ...enemy,
        statusEffects: applyStatusEffect(enemy.statusEffects ?? [], effect),
      }
      logs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'status_effect',
        description: `Your weapon inflicts ${typeNames[onHit.type].toLowerCase()} on ${enemy.name}! (${effectDamage} damage/turn for ${effectDuration} turns)`,
      })
      break
    }
    case 'freeze': {
      const effect: StatusEffect = {
        id: `weapon-freeze-${Date.now()}`,
        name: 'Frozen',
        type: 'freeze',
        value: effectDamage,
        turnsRemaining: effectDuration,
        source: 'player',
      }
      enemy = {
        ...enemy,
        statusEffects: applyStatusEffect(enemy.statusEffects ?? [], effect),
      }
      logs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'status_effect',
        description: `Your weapon freezes ${enemy.name}! Attack power reduced by 50% for ${effectDuration} turns.`,
      })
      break
    }
    case 'stun': {
      const effect: StatusEffect = {
        id: `weapon-stun-${Date.now()}`,
        name: 'Stunned',
        type: 'stun',
        value: 1,
        turnsRemaining: 1, // Stun always lasts 1 turn
        source: 'player',
      }
      enemy = {
        ...enemy,
        statusEffects: applyStatusEffect(enemy.statusEffects ?? [], effect),
      }
      logs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'status_effect',
        description: `Your weapon stuns ${enemy.name}! They will skip their next action.`,
      })
      break
    }
    case 'lifesteal': {
      const healAmount = Math.max(1, Math.floor(damageDealt * 0.2))
      const oldHp = playerState.hp
      playerState = {
        ...playerState,
        hp: Math.min(playerState.maxHp, playerState.hp + healAmount),
      }
      const actualHeal = playerState.hp - oldHp
      if (actualHeal > 0) {
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'heal',
          description: `Your weapon drains life from ${enemy.name}, restoring ${actualHeal} HP!`,
        })
      }
      break
    }
  }

  return { enemy, playerState, logs }
}

export function processPlayerAction(
  combatState: CombatState,
  action: CombatActionRequest,
  character: FantasyCharacter
): { combatState: CombatState; consumedItemId?: string; mountDied?: boolean; mercenaryDied?: boolean } {
  let { enemy, playerState, turnNumber, combatLog, status, enemyTelegraph, isBoss } = structuredClone(combatState)
  const newLogs: CombatLogEntry[] = []
  let consumedItemId: string | undefined
  let mountDied = false
  const bossAlreadyPhased = isBoss && !combatState.isFinalBoss ? enemy.name.includes('(Enraged)') : false
  let combatDistance: CombatDistance = combatState.combatDistance ?? 'mid'
  // Only propagate combatDistance in returns if the original state had it set
  // This ensures backward compatibility with combat states created before range was added
  let rangeSystemActive = combatState.combatDistance !== undefined

  if (status !== 'active') {
    return { combatState }
  }

  // Initialize AP fields if missing (backward compat with old combat states)
  if (playerState.ap === undefined || playerState.ap === null) {
    playerState.ap = MAX_AP
  }
  if (playerState.maxAp === undefined || playerState.maxAp === null) {
    playerState.maxAp = MAX_AP
  }
  if (!playerState.turnActions) {
    playerState.turnActions = []
  }

  // Check AP cost for the requested action
  const apCost = AP_COSTS[action.action] ?? 1
  const isEndTurn = action.action === 'end_turn'

  if (!isEndTurn && apCost > playerState.ap) {
    newLogs.push({
      turn: turnNumber,
      actor: 'player',
      action: 'insufficient_ap',
      description: `Not enough AP! ${action.action} costs ${apCost} AP, but you only have ${playerState.ap} AP.`,
    })
    return {
      combatState: {
        ...combatState,
        playerState,
        combatLog: [...combatLog, ...newLogs],
        ...(rangeSystemActive ? { combatDistance } : {}),
        turnPhase: 'player',
      },
    }
  }

  // Deduct AP (end_turn costs 0)
  if (!isEndTurn) {
    playerState.ap -= apCost
    playerState.turnActions = [...(playerState.turnActions ?? []), action.action]
  }

  // Only reset isDefending at the start of a new turn (first action after AP reset),
  // not on every action within the same turn
  if ((playerState.turnActions ?? []).length <= 1 && !isEndTurn) {
    // Don't clear defending if the current action IS defend
    if (action.action !== 'defend') {
      playerState.isDefending = false
    }
  }

  // Track if enemy is defending this turn (from telegraph)
  const enemyDefending = enemyTelegraph?.action === 'defend'

  // Range check: attacks are blocked when target is farther than weapon's range
  if (!isEndTurn && rangeSystemActive) {
    const physicalActions = ['attack', 'heavy_attack', 'class_ability']
    if (physicalActions.includes(action.action)) {
      const weaponRange = character.equipment?.weapon?.effects?.range ?? 'close'
      const distOrder = ['close', 'mid', 'far'] as const
      const wReach = distOrder.indexOf(weaponRange as (typeof distOrder)[number])
      const curDist = distOrder.indexOf(combatDistance)
      if (curDist > wReach) {
        const actionLabel =
          action.action === 'heavy_attack'
            ? 'Heavy attack'
            : action.action === 'class_ability'
              ? 'Class ability'
              : 'Attack'
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'out_of_range',
          description: `${actionLabel} requires ${weaponRange} range or closer! Move closer first. (${combatDistance} range)`,
        })
        // Refund AP
        playerState.ap += apCost
        playerState.turnActions = playerState.turnActions?.slice(0, -1) ?? []
        return {
          combatState: {
            ...combatState,
            enemy,
            playerState,
            turnNumber,
            combatLog: [...combatLog, ...newLogs],
            status,
            enemyTelegraph,
            isBoss,
            ...(rangeSystemActive ? { combatDistance } : {}),
            turnPhase: 'player',
          },
          consumedItemId,
        }
      }
    }
  }

  // Process player action (skip for end_turn)
  if (!isEndTurn) {
    switch (action.action) {
      case 'attack': {
        const effectiveEnemy = enemyDefending
          ? { ...enemy, defense: enemy.defense * 2 }
          : enemy
        const { damage: rawAtkDmg, elementalMultiplier, isCritical } = calculatePlayerDamage(
          playerState,
          effectiveEnemy,
          character,
          playerState.bonusCritChance ?? 0
        )
        const wRangeMult = rangeSystemActive
          ? getWeaponRangeMultiplier(
              character.equipment?.weapon?.effects?.range ?? 'close',
              combatDistance
            )
          : 1.0
        const aggressiveBonus = (character.activeMount?.personality === 'aggressive' && combatDistance === 'close') ? 2 : 0
        const damage = Math.max(1, Math.round(rawAtkDmg * wRangeMult) + aggressiveBonus)
        enemy.hp = Math.max(0, enemy.hp - damage)
        playerState.comboCount = (playerState.comboCount ?? 0) + 1
        // Apply weapon on-hit effects
        if (character.equipment?.weapon?.onHitEffect) {
          const onHitResult = applyWeaponOnHitEffect(character.equipment.weapon, enemy, playerState, damage, turnNumber)
          enemy = onHitResult.enemy
          playerState = onHitResult.playerState
          newLogs.push(...onHitResult.logs)
        }
        // Apply lifesteal_passive from equipped items
        {
          const equippedItems = [character.equipment?.weapon, character.equipment?.armor, character.equipment?.accessory].filter(Boolean) as Item[]
          for (const eqItem of equippedItems) {
            if (eqItem.passiveEffect?.type === 'lifesteal_passive' && damage > 0) {
              const healAmt = Math.max(1, Math.floor(damage * eqItem.passiveEffect.value))
              const oldHp = playerState.hp
              playerState = { ...playerState, hp: Math.min(playerState.maxHp, playerState.hp + healAmt) }
              const actualHeal = playerState.hp - oldHp
              if (actualHeal > 0) {
                newLogs.push({ turn: turnNumber, actor: 'player', action: 'heal', description: `Lifesteal: restored ${actualHeal} HP!` })
              }
            }
          }
        }
        const comboText =
          playerState.comboCount > 1 ? ` (${playerState.comboCount}x combo!)` : ''
        const elemText = getEffectivenessText(elementalMultiplier)
        const critText = isCritical ? ' CRITICAL HIT!' : ''
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'attack',
          damage,
          description: `${critText ? 'CRITICAL HIT! ' : ''}You strike ${enemy.name} for ${damage} damage!${comboText}${elemText ? ` ${elemText}` : ''}`,
          isCritical,
        })
        break
      }
      case 'heavy_attack': {
        const effectiveEnemy = enemyDefending
          ? { ...enemy, defense: enemy.defense * 2 }
          : enemy
        const { damage: baseDmg, elementalMultiplier, isCritical } = calculatePlayerDamage(
          playerState,
          effectiveEnemy,
          character,
          0.05
        )
        const heavyWRangeMult = rangeSystemActive
          ? getWeaponRangeMultiplier(
              character.equipment?.weapon?.effects?.range ?? 'close',
              combatDistance
            )
          : 1.0
        const heavyAggressiveBonus = (character.activeMount?.personality === 'aggressive' && combatDistance === 'close') ? 2 : 0
        const damage = Math.max(1, Math.round(baseDmg * 1.8 * heavyWRangeMult) + heavyAggressiveBonus)
        enemy.hp = Math.max(0, enemy.hp - damage)
        playerState.comboCount = (playerState.comboCount ?? 0) + 1
        // Apply weapon on-hit effects
        if (character.equipment?.weapon?.onHitEffect) {
          const onHitResult = applyWeaponOnHitEffect(character.equipment.weapon, enemy, playerState, damage, turnNumber)
          enemy = onHitResult.enemy
          playerState = onHitResult.playerState
          newLogs.push(...onHitResult.logs)
        }
        // Apply lifesteal_passive from equipped items
        {
          const equippedItems = [character.equipment?.weapon, character.equipment?.armor, character.equipment?.accessory].filter(Boolean) as Item[]
          for (const eqItem of equippedItems) {
            if (eqItem.passiveEffect?.type === 'lifesteal_passive' && damage > 0) {
              const healAmt = Math.max(1, Math.floor(damage * eqItem.passiveEffect.value))
              const oldHp = playerState.hp
              playerState = { ...playerState, hp: Math.min(playerState.maxHp, playerState.hp + healAmt) }
              const actualHeal = playerState.hp - oldHp
              if (actualHeal > 0) {
                newLogs.push({ turn: turnNumber, actor: 'player', action: 'heal', description: `Lifesteal: restored ${actualHeal} HP!` })
              }
            }
          }
        }
        const comboText = playerState.comboCount > 1 ? ` (${playerState.comboCount}x combo!)` : ''
        const elemText = getEffectivenessText(elementalMultiplier)
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'heavy_attack',
          damage,
          description: `${isCritical ? 'CRITICAL HIT! ' : ''}You deliver a powerful heavy attack on ${enemy.name} for ${damage} damage!${comboText}${elemText ? ` ${elemText}` : ''}`,
          isCritical,
        })
        break
      }
      case 'defend': {
        // Defend stacks: defending twice in one turn should NOT double the bonus (only apply once)
        if (!playerState.isDefending) {
          playerState.isDefending = true
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'defend',
            description: 'You brace yourself, doubling your defense for this turn.',
          })
        } else {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'defend',
            description: 'You reinforce your defensive stance.',
          })
        }
        playerState.comboCount = 0
        break
      }
      case 'use_item': {
        playerState.comboCount = 0
        if (!action.itemId) {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'use_item',
            description: 'You fumble with your pack but find nothing to use.',
          })
          break
        }
        const item = character.inventory.find(
          i => i.id === action.itemId && i.status !== 'deleted' && isUsableInCombat(i)
        )
        if (!item) {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'use_item',
            description: 'That item cannot be used in combat.',
          })
          break
        }
        const result = applyCombatItemEffect(item, playerState)
        playerState = result.playerState
        consumedItemId = item.id
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'use_item',
          description: result.description,
        })
        break
      }
      case 'flee': {
        playerState.comboCount = 0
        const fleeChance = calculateFleeChance(character, enemy)
        if (Math.random() < fleeChance) {
          status = 'fled'
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'flee',
            description: 'You successfully escape from combat!',
          })
          return {
            combatState: {
              ...combatState,
              enemy,
              playerState,
              turnNumber,
              combatLog: [...combatLog, ...newLogs],
              status,
              enemyTelegraph: null,
              ...(rangeSystemActive ? { combatDistance } : {}),
              turnPhase: 'enemy_done',
            },
          }
        }
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'flee',
          description: `You try to flee but ${enemy.name} blocks your escape!`,
        })
        break
      }
      case 'class_ability': {
        const classId = character.class.toLowerCase()
        const ability = character.classData?.startingAbility
          ? { name: character.classData.startingAbility.name, description: character.classData.startingAbility.description, cooldown: character.classData.startingAbility.cooldown }
          : CLASS_ABILITIES[classId]
        if (!ability) {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            description: 'You have no class ability available.',
          })
          break
        }
        if ((playerState.abilityCooldown ?? 0) > 0) {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            description: `${ability.name} is not ready yet! (${playerState.abilityCooldown} turns remaining)`,
          })
          break
        }

        switch (classId) {
          case 'warrior': {
            const { damage: baseDmg, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
            const damage = Math.max(1, Math.round(baseDmg * 0.8))
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.enemyStunned = true
            playerState.comboCount = (playerState.comboCount ?? 0) + 1
            const elemText = getEffectivenessText(elementalMultiplier)
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `You bash ${enemy.name} with your shield for ${damage} damage, stunning them!${elemText ? ` ${elemText}` : ''}`,
            })
            break
          }
          case 'mage': {
            const { damage: baseDmg, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
            const damage = Math.max(1, Math.round(baseDmg * 2))
            const recoil = Math.max(1, Math.round(playerState.maxHp * 0.2))
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.hp = Math.max(1, playerState.hp - recoil)
            playerState.comboCount = 0
            const elemText = getEffectivenessText(elementalMultiplier)
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `You unleash an Arcane Blast for ${damage} damage! The magical recoil deals ${recoil} damage to you.${elemText ? ` ${elemText}` : ''}`,
            })
            break
          }
          case 'rogue': {
            const combo = playerState.comboCount ?? 0
            if (combo >= 2) {
              const { damage: baseDmg, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
              const damage = Math.max(1, Math.round(baseDmg * 3))
              enemy.hp = Math.max(0, enemy.hp - damage)
              playerState.comboCount = 0
              const elemText = getEffectivenessText(elementalMultiplier)
              newLogs.push({
                turn: turnNumber,
                actor: 'player',
                action: 'class_ability',
                damage,
                description: `You exploit your ${combo}x combo with a devastating Backstab for ${damage} damage!${elemText ? ` ${elemText}` : ''}`,
              })
            } else {
              const { damage, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
              enemy.hp = Math.max(0, enemy.hp - damage)
              playerState.comboCount = (playerState.comboCount ?? 0) + 1
              const elemText = getEffectivenessText(elementalMultiplier)
              newLogs.push({
                turn: turnNumber,
                actor: 'player',
                action: 'class_ability',
                damage,
                description: `Your Backstab lacks setup and deals ${damage} normal damage.${elemText ? ` ${elemText}` : ''}`,
              })
            }
            break
          }
          case 'ranger': {
            const buffedAttack =
              playerState.attack +
              (playerState.activeBuffs ?? [])
                .filter(b => b.stat === 'attack')
                .reduce((sum, b) => sum + b.value, 0)
            const damage = Math.max(1, Math.round(buffedAttack))
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.comboCount = (playerState.comboCount ?? 0) + 1
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `Your Precise Shot pierces through all defenses for ${damage} damage!`,
            })
            break
          }
        }
        playerState.abilityCooldown = ability.cooldown
        break
      }
      case 'cast_spell': {
        if (!action.spellId) {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'cast_spell',
            description: 'No spell selected.',
          })
          break
        }
        const spellbook = character.spellbook ?? []
        const spell = spellbook.find(s => s.id === action.spellId)
        if (!spell) {
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'cast_spell',
            description: 'You do not know that spell.',
          })
          break
        }
        // Use the current combat state with updated turn number for condition checking
        try {
          const spellCombatState = { ...combatState, turnNumber, combatLog: [...combatLog, ...newLogs] }
          const spellResult = castSpell(spell, playerState, enemy, character, spellCombatState)
          playerState = spellResult.playerState
          enemy = spellResult.enemy
          newLogs.push(...spellResult.logs)
        } catch (err) {
          console.error('Spell casting error:', err)
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'cast_spell',
            description: `Failed to cast ${spell.name}. The spell fizzles.`,
          })
        }
        break
      }
      case 'move_closer': {
        rangeSystemActive = true
        if (combatDistance === 'close') {
          newLogs.push({ turn: turnNumber, actor: 'player', action: 'move_closer', description: 'You are already at close range!' })
          playerState.ap += apCost
          playerState.turnActions = playerState.turnActions?.slice(0, -1) ?? []
        } else {
          const usedMountMove = (playerState.mountMovesRemaining ?? 0) > 0
          if (usedMountMove) {
            // Refund the AP cost — this move is free via mount
            playerState.ap += apCost
            playerState.turnActions = playerState.turnActions?.slice(0, -1) ?? []
            playerState.mountMovesRemaining = (playerState.mountMovesRemaining ?? 1) - 1
          }
          combatDistance = combatDistance === 'far' ? 'mid' : 'close'
          const moveDesc = usedMountMove
            ? `Your mount carries you to ${combatDistance} range!`
            : `You close the distance to ${combatDistance} range!`
          newLogs.push({ turn: turnNumber, actor: 'player', action: 'move_closer', description: moveDesc })
        }
        break
      }
      case 'move_away': {
        rangeSystemActive = true
        if (combatDistance === 'far') {
          newLogs.push({ turn: turnNumber, actor: 'player', action: 'move_away', description: 'You are already at maximum distance!' })
          playerState.ap += apCost
          playerState.turnActions = playerState.turnActions?.slice(0, -1) ?? []
        } else {
          const usedMountMove = (playerState.mountMovesRemaining ?? 0) > 0
          if (usedMountMove) {
            // Refund the AP cost — this move is free via mount
            playerState.ap += apCost
            playerState.turnActions = playerState.turnActions?.slice(0, -1) ?? []
            playerState.mountMovesRemaining = (playerState.mountMovesRemaining ?? 1) - 1
          }
          combatDistance = combatDistance === 'close' ? 'mid' : 'far'
          const moveDesc = usedMountMove
            ? `Your mount swiftly carries you back to ${combatDistance} range!`
            : `You move back to ${combatDistance} range!`
          newLogs.push({ turn: turnNumber, actor: 'player', action: 'move_away', description: moveDesc })
        }
        break
      }
    }
  }

  // Check boss phase change
  if (enemy.hp > 0) {
    const phase = checkBossPhaseChange(enemy, !!isBoss, bossAlreadyPhased, combatState.isFinalBoss)
    if (phase.phaseChanged) {
      enemy = phase.enemy
      if (phase.log) {
        newLogs.push({ ...phase.log, turn: turnNumber })
      }
    }
  }

  // Check victory
  if (enemy.hp <= 0) {
    status = 'victory'
    newLogs.push({
      turn: turnNumber,
      actor: 'player',
      action: 'victory',
      description: `You defeated ${enemy.name}!`,
    })
    return {
      combatState: {
        ...combatState,
        enemy,
        playerState: tickBuffs(playerState),
        turnNumber,
        combatLog: [...combatLog, ...newLogs],
        status,
        enemyTelegraph: null,
        ...(rangeSystemActive ? { combatDistance } : {}),
        turnPhase: 'enemy_done',
      },
      consumedItemId,
    }
  }

  // If player still has AP and didn't end turn, return for more player actions
  if (playerState.ap > 0 && !isEndTurn) {
    return {
      combatState: {
        ...combatState,
        enemy,
        playerState,
        turnNumber,
        combatLog: [...combatLog, ...newLogs],
        status,
        enemyTelegraph,
        isBoss,
        ...(rangeSystemActive ? { combatDistance } : {}),
        turnPhase: 'player',
      },
      consumedItemId,
    }
  }

  // AP exhausted or end turn: process enemy turn
  // Increment turn number for the enemy phase
  turnNumber += 1

  // Execute enemy's telegraphed action (or normal attack if no telegraph)
  // Check fear: 50% chance to skip action
  const enemyFeared = checkFearSkip(enemy.statusEffects)
  const enemyStatusStunned = checkStunSkip(enemy.statusEffects)
  if (playerState.enemyStunned) {
    playerState.enemyStunned = false
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'stunned',
      description: `${enemy.name} is stunned and cannot act!`,
    })
  } else if (enemyStatusStunned) {
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'stunned',
      description: `${enemy.name} is stunned and cannot act!`,
    })
  } else if (enemyFeared) {
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'feared',
      description: `${enemy.name} is paralyzed with fear and cannot act!`,
    })
  } else if (enemyTelegraph) {
    const result = executeEnemyTelegraph(
      enemyTelegraph,
      enemy,
      playerState,
      turnNumber,
      character,
      combatDistance
    )
    playerState = result.playerState
    if (result.moveCloser) {
      // Melee enemy moved closer instead of attacking
      combatDistance = combatDistance === 'far' ? 'mid' : 'close'
      newLogs.push(...result.logs)
    }
    const enemyDmgLog = result.moveCloser
      ? undefined
      : result.logs.find(l => l.damage && l.damage > 0)
    let actualDamageDealt = 0
    // Dodge check: if player has dodge chance, they may evade the attack entirely
    const playerDodgeChance = playerState.dodgeChance ?? 0
    const playerDodged = playerDodgeChance > 0 && Math.random() < playerDodgeChance
    if (playerDodged && enemyDmgLog) {
      newLogs.push({ turn: turnNumber, actor: 'player', action: 'dodge', description: 'You nimbly dodge the attack!' })
    }
    if (!playerDodged && enemyDmgLog && enemyDmgLog.damage) {
      const originalDmg = enemyDmgLog.damage
      playerState.hp = Math.min(playerState.maxHp, playerState.hp + originalDmg)

      const dmgReduction = getActiveDamageReduction(playerState)
      const reducedDmg = Math.max(1, Math.round(originalDmg * (1 - dmgReduction / 100)))
      const shieldResult = applyShieldAbsorption(playerState, reducedDmg)
      playerState = shieldResult.playerState
      actualDamageDealt = shieldResult.damageAfterShield

      // Apply reflect
      if (hasStatusEffect(playerState.statusEffects, 'reflect')) {
        const reflectResult = processReflect(playerState.statusEffects ?? [], actualDamageDealt)
        if (reflectResult.reflectedDamage > 0) {
          enemy.hp = Math.max(0, enemy.hp - reflectResult.reflectedDamage)
          playerState = { ...playerState, statusEffects: reflectResult.updatedEffects }
          newLogs.push({
            turn: turnNumber, actor: 'player', action: 'reflect', damage: reflectResult.reflectedDamage,
            description: `Your reflect barrier sends ${reflectResult.reflectedDamage} damage back to ${enemy.name}!`,
          })
        }
      }

      // Mount targeting: 20% chance enemy targets mount instead of player
      if (playerState.mountHp !== undefined && playerState.mountHp > 0 && Math.random() < 0.2) {
        playerState.mountHp = Math.max(0, playerState.mountHp - actualDamageDealt)
        newLogs.push({
          turn: turnNumber, actor: 'enemy', action: 'attack', damage: actualDamageDealt,
          description: `${enemy.name} targets your mount for ${actualDamageDealt} damage!`,
        })
        if (playerState.mountHp <= 0) {
          mountDied = true
          playerState.mountHp = 0
          newLogs.push({
            turn: turnNumber, actor: 'enemy', action: 'status_effect',
            description: `Your mount has fallen in combat! 💀`,
          })
        }
      } else {
        playerState.hp = Math.max(0, playerState.hp - actualDamageDealt)
      }

      if (dmgReduction > 0 || actualDamageDealt < reducedDmg) {
        const shieldAbsorbed = reducedDmg - actualDamageDealt
        const parts: string[] = []
        if (dmgReduction > 0) parts.push(`${dmgReduction}% reduced`)
        if (shieldAbsorbed > 0) parts.push(`${shieldAbsorbed} absorbed by shield`)
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'spell_mitigation',
          description: `Spell effects mitigate damage (${parts.join(', ')})!`,
        })
      }

      // Apply thorns damage back to enemy
      const thornsDmg = getThornsDamage(playerState.statusEffects)
      if (thornsDmg > 0) {
        enemy.hp = Math.max(0, enemy.hp - thornsDmg)
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'thorns', damage: thornsDmg,
          description: `Thorns deal ${thornsDmg} damage back to ${enemy.name}!`,
        })
      }
      // Fierce mount personality: reflect 10% damage
      if (character.activeMount?.personality === 'fierce' && actualDamageDealt > 0 && !mountDied) {
        const fierceReflect = Math.max(1, Math.round(actualDamageDealt * 0.1))
        enemy.hp = Math.max(0, enemy.hp - fierceReflect)
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'reflect', damage: fierceReflect,
          description: `Your mount retaliates, dealing ${fierceReflect} damage to ${enemy.name}!`,
        })
      }
    }
    if (!result.moveCloser) {
      newLogs.push(...result.logs)
    }

    // Enemy status ability: chance to inflict status effect on player
    if (enemy.statusAbility && actualDamageDealt > 0) {
      if (Math.random() < enemy.statusAbility.chance) {
        // Check poison/burn immunity from passive effects
        const equippedItemsForImmunity = [character.equipment?.weapon, character.equipment?.armor, character.equipment?.accessory].filter(Boolean) as Item[]
        const hasPoisonImmunity = equippedItemsForImmunity.some(i => i.passiveEffect?.type === 'poison_immunity')
        const hasBurnImmunity = equippedItemsForImmunity.some(i => i.passiveEffect?.type === 'burn_immunity')
        const isImmune = (enemy.statusAbility.type === 'poison' && hasPoisonImmunity) || (enemy.statusAbility.type === 'burn' && hasBurnImmunity)
        if (isImmune) {
          newLogs.push({ turn: turnNumber, actor: 'player', action: 'status_effect', description: `You are immune to ${enemy.statusAbility.type}!` })
        } else {
          const statusEffect = createStatusEffectFromAbility(
            enemy.statusAbility.type, enemy.statusAbility.value, enemy.statusAbility.duration, 'enemy'
          )
          playerState = { ...playerState, statusEffects: applyStatusEffect(playerState.statusEffects ?? [], statusEffect) }
          newLogs.push({
            turn: turnNumber, actor: 'enemy', action: 'status_effect',
            description: `${enemy.name} inflicts ${statusEffect.name} on you!`,
          })
        }
      }
    }
  } else {
    // Fallback attack (no telegraph) — check enemy range
    const fallbackMelee = enemy.range !== 'ranged'
    if (fallbackMelee && combatDistance !== 'close') {
      // Melee enemy can't reach — move closer instead
      combatDistance = combatDistance === 'far' ? 'mid' : 'close'
      newLogs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'move',
        description: `${enemy.name} closes the distance to ${combatDistance} range!`,
      })
    } else {
      const fbRangeMult = getEnemyRangeMultiplier(enemy.range, combatDistance)
      const {
        damage: enemyRawDmg,
        elementalMultiplier: enemyElemMult,
        isCritical: enemyCrit,
      } = calculateEnemyDamage(enemy, playerState, false, character)
      if (enemyRawDmg === 0) {
        // Weather miss
        newLogs.push({
          turn: turnNumber,
          actor: 'enemy',
          action: 'attack',
          damage: 0,
          description: `${enemy.name} swings wildly and misses in the poor visibility!`,
        })
      } else {
      // Dodge check for fallback attack
      const fbPlayerDodgeChance = playerState.dodgeChance ?? 0
      const fbPlayerDodged = fbPlayerDodgeChance > 0 && Math.random() < fbPlayerDodgeChance
      if (fbPlayerDodged) {
        newLogs.push({ turn: turnNumber, actor: 'player', action: 'dodge', description: 'You nimbly dodge the attack!' })
      }
      if (!fbPlayerDodged) {
      const enemyDmg = Math.max(1, Math.round(enemyRawDmg * fbRangeMult))
      const dmgReduction = getActiveDamageReduction(playerState)
      const reducedDmg = Math.max(1, Math.round(enemyDmg * (1 - dmgReduction / 100)))
      const shieldResult = applyShieldAbsorption(playerState, reducedDmg)
      playerState = shieldResult.playerState
      const actualDmg = shieldResult.damageAfterShield

      // Apply reflect
      if (hasStatusEffect(playerState.statusEffects, 'reflect')) {
        const reflectResult = processReflect(playerState.statusEffects ?? [], actualDmg)
        if (reflectResult.reflectedDamage > 0) {
          enemy.hp = Math.max(0, enemy.hp - reflectResult.reflectedDamage)
          playerState = { ...playerState, statusEffects: reflectResult.updatedEffects }
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'reflect',
            damage: reflectResult.reflectedDamage,
            description: `Your reflect barrier sends ${reflectResult.reflectedDamage} damage back to ${enemy.name}!`,
          })
        }
      }

      const enemyElemText = getEffectivenessText(enemyElemMult)
      // Mount targeting: 20% chance enemy targets mount instead of player
      if (playerState.mountHp !== undefined && playerState.mountHp > 0 && Math.random() < 0.2) {
        playerState.mountHp = Math.max(0, playerState.mountHp - actualDmg)
        newLogs.push({
          turn: turnNumber, actor: 'enemy', action: 'attack', damage: actualDmg,
          description: `${enemy.name} targets your mount for ${actualDmg} damage!`,
        })
        if (playerState.mountHp <= 0) {
          mountDied = true
          playerState.mountHp = 0
          newLogs.push({
            turn: turnNumber, actor: 'enemy', action: 'status_effect',
            description: `Your mount has fallen in combat! 💀`,
          })
        }
      } else {
        playerState.hp = Math.max(0, playerState.hp - actualDmg)
        newLogs.push({
          turn: turnNumber,
          actor: 'enemy',
          action: 'attack',
          damage: actualDmg,
          description: `${enemyCrit ? 'CRITICAL! ' : ''}${enemy.name} attacks you for ${actualDmg} damage!${dmgReduction > 0 ? ` (${dmgReduction}% reduced)` : ''}${(playerState.shield ?? 0) > 0 || reducedDmg !== actualDmg ? ' (shield absorbed some)' : ''}${enemyElemText ? ` ${enemyElemText}` : ''}`,
          isCritical: enemyCrit,
        })
      }

      // Apply thorns damage back to enemy
      const thornsDmg = getThornsDamage(playerState.statusEffects)
      if (thornsDmg > 0) {
        enemy.hp = Math.max(0, enemy.hp - thornsDmg)
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'thorns',
          damage: thornsDmg,
          description: `Thorns deal ${thornsDmg} damage back to ${enemy.name}!`,
        })
      }
      // Fierce mount personality: reflect 10% damage
      if (character.activeMount?.personality === 'fierce' && actualDmg > 0 && !mountDied) {
        const fierceReflect = Math.max(1, Math.round(actualDmg * 0.1))
        enemy.hp = Math.max(0, enemy.hp - fierceReflect)
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'reflect', damage: fierceReflect,
          description: `Your mount retaliates, dealing ${fierceReflect} damage to ${enemy.name}!`,
        })
      }

      // Enemy status ability: chance to inflict status effect on player
      if (enemy.statusAbility) {
        if (Math.random() < enemy.statusAbility.chance) {
          // Check poison/burn immunity from passive effects
          const fbEquippedItemsForImmunity = [character.equipment?.weapon, character.equipment?.armor, character.equipment?.accessory].filter(Boolean) as Item[]
          const fbHasPoisonImmunity = fbEquippedItemsForImmunity.some(i => i.passiveEffect?.type === 'poison_immunity')
          const fbHasBurnImmunity = fbEquippedItemsForImmunity.some(i => i.passiveEffect?.type === 'burn_immunity')
          const fbIsImmune = (enemy.statusAbility.type === 'poison' && fbHasPoisonImmunity) || (enemy.statusAbility.type === 'burn' && fbHasBurnImmunity)
          if (fbIsImmune) {
            newLogs.push({ turn: turnNumber, actor: 'player', action: 'status_effect', description: `You are immune to ${enemy.statusAbility.type}!` })
          } else {
            const statusEffect = createStatusEffectFromAbility(
              enemy.statusAbility.type,
              enemy.statusAbility.value,
              enemy.statusAbility.duration,
              'enemy'
            )
            playerState = {
              ...playerState,
              statusEffects: applyStatusEffect(playerState.statusEffects ?? [], statusEffect),
            }
            newLogs.push({
              turn: turnNumber,
              actor: 'enemy',
              action: 'status_effect',
              description: `${enemy.name} inflicts ${statusEffect.name} on you!`,
            })
          }
        }
      }
      } // end if (!fbPlayerDodged)
      } // end else (enemyRawDmg > 0)
    }
  }

  // Check defeat
  if (playerState.hp <= 0) {
    status = 'defeat'
    newLogs.push({
      turn: turnNumber, actor: 'enemy', action: 'defeat',
      description: `You have been defeated by ${enemy.name}...`,
    })
  }

  // Tick spell effects (DOTs, HOTs, bleeds) at end of full turn
  if (status === 'active') {
    const spellTickResult = tickSpellEffects(playerState, enemy, turnNumber)
    playerState = spellTickResult.playerState
    enemy = spellTickResult.enemy
    newLogs.push(...spellTickResult.logs)

    // Tick status effects (poison, burn, etc.)
    const statusTickResult = tickStatusEffects(playerState, enemy, turnNumber)
    playerState = statusTickResult.playerState
    enemy = statusTickResult.enemy
    newLogs.push(...statusTickResult.logs)

    // Check victory from DOT/bleed/status effects
    if (enemy.hp <= 0) {
      status = 'victory'
      newLogs.push({
        turn: turnNumber, actor: 'player', action: 'victory',
        description: `You defeated ${enemy.name} with lingering effects!`,
      })
    }

    // Check defeat from status effects
    if (playerState.hp <= 0) {
      status = 'defeat'
      newLogs.push({
        turn: turnNumber, actor: 'enemy', action: 'defeat',
        description: `You succumbed to status effects...`,
      })
    }
  }

  // Mercenary auto-attack fires at end of each full turn
  if (status === 'active' && character.activeMercenary) {
    const mercResult = applyMercenaryAutoAttack(character, playerState, enemy, turnNumber)
    enemy = mercResult.enemy
    newLogs.push(...mercResult.logs)
    if (mercResult.killedEnemy) {
      status = 'victory'
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'victory',
        description: `${character.activeMercenary.name} delivers the killing blow on ${enemy.name}!`,
      })
    }
  }

  // Tick buffs at end of full turn
  playerState = tickBuffs(playerState)

  // Tick ability cooldown at end of full turn
  if ((playerState.abilityCooldown ?? 0) > 0) {
    playerState = { ...playerState, abilityCooldown: playerState.abilityCooldown! - 1 }
  }

  // Tick spell cooldowns at end of full turn
  playerState = tickSpellCooldowns(playerState)

  // Reset AP for next turn, clear turn actions, clear defending
  playerState.ap = playerState.maxAp ?? MAX_AP
  playerState.turnActions = []
  playerState.isDefending = false
  // Reset mount free moves for next turn
  if (character.activeMount) {
    playerState.mountMovesRemaining = getMountFreeMoves(character.activeMount.rarity)
  }

  // Enemy may try to change distance based on their range type
  if (status === 'active' && combatDistance !== 'close' && enemy.range !== 'ranged') {
    // Melee enemy closes distance one step
    combatDistance = combatDistance === 'far' ? 'mid' : 'close'
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'move',
      description: `${enemy.name} closes in to ${combatDistance} range!`,
    })
  } else if (status === 'active' && combatDistance === 'close' && enemy.range === 'ranged') {
    // Ranged enemies try to back away
    if (Math.random() < 0.3) {
      combatDistance = 'mid'
      newLogs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'move',
        description: `${enemy.name} backs away to mid range!`,
      })
    }
  }

  // Enemy may try to change distance based on their combat style
  if (status === 'active' && combatDistance !== 'close') {
    const enemyIsRanged = enemy.element === 'arcane' || enemy.element === 'shadow' || enemy.name.toLowerCase().includes('mage') || enemy.name.toLowerCase().includes('archer') || enemy.name.toLowerCase().includes('caster')
    if (!enemyIsRanged) {
      // Melee enemy closes distance one step
      combatDistance = combatDistance === 'far' ? 'mid' : 'close'
      newLogs.push({
        turn: turnNumber, actor: 'enemy', action: 'move',
        description: `${enemy.name} closes in to ${combatDistance} range!`,
      })
    }
  } else if (status === 'active' && combatDistance === 'close') {
    // Ranged enemies try to back away
    const enemyIsRanged = enemy.element === 'arcane' || enemy.element === 'shadow' || enemy.name.toLowerCase().includes('mage') || enemy.name.toLowerCase().includes('archer') || enemy.name.toLowerCase().includes('caster')
    if (enemyIsRanged && Math.random() < 0.3) {
      combatDistance = 'mid'
      newLogs.push({
        turn: turnNumber, actor: 'enemy', action: 'move',
        description: `${enemy.name} backs away to mid range!`,
      })
    }
  }

  // Generate telegraph for enemy's NEXT action
  const nextTelegraph = status === 'active'
    ? generateEnemyTelegraph(enemy, turnNumber, !!isBoss)
    : null

  return {
    combatState: {
      ...combatState,
      enemy,
      playerState,
      turnNumber,
      combatLog: [...combatLog, ...newLogs],
      status,
      enemyTelegraph: nextTelegraph,
      isBoss,
      ...(rangeSystemActive ? { combatDistance } : {}),
      turnPhase: 'enemy_done',
    },
    consumedItemId,
    mountDied,
    mercenaryDied: false,
  }
}

export interface CombatRewards {
  gold: number
  loot: Item[]
  mountDrop?: Mount
}

export function getCombatRewards(
  combatState: CombatState,
  character: FantasyCharacter,
  regionMultiplier?: number
): CombatRewards {
  const { enemy } = combatState
  const skills = resolveSkills(character)
  const goldBonus = getSkillBonus(skills, 'gold_bonus')
  const lootBonus = getSkillBonus(skills, 'loot_chance')
  const diffMods = getDifficultyModifiers(character.difficultyMode)
  const regionMult = regionMultiplier ?? 1
  const gold = Math.round(enemy.goldReward * (1 + goldBonus.percentage / 100) * diffMods.goldMultiplier * regionMult)

  const loot: Item[] = []
  if (enemy.lootTable) {
    for (const item of enemy.lootTable) {
      const baseDropChance = combatState.isBoss ? 1.0 : 0.3 + character.luck * 0.03
      const dropChance = Math.min(1, (baseDropChance + lootBonus.percentage / 100) * diffMods.lootChanceMultiplier)
      if (Math.random() < dropChance) {
        loot.push(item)
      }
    }
  }

  // Assign rarity to loot items that don't have one
  const rarityWeights = combatState.isBoss
    ? { common: 0, uncommon: 0.2, rare: 0.4, epic: 0.3, legendary: 0.1 }
    : combatState.isMiniBoss
      ? { common: 0.1, uncommon: 0.3, rare: 0.4, epic: 0.15, legendary: 0.05 }
      : { common: 0.5, uncommon: 0.3, rare: 0.15, epic: 0.04, legendary: 0.01 }

  function rollRarity(weights: Record<string, number>): string {
    const roll = Math.random()
    let cumulative = 0
    for (const [rarity, weight] of Object.entries(weights)) {
      cumulative += weight
      if (roll < cumulative) return rarity
    }
    return 'common'
  }

  for (let i = 0; i < loot.length; i++) {
    if (!loot[i].rarity) {
      loot[i] = { ...loot[i], rarity: rollRarity(rarityWeights) as Item['rarity'] }
    }
  }

  // Regular (non-boss) enemies have a chance to drop a spell scroll
  if (!combatState.isBoss) {
    const spellDropChance = 0.05 + character.level * 0.01
    if (Math.random() < spellDropChance) {
      const spell = generateSpellForLevel(character.level)
      const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
      loot.push({
        id: `spell-drop-${suffix}`,
        name: `Scroll of ${spell.name}`,
        description: `A spell scroll found on the battlefield containing the spell ${spell.name}.`,
        quantity: 1,
        type: 'spell_scroll',
        spell,
        rarity: 'rare', // Spell scrolls are always rare quality
      })
    }
  }

  // Bosses: 25% mount drop, Mini-bosses: 10%, Regular: 3%
  let mountDrop: Mount | undefined
  if (combatState.isBoss) {
    const mountDropChance = 0.25 + character.luck * 0.02
    if (Math.random() < mountDropChance) {
      mountDrop = getRandomMount(character.luck)
    }
  } else if (combatState.isMiniBoss) {
    const mountDropChance = 0.10 + character.luck * 0.01
    if (Math.random() < mountDropChance) {
      mountDrop = getRandomMount(character.luck)
    }
  } else {
    const nonBossMountChance = 0.03 + character.luck * 0.005
    if (Math.random() < nonBossMountChance) {
      mountDrop = getRandomMount(character.luck)
    }
  }

  return { gold, loot, mountDrop }
}

// Re-export for tests
export { getComboMultiplier, generateEnemyTelegraph, checkBossPhaseChange, getPlayerCritChance }

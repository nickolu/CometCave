import {
  CombatEnemy,
  CombatLogEntry,
  CombatPlayerState,
  StatusEffect,
  StatusEffectType,
} from '@/app/tap-tap-adventure/models/combat'

/**
 * Apply a status effect to a target's statusEffects array.
 * If the target already has an effect of the same type, refresh the duration
 * and use the higher value.
 */
export function applyStatusEffect(
  statusEffects: StatusEffect[],
  effect: StatusEffect
): StatusEffect[] {
  const existing = statusEffects.find(e => e.type === effect.type)
  if (existing) {
    return statusEffects.map(e =>
      e.type === effect.type
        ? { ...e, value: Math.max(e.value, effect.value), turnsRemaining: Math.max(e.turnsRemaining, effect.turnsRemaining) }
        : e
    )
  }
  return [...statusEffects, effect]
}

/**
 * Check if a target has a specific status effect.
 */
export function hasStatusEffect(
  statusEffects: StatusEffect[] | undefined,
  type: StatusEffectType
): boolean {
  return (statusEffects ?? []).some(e => e.type === type && e.turnsRemaining > 0)
}

/**
 * Get the value of a specific status effect on a target.
 * Returns 0 if the effect is not present.
 */
export function getEffectModifier(
  statusEffects: StatusEffect[] | undefined,
  type: StatusEffectType
): number {
  const effect = (statusEffects ?? []).find(e => e.type === type && e.turnsRemaining > 0)
  return effect?.value ?? 0
}

/**
 * Remove expired status effects (turnsRemaining <= 0).
 */
export function removeExpiredEffects(statusEffects: StatusEffect[]): StatusEffect[] {
  return statusEffects.filter(e => e.turnsRemaining > 0)
}

/**
 * Process all active status effects at the end of each turn.
 */
export function tickStatusEffects(
  playerState: CombatPlayerState,
  enemy: CombatEnemy,
  turnNumber: number
): { playerState: CombatPlayerState; enemy: CombatEnemy; logs: CombatLogEntry[] } {
  const logs: CombatLogEntry[] = []
  let updatedPlayer = { ...playerState }
  let updatedEnemy = { ...enemy }

  const playerEffects = [...(updatedPlayer.statusEffects ?? [])]
  for (const effect of playerEffects) {
    if (effect.turnsRemaining <= 0) continue
    switch (effect.type) {
      case 'poison': {
        updatedPlayer = { ...updatedPlayer, hp: Math.max(0, updatedPlayer.hp - effect.value) }
        logs.push({ turn: turnNumber, actor: 'enemy', action: 'status_effect', damage: effect.value, description: `You take ${effect.value} poison damage!` })
        break
      }
      case 'burn': {
        updatedPlayer = { ...updatedPlayer, hp: Math.max(0, updatedPlayer.hp - effect.value) }
        logs.push({ turn: turnNumber, actor: 'enemy', action: 'status_effect', damage: effect.value, description: `You take ${effect.value} burn damage! Your defense is reduced by 20%.` })
        break
      }
    }
  }

  const enemyEffects = [...(updatedEnemy.statusEffects ?? [])]
  for (const effect of enemyEffects) {
    if (effect.turnsRemaining <= 0) continue
    switch (effect.type) {
      case 'poison': {
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - effect.value) }
        logs.push({ turn: turnNumber, actor: 'player', action: 'status_effect', damage: effect.value, description: `${updatedEnemy.name} takes ${effect.value} poison damage!` })
        break
      }
      case 'burn': {
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - effect.value) }
        logs.push({ turn: turnNumber, actor: 'player', action: 'status_effect', damage: effect.value, description: `${updatedEnemy.name} takes ${effect.value} burn damage! Their defense is reduced by 20%.` })
        break
      }
      case 'bleed': {
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - effect.value) }
        logs.push({ turn: turnNumber, actor: 'player', action: 'status_effect', damage: effect.value, description: `${updatedEnemy.name} takes ${effect.value} bleed damage!` })
        break
      }
    }
  }

  updatedPlayer = {
    ...updatedPlayer,
    statusEffects: removeExpiredEffects(
      (updatedPlayer.statusEffects ?? []).map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
    ),
  }
  updatedEnemy = {
    ...updatedEnemy,
    statusEffects: removeExpiredEffects(
      (updatedEnemy.statusEffects ?? []).map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
    ),
  }

  return { playerState: updatedPlayer, enemy: updatedEnemy, logs }
}

export function getSlowMultiplier(statusEffects: StatusEffect[] | undefined): number {
  return hasStatusEffect(statusEffects, 'slow') ? 0.7 : 1
}

export function getBerserkAttackMultiplier(statusEffects: StatusEffect[] | undefined): number {
  return hasStatusEffect(statusEffects, 'berserk') ? 1.5 : 1
}

export function getBerserkDefenseMultiplier(statusEffects: StatusEffect[] | undefined): number {
  return hasStatusEffect(statusEffects, 'berserk') ? 0.7 : 1
}

export function getBurnDefenseMultiplier(statusEffects: StatusEffect[] | undefined): number {
  return hasStatusEffect(statusEffects, 'burn') ? 0.8 : 1
}

export function getCurseHealingMultiplier(statusEffects: StatusEffect[] | undefined): number {
  return hasStatusEffect(statusEffects, 'curse') ? 0.5 : 1
}

export function checkFearSkip(statusEffects: StatusEffect[] | undefined): boolean {
  if (!hasStatusEffect(statusEffects, 'fear')) return false
  return Math.random() < 0.5
}

export function getThornsDamage(statusEffects: StatusEffect[] | undefined): number {
  return getEffectModifier(statusEffects, 'thorns')
}

export function processReflect(
  statusEffects: StatusEffect[],
  incomingDamage: number
): { reflectedDamage: number; updatedEffects: StatusEffect[] } {
  const reflectEffect = statusEffects.find(e => e.type === 'reflect' && e.turnsRemaining > 0)
  if (!reflectEffect) return { reflectedDamage: 0, updatedEffects: statusEffects }

  const reflectedDamage = Math.min(reflectEffect.value, incomingDamage)
  const remainingReflect = reflectEffect.value - reflectedDamage

  const updatedEffects = statusEffects.map(e => {
    if (e.type === 'reflect') {
      return remainingReflect > 0
        ? { ...e, value: remainingReflect }
        : { ...e, value: 0, turnsRemaining: 0 }
    }
    return e
  })

  return { reflectedDamage, updatedEffects: removeExpiredEffects(updatedEffects) }
}

export function getFreezeMultiplier(statusEffects: StatusEffect[] | undefined): number {
  return hasStatusEffect(statusEffects, 'freeze') ? 0.5 : 1
}

export function checkStunSkip(statusEffects: StatusEffect[] | undefined): boolean {
  if (!hasStatusEffect(statusEffects, 'stun')) return false
  return true // stun always prevents action (unlike fear which is 50%)
}

export function createStatusEffectFromAbility(
  type: StatusEffectType,
  value: number,
  duration: number,
  source: 'player' | 'enemy'
): StatusEffect {
  const names: Record<StatusEffectType, string> = {
    poison: 'Poisoned',
    burn: 'Burning',
    slow: 'Slowed',
    curse: 'Cursed',
    thorns: 'Thorns',
    berserk: 'Berserk',
    fear: 'Feared',
    reflect: 'Reflecting',
    freeze: 'Frozen',
    stun: 'Stunned',
    bleed: 'Bleeding',
  }

  return {
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: names[type],
    type,
    value,
    turnsRemaining: duration,
    source,
  }
}

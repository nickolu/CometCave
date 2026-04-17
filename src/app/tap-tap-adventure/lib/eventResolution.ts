import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyDecisionOption } from '@/app/tap-tap-adventure/models/story'
import { getCampBonuses } from '@/app/tap-tap-adventure/config/baseBuildings'
import { getFactionForRegion, FACTIONS } from '@/app/tap-tap-adventure/config/factions'

export function applyEffects(
  character: FantasyCharacter,
  effects?: {
    gold?: number
    reputation?: number
    distance?: number
    statusChange?: string
    mountDamage?: number
    mountDeath?: boolean
  }
): FantasyCharacter {
  if (!effects) return character

  const campBonuses = getCampBonuses(character.campState?.buildingLevels ?? {})
  const goldGain = effects.gold ?? 0
  const adjustedGold = goldGain > 0
    ? Math.round(goldGain * (1 + campBonuses.goldEventBonusPct / 100))
    : goldGain
  const repGain = effects.reputation ?? 0
  const adjustedRep = repGain > 0
    ? Math.round(repGain * (1 + campBonuses.reputationGainBonusPct / 100))
    : repGain

  let updatedCharacter: FantasyCharacter = {
    ...character,
    gold: character.gold + adjustedGold,
    reputation: character.reputation + adjustedRep,
    distance: character.distance + (effects.distance ?? 0),
    status: effects.statusChange
      ? (effects.statusChange as FantasyCharacter['status'])
      : character.status,
  }

  // Faction reputation gain
  if (adjustedRep > 0) {
    const factionId = getFactionForRegion(character.currentRegion ?? 'green_meadows')
    if (factionId) {
      const factionReps = { ...(character.factionReputations ?? {}) }
      const gain = Math.ceil(adjustedRep * 0.5)
      factionReps[factionId] = Math.min(200, (factionReps[factionId] ?? 0) + gain)

      const rivalId = FACTIONS[factionId].rivalFactionId
      if (rivalId) {
        const rivalPenalty = Math.ceil(gain * 0.5)
        factionReps[rivalId] = Math.max(0, (factionReps[rivalId] ?? 0) - rivalPenalty)
      }

      updatedCharacter = { ...updatedCharacter, factionReputations: factionReps }
    }
  }

  // Mount damage handling
  if (updatedCharacter.activeMount && (effects.mountDeath || effects.mountDamage)) {
    if (effects.mountDeath) {
      updatedCharacter = { ...updatedCharacter, activeMount: null }
    } else if (effects.mountDamage) {
      const currentHp = updatedCharacter.activeMount.hp ?? updatedCharacter.activeMount.maxHp ?? 1
      const newHp = Math.max(0, currentHp - effects.mountDamage)
      updatedCharacter = newHp <= 0
        ? { ...updatedCharacter, activeMount: null }
        : { ...updatedCharacter, activeMount: { ...updatedCharacter.activeMount, hp: newHp } }
    }
  }

  return updatedCharacter
}

export function calculateEffectiveProbability(
  option: FantasyDecisionOption,
  character: FantasyCharacter
): number {
  const typedOption = option as {
    successProbability?: number
    relevantAttributes?: string[]
    attributeModifiers?: Record<string, number>
  }
  const base = typedOption.successProbability ?? 1

  const campBonuses = getCampBonuses(character.campState?.buildingLevels ?? {})

  if (!typedOption.relevantAttributes || typedOption.relevantAttributes.length === 0) {
    return Math.max(0, Math.min(1, base + campBonuses.combatSuccessBonus))
  }

  let modifier = 0
  for (const attr of typedOption.relevantAttributes) {
    const value = Number(character[attr as keyof typeof character] ?? 0)
    const attrMod = Number(typedOption.attributeModifiers?.[attr] ?? 0.01)
    modifier += value * attrMod
  }

  // Reputation modifier: +0.01 per 10 reputation, capped at +/-0.1
  const reputationModifier = Math.max(-0.1, Math.min(0.1, character.reputation * 0.001))
  modifier += reputationModifier

  return Math.max(0, Math.min(1, Number(base) + modifier + campBonuses.combatSuccessBonus))
}

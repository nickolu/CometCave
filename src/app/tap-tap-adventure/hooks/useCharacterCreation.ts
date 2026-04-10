'use client'
import { useMemo, useState } from 'react'

import {
  calculateStartingStats,
  ClassOption,
  RaceOption,
} from '@/app/tap-tap-adventure/config/characterOptions'
import {
  DEFAULT_ABILITY_COOLDOWN,
  DEFAULT_ABILITY_DESCRIPTION,
  DEFAULT_ABILITY_NAME,
  DEFAULT_ABILITY_POWER,
  DEFAULT_CHARACTER_NAME,
  DEFAULT_STAT_MIN,
} from '@/app/tap-tap-adventure/config/gameDefaults'
import { getStartingSpell } from '@/app/tap-tap-adventure/config/startingSpells'
import { calculateMaxMana } from '@/app/tap-tap-adventure/lib/leveling'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyAbility, FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

export function useCharacterCreation() {
  const { addCharacter } = useGameStore()
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({})
  const [selectedRace, setSelectedRace] = useState<RaceOption | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const stats = useMemo(() => {
    if (selectedRace && selectedClass) {
      return calculateStartingStats(selectedRace, selectedClass)
    }
    return {
      strength: DEFAULT_STAT_MIN,
      intelligence: DEFAULT_STAT_MIN,
      luck: DEFAULT_STAT_MIN,
    }
  }, [selectedRace, selectedClass])

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }))
  }

  const isValid = Boolean(character.name?.trim()) && selectedRace !== null && selectedClass !== null

  const completeCreation = () => {
    if (!isValid || !selectedRace || !selectedClass) return

    const charId = crypto.randomUUID()
    const abilityId = crypto.randomUUID()

    const defaultAbility: FantasyAbility = {
      id: abilityId,
      name: DEFAULT_ABILITY_NAME,
      description: DEFAULT_ABILITY_DESCRIPTION,
      power: DEFAULT_ABILITY_POWER,
      cooldown: DEFAULT_ABILITY_COOLDOWN,
    }

    const finalStats = calculateStartingStats(selectedRace, selectedClass)

    // Calculate starting mana based on class and stats
    const startingSpell = getStartingSpell(selectedClass.id)
    const spellbook = startingSpell ? [startingSpell] : []

    // Build a temp character to calculate maxMana
    const tempChar = {
      id: charId,
      playerId: '',
      name: character.name || DEFAULT_CHARACTER_NAME,
      race: selectedRace.name,
      class: selectedClass.name,
      level: 1,
      abilities: [defaultAbility],
      locationId: '',
      gold: 0,
      reputation: 0,
      distance: 0,
      status: 'active' as const,
      strength: finalStats.strength,
      intelligence: finalStats.intelligence,
      luck: finalStats.luck,
      inventory: [],
      deathCount: 0,
      pendingStatPoints: 0,
    }
    const maxMana = calculateMaxMana(tempChar)

    const updatedCharacter = {
      ...character,
      id: charId,
      name: character.name || DEFAULT_CHARACTER_NAME,
      race: selectedRace.name,
      class: selectedClass.name,
      strength: finalStats.strength,
      intelligence: finalStats.intelligence,
      luck: finalStats.luck,
      abilities: [defaultAbility],
      mana: maxMana,
      maxMana: maxMana,
      spellbook,
    }

    addCharacter(updatedCharacter)
    setIsComplete(true)
  }

  return {
    character,
    selectedRace,
    selectedClass,
    stats,
    isValid,
    updateCharacter,
    setSelectedRace,
    setSelectedClass,
    isComplete,
    completeCreation,
  }
}

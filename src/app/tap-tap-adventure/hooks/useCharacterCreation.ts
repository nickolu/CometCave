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

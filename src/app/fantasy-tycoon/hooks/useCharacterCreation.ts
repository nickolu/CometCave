'use client'
import { useState } from 'react'

import {
  DEFAULT_ABILITY_COOLDOWN,
  DEFAULT_ABILITY_DESCRIPTION,
  DEFAULT_ABILITY_NAME,
  DEFAULT_ABILITY_POWER,
  DEFAULT_CHARACTER_NAME,
} from '@/app/fantasy-tycoon/config/gameDefaults'
import { useGameStore } from '@/app/fantasy-tycoon/hooks/useGameStore'
import { FantasyAbility, FantasyCharacter } from '@/app/fantasy-tycoon/models/types'

export function useCharacterCreation() {
  const { addCharacter } = useGameStore()
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({})
  const [isComplete, setIsComplete] = useState(false)

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }))
  }

  const completeCreation = () => {
    const charId = crypto.randomUUID()
    const abilityId = crypto.randomUUID()

    const defaultAbility: FantasyAbility = {
      id: abilityId,
      name: DEFAULT_ABILITY_NAME,
      description: DEFAULT_ABILITY_DESCRIPTION,
      power: DEFAULT_ABILITY_POWER,
      cooldown: DEFAULT_ABILITY_COOLDOWN,
    }

    const updatedCharacter = {
      ...character,
      id: charId,
      name: character.name || DEFAULT_CHARACTER_NAME,
      abilities: [defaultAbility],
    }

    addCharacter(updatedCharacter)
    setIsComplete(true)
  }

  return {
    character,
    updateCharacter,
    isComplete,
    completeCreation,
  }
}

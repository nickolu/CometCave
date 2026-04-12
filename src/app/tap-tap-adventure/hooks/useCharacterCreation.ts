'use client'
import { useCallback, useMemo, useState } from 'react'

import {
  calculateStartingStats,
  ClassOption,
  RaceOption,
} from '@/app/tap-tap-adventure/config/characterOptions'
import { DIFFICULTY_MODES, DifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
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
import { Item } from '@/app/tap-tap-adventure/models/item'
import { GeneratedClass } from '@/app/tap-tap-adventure/models/generatedClass'
import { Spell } from '@/app/tap-tap-adventure/models/spell'
import { FantasyAbility, FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

export function useCharacterCreation() {
  const { addCharacter, claimHeirloom, gameState } = useGameStore()
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({})
  const [selectedRace, setSelectedRace] = useState<RaceOption | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null)
  const [selectedGeneratedClass, setSelectedGeneratedClass] = useState<GeneratedClass | null>(null)
  const [generatedClasses, setGeneratedClasses] = useState<GeneratedClass[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedHeirloom, setSelectedHeirloom] = useState<Item | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>(DIFFICULTY_MODES[0])

  const legacyHeirlooms = gameState?.legacyHeirlooms ?? []
  const hasHeirlooms = legacyHeirlooms.length > 0

  const stats = useMemo(() => {
    if (selectedRace && selectedGeneratedClass) {
      return {
        strength: selectedGeneratedClass.statDistribution.strength + (selectedRace.modifiers.strength ?? 0),
        intelligence: selectedGeneratedClass.statDistribution.intelligence + (selectedRace.modifiers.intelligence ?? 0),
        luck: selectedGeneratedClass.statDistribution.luck + (selectedRace.modifiers.luck ?? 0),
      }
    }
    if (selectedRace && selectedClass) {
      return calculateStartingStats(selectedRace, selectedClass)
    }
    return {
      strength: DEFAULT_STAT_MIN,
      intelligence: DEFAULT_STAT_MIN,
      luck: DEFAULT_STAT_MIN,
    }
  }, [selectedRace, selectedClass, selectedGeneratedClass])

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }))
  }

  const isValid = Boolean(character.name?.trim()) && selectedRace !== null && (selectedClass !== null || selectedGeneratedClass !== null)

  const fetchGeneratedClasses = useCallback(async () => {
    setIsLoadingClasses(true)
    try {
      const response = await fetch('/api/v1/tap-tap-adventure/classes/generate', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setGeneratedClasses(data.classes)
        setSelectedGeneratedClass(null)
        setSelectedClass(null)
      }
    } catch {
      // Silently fail - UI will show fallback
    } finally {
      setIsLoadingClasses(false)
    }
  }, [])

  const selectGeneratedClass = useCallback((gc: GeneratedClass) => {
    setSelectedGeneratedClass(gc)
    setSelectedClass({
      id: gc.id,
      name: gc.name,
      description: gc.description,
      modifiers: {
        strength: gc.statDistribution.strength - DEFAULT_STAT_MIN,
        intelligence: gc.statDistribution.intelligence - DEFAULT_STAT_MIN,
        luck: gc.statDistribution.luck - DEFAULT_STAT_MIN,
      },
    })
  }, [])

  const completeCreation = () => {
    if (!isValid || !selectedRace || (!selectedClass && !selectedGeneratedClass)) return

    const charId = crypto.randomUUID()
    const abilityId = crypto.randomUUID()

    const defaultAbility: FantasyAbility = {
      id: abilityId,
      name: DEFAULT_ABILITY_NAME,
      description: DEFAULT_ABILITY_DESCRIPTION,
      power: DEFAULT_ABILITY_POWER,
      cooldown: DEFAULT_ABILITY_COOLDOWN,
    }

    let finalStats: { strength: number; intelligence: number; luck: number }
    let className: string
    let spellbook: Spell[] = []
    let classData: GeneratedClass | undefined

    if (selectedGeneratedClass) {
      finalStats = {
        strength: selectedGeneratedClass.statDistribution.strength + (selectedRace.modifiers.strength ?? 0),
        intelligence: selectedGeneratedClass.statDistribution.intelligence + (selectedRace.modifiers.intelligence ?? 0),
        luck: selectedGeneratedClass.statDistribution.luck + (selectedRace.modifiers.luck ?? 0),
      }
      className = selectedGeneratedClass.name
      classData = selectedGeneratedClass

      const startingSpell: Spell = {
        id: `starting-spell-${selectedGeneratedClass.id}`,
        name: selectedGeneratedClass.startingAbility.name,
        description: selectedGeneratedClass.startingAbility.description,
        school: selectedGeneratedClass.favoredSchool,
        manaCost: selectedGeneratedClass.startingAbility.manaCost,
        cooldown: selectedGeneratedClass.startingAbility.cooldown,
        target: selectedGeneratedClass.startingAbility.target,
        effects: selectedGeneratedClass.startingAbility.effects,
        tags: selectedGeneratedClass.startingAbility.tags,
      }
      spellbook = [startingSpell]
    } else if (selectedClass) {
      finalStats = calculateStartingStats(selectedRace, selectedClass)
      className = selectedClass.name
      const startingSpell = getStartingSpell(selectedClass.id)
      spellbook = startingSpell ? [startingSpell] : []
    } else {
      return
    }

    const tempChar = {
      id: charId,
      playerId: '',
      name: character.name || DEFAULT_CHARACTER_NAME,
      race: selectedRace.name,
      class: className,
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
      classData,
      difficultyMode: selectedDifficulty.id,
      currentRegion: 'green_meadows',
    }
    const maxMana = calculateMaxMana(tempChar)

    const startingInventory: Item[] = []

    if (selectedHeirloom) {
      const claimed = claimHeirloom(selectedHeirloom.id)
      if (claimed) {
        startingInventory.push(claimed)
      }
    }

    const updatedCharacter = {
      ...character,
      id: charId,
      name: character.name || DEFAULT_CHARACTER_NAME,
      race: selectedRace.name,
      class: className,
      strength: finalStats.strength,
      intelligence: finalStats.intelligence,
      luck: finalStats.luck,
      abilities: [defaultAbility],
      mana: maxMana,
      maxMana: maxMana,
      spellbook,
      classData,
      inventory: startingInventory,
      difficultyMode: selectedDifficulty.id,
    }

    addCharacter(updatedCharacter)
    setIsComplete(true)
  }

  return {
    character,
    selectedRace,
    selectedClass,
    selectedGeneratedClass,
    generatedClasses,
    isLoadingClasses,
    stats,
    isValid,
    updateCharacter,
    setSelectedRace,
    setSelectedClass,
    selectGeneratedClass,
    fetchGeneratedClasses,
    isComplete,
    completeCreation,
    legacyHeirlooms,
    hasHeirlooms,
    selectedHeirloom,
    setSelectedHeirloom,
    selectedDifficulty,
    setSelectedDifficulty,
  }
}

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
import { calculateMaxHp } from '@/app/tap-tap-adventure/lib/leveling'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { GeneratedClass } from '@/app/tap-tap-adventure/models/generatedClass'
import { ClassSkillTree } from '@/app/tap-tap-adventure/models/classSkillTree'
import { Spell } from '@/app/tap-tap-adventure/models/spell'
import { FantasyAbility, FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

/** Map static class IDs to their combat style for skill tree generation. */
const STATIC_CLASS_COMBAT_STYLES: Record<string, string> = {
  warrior: 'martial',
  mage: 'arcane',
  rogue: 'shadow',
  ranger: 'primal',
}

export function useCharacterCreation() {
  const { addCharacter, claimHeirloom, gameState, getMetaBonuses } = useGameStore()
  const [character, setCharacter] = useState<Partial<FantasyCharacter>>({})
  const [selectedRace, setSelectedRace] = useState<RaceOption | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null)
  const [selectedGeneratedClass, setSelectedGeneratedClass] = useState<GeneratedClass | null>(null)
  const [generatedClasses, setGeneratedClasses] = useState<GeneratedClass[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedHeirloom, setSelectedHeirloom] = useState<Item | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>(DIFFICULTY_MODES[0])
  const [skillTreeData, setSkillTreeData] = useState<ClassSkillTree | null>(null)
  const [isFetchingTree, setIsFetchingTree] = useState(false)

  const legacyHeirlooms = gameState?.legacyHeirlooms ?? []
  const hasHeirlooms = legacyHeirlooms.length > 0

  const stats = useMemo(() => {
    if (selectedRace && selectedGeneratedClass) {
      return {
        strength: selectedGeneratedClass.statDistribution.strength + (selectedRace.modifiers.strength ?? 0),
        intelligence: selectedGeneratedClass.statDistribution.intelligence + (selectedRace.modifiers.intelligence ?? 0),
        luck: selectedGeneratedClass.statDistribution.luck + (selectedRace.modifiers.luck ?? 0),
        charisma: DEFAULT_STAT_MIN + (selectedRace.modifiers.charisma ?? 0),
      }
    }
    if (selectedRace && selectedClass) {
      return calculateStartingStats(selectedRace, selectedClass)
    }
    return {
      strength: DEFAULT_STAT_MIN,
      intelligence: DEFAULT_STAT_MIN,
      luck: DEFAULT_STAT_MIN,
      charisma: DEFAULT_STAT_MIN,
    }
  }, [selectedRace, selectedClass, selectedGeneratedClass])

  const updateCharacter = (fields: Partial<FantasyCharacter>) => {
    setCharacter(prev => ({ ...prev, ...fields }))
  }

  const isValid = Boolean(character.name?.trim()) && selectedRace !== null && (selectedClass !== null || selectedGeneratedClass !== null)

  const fetchSkillTree = useCallback(async (classId: string, className: string, combatStyle: string) => {
    setIsFetchingTree(true)
    try {
      const response = await fetch('/api/v1/tap-tap-adventure/skill-tree/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, className, combatStyle }),
      })
      if (response.ok) {
        const data = await response.json()
        setSkillTreeData(data.skillTree)
      }
    } catch {
      // Silently fail — character will be created without a tree
    } finally {
      setIsFetchingTree(false)
    }
  }, [])

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
        charisma: 0,
      },
    })
    setSkillTreeData(null)
    fetchSkillTree(gc.id, gc.name, gc.combatStyle)
  }, [fetchSkillTree])

  const selectStaticClass = useCallback((classOption: ClassOption) => {
    setSelectedClass(classOption)
    setSelectedGeneratedClass(null)
    setSkillTreeData(null)
    const combatStyle = STATIC_CLASS_COMBAT_STYLES[classOption.id] ?? 'martial'
    fetchSkillTree(classOption.id, classOption.name, combatStyle)
  }, [fetchSkillTree])

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

    let finalStats: { strength: number; intelligence: number; luck: number; charisma: number }
    let className: string
    let spellbook: Spell[] = []
    let classData: GeneratedClass | undefined
    let classSkillTree: ClassSkillTree | undefined = skillTreeData ?? undefined

    if (selectedGeneratedClass) {
      finalStats = {
        strength: selectedGeneratedClass.statDistribution.strength + (selectedRace.modifiers.strength ?? 0),
        intelligence: selectedGeneratedClass.statDistribution.intelligence + (selectedRace.modifiers.intelligence ?? 0),
        luck: selectedGeneratedClass.statDistribution.luck + (selectedRace.modifiers.luck ?? 0),
        charisma: DEFAULT_STAT_MIN + (selectedRace.modifiers.charisma ?? 0),
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
      charisma: finalStats.charisma,
      inventory: [],
      deathCount: 0,
      pendingStatPoints: 0,
      classData,
      difficultyMode: selectedDifficulty.id,
      currentRegion: 'green_meadows',
      currentWeather: 'clear',
      visitedRegions: ['green_meadows'],
      factionReputations: {},
      bounty: 0,
    }
    const maxMana = calculateMaxMana(tempChar)

    const startingInventory: Item[] = []

    if (selectedHeirloom) {
      const claimed = claimHeirloom(selectedHeirloom.id)
      if (claimed) {
        startingInventory.push(claimed)
      }
    }

    // Apply meta-progression bonuses from eternal upgrades
    const metaBonuses = getMetaBonuses()
    const boostedStrength = finalStats.strength + metaBonuses.bonusStrength
    const boostedIntelligence = finalStats.intelligence + metaBonuses.bonusIntelligence
    const boostedLuck = finalStats.luck + metaBonuses.bonusLuck
    const boostedCharisma = finalStats.charisma
    const boostedGold = metaBonuses.bonusGold

    // Recalculate mana/hp with boosted stats
    const boostedTempChar = {
      ...tempChar,
      strength: boostedStrength,
      intelligence: boostedIntelligence,
      luck: boostedLuck,
      charisma: boostedCharisma,
    }
    const boostedMaxMana = calculateMaxMana(boostedTempChar) + metaBonuses.bonusMana
    const boostedMaxHp = calculateMaxHp(boostedTempChar) + metaBonuses.bonusHp

    const updatedCharacter = {
      ...character,
      id: charId,
      name: character.name || DEFAULT_CHARACTER_NAME,
      race: selectedRace.name,
      class: className,
      strength: boostedStrength,
      intelligence: boostedIntelligence,
      luck: boostedLuck,
      charisma: boostedCharisma,
      abilities: [defaultAbility],
      hp: boostedMaxHp,
      maxHp: boostedMaxHp,
      mana: boostedMaxMana,
      maxMana: boostedMaxMana,
      spellbook,
      classData,
      classSkillTree,
      unlockedTreeSkillIds: [],
      inventory: startingInventory,
      gold: boostedGold,
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
    selectStaticClass,
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
    skillTreeData,
    isFetchingTree,
  }
}

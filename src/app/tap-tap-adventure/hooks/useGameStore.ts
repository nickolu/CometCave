'use client'
import { produce } from 'immer'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { checkAchievements } from '@/app/tap-tap-adventure/lib/achievementTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import { useItem as applyItemUse } from '@/app/tap-tap-adventure/lib/itemEffects'
import { applyLevelFromDistance, calculateMaxHp, calculateMaxMana } from '@/app/tap-tap-adventure/lib/leveling'
import { checkQuestProgress } from '@/app/tap-tap-adventure/lib/questGenerator'
import { getSpellConfigForCharacter } from '@/app/tap-tap-adventure/config/characterOptions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'
import { getEquipmentSlot, EquipmentSlotType } from '@/app/tap-tap-adventure/models/equipment'
import { PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import {
  FantasyDecisionPoint,
  FantasyStoryEvent,
  GameState,
  Item,
  ShopState,
} from '@/app/tap-tap-adventure/models/types'

const defaultCharacter: FantasyCharacter = {
  id: '',
  playerId: '',
  name: '',
  race: '',
  class: '',
  level: 1,
  abilities: [],
  locationId: '',
  gold: 0,
  reputation: 0,
  distance: 0,
  status: 'active',
  strength: 0,
  intelligence: 0,
  luck: 0,
  hp: 53,
  maxHp: 53,
  inventory: [],
  equipment: { weapon: null, armor: null, accessory: null },
  deathCount: 0,
  pendingStatPoints: 0,
  mana: 20,
  maxMana: 20,
  spellbook: [],
  classData: undefined,
}

export interface GameStore {
  gameState: GameState
  addCharacter: (c: Partial<FantasyCharacter>) => void
  allocateStatPoints: (strength: number, intelligence: number, luck: number) => void
  clearGameState: () => void
  deleteCharacter: (id: string) => void
  getSelectedCharacter: () => FantasyCharacter | null
  incrementDistance: () => void
  selectCharacter: (id: string) => void
  setCombatState: (combatState: CombatState | null) => void
  setShopState: (shopState: ShopState | null) => void
  setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => void
  setGameState: (gameState: GameState) => void
  setGenericMessage: (message: string) => void
  useItem: (itemId: string) => { message: string; consumed: boolean } | null
  setActiveQuest: (quest: TimedQuest | null) => void
  discardItem: (itemId: string) => void
  restoreItem: (itemId: string) => void
  equipItem: (itemId: string, slot?: EquipmentSlotType) => void
  unequipItem: (slot: EquipmentSlotType) => void
  learnSpell: (itemId: string) => { message: string; learned: boolean } | null
  updateAchievements: (achievements: PlayerAchievement[]) => void
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: defaultGameState,
      addCharacter: c => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return
            const characters = state.gameState.characters || []
            if (characters.length >= 5) return
            state.gameState.characters = [...characters, { ...defaultCharacter, ...c }]
          })
        )
      },
      allocateStatPoints: (strength: number, intelligence: number, luck: number) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const totalAllocated = strength + intelligence + luck
            const pending = selectedCharacter.pendingStatPoints ?? 0
            if (totalAllocated > pending || totalAllocated <= 0) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const updatedCharacter = {
              ...selectedCharacter,
              strength: selectedCharacter.strength + strength,
              intelligence: selectedCharacter.intelligence + intelligence,
              luck: selectedCharacter.luck + luck,
              pendingStatPoints: pending - totalAllocated,
            }
            const maxHp = calculateMaxHp(updatedCharacter)
            updatedCharacter.maxHp = maxHp
            // Also increase current HP by the same amount maxHp increased
            const oldMaxHp = selectedCharacter.maxHp ?? maxHp
            updatedCharacter.hp = Math.min(maxHp, (selectedCharacter.hp ?? oldMaxHp) + (maxHp - oldMaxHp))

            // Update maxMana and current mana similarly
            const maxMana = calculateMaxMana(updatedCharacter)
            const oldMaxMana = selectedCharacter.maxMana ?? maxMana
            updatedCharacter.maxMana = maxMana
            updatedCharacter.mana = Math.min(maxMana, (selectedCharacter.mana ?? oldMaxMana) + (maxMana - oldMaxMana))

            state.gameState.characters[characterIndex] = updatedCharacter
          })
        )
      },
      clearGameState: () => set({ gameState: defaultGameState }),
      deleteCharacter: id => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return {}
            const characters = state.gameState.characters || []
            const selectedCharacterId = state.gameState.selectedCharacterId ?? ''
            const updatedCharacters = characters.filter((char: FantasyCharacter) => char.id !== id)
            const updatedSelectedCharacterId =
              selectedCharacterId === id ? null : selectedCharacterId

            return {
              gameState: {
                ...state.gameState,
                characters: updatedCharacters,
                selectedCharacterId: updatedSelectedCharacterId,
              },
            }
          })
        )
      },
      getSelectedCharacter: () => {
        const state = get().gameState
        if (!state) return null
        return state.characters?.find(c => c.id === state.selectedCharacterId) ?? null
      },
      incrementDistance: () => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return
            const updatedCharacter = applyLevelFromDistance({
              ...selectedCharacter,
              distance: (selectedCharacter.distance || 0) + 1,
            })
            state.gameState.characters = state.gameState.characters.map(char =>
              char.id === selectedCharacter.id ? updatedCharacter : char
            )
            // Check quest progress on each step
            if (state.gameState.activeQuest?.status === 'active') {
              state.gameState.activeQuest = checkQuestProgress(
                state.gameState.activeQuest,
                updatedCharacter
              )
            }
            // Check achievements on each step
            const { achievements } = checkAchievements(
              updatedCharacter,
              state.gameState,
              state.gameState.achievements ?? []
            )
            state.gameState.achievements = achievements
          })
        )
      },
      setActiveQuest: (quest: TimedQuest | null) => {
        set(
          produce((state: GameStore) => {
            state.gameState.activeQuest = quest
          })
        )
      },
      setGameState: (state: GameState) => set({ gameState: state }),
      selectCharacter: id => {
        set(
          produce((state: GameStore) => {
            const matchingCharacter = state.gameState?.characters?.find(
              (char: FantasyCharacter) => char.id === id
            )
            if (!matchingCharacter) return {}
            return {
              gameState: {
                ...state.gameState,
                selectedCharacterId: id,
                storyEvents: [],
                decisionPoint: null,
                combatState: null,
                shopState: null,
                activeQuest: null,
                genericMessage: null,
              },
            }
          })
        )
      },
      setGenericMessage: (message: string) => {
        set(
          produce((state: GameStore) => {
            const updatedState = {
              gameState: {
                ...state.gameState,
                genericMessage: message,
              },
            }
            return updatedState
          })
        )
      },
      setCombatState: (combatState: CombatState | null) => {
        set(
          produce((state: GameStore) => {
            return {
              gameState: {
                ...state.gameState,
                combatState,
              },
            }
          })
        )
      },
      setShopState: (shopState: ShopState | null) => {
        set(
          produce((state: GameStore) => {
            return {
              gameState: {
                ...state.gameState,
                shopState,
              },
            }
          })
        )
      },
      setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => {
        set(
          produce((state: GameStore) => {
            const updatedState = {
              gameState: {
                ...state.gameState,
                decisionPoint: decisionPoint,
              },
            }
            return updatedState
          })
        )
      },
      useItem: (itemId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const item = selectedCharacter.inventory.find(i => i.id === itemId)
        if (!item) return null

        const result = applyItemUse(selectedCharacter, item)

        if (result.consumed) {
          set(
            produce((state: GameStore) => {
              const charIndex = state.gameState.characters.findIndex(
                char => char.id === selectedCharacter.id
              )
              if (charIndex === -1) return
              state.gameState.characters[charIndex] = result.character
            })
          )
        }

        return {
          message: result.message,
          consumed: result.consumed,
        }
      },
      discardItem: (itemId: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter || !selectedCharacter.inventory) return

            const itemIndex = selectedCharacter.inventory.findIndex(item => item.id === itemId)
            if (itemIndex === -1) return

            // Ensure the characters array and the specific character are found for modification
            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            // Create a new inventory array with the updated item
            const updatedInventory = selectedCharacter.inventory.map((item, index) => {
              if (index === itemIndex) {
                return { ...item, status: 'deleted' as const }
              }
              return item
            })

            // Update the character in the characters array
            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: updatedInventory,
            }
          })
        )
      },
      restoreItem: (itemId: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter || !selectedCharacter.inventory) return

            const itemIndex = selectedCharacter.inventory.findIndex(item => item.id === itemId)
            if (itemIndex === -1) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const updatedInventory = selectedCharacter.inventory.map((item, index) => {
              if (index === itemIndex) {
                // Set status to 'active'. Alternatively, could remove the status property
                // if undefined status means active by default.
                // For clarity and consistency with 'deleted', explicitly setting 'active'.
                return { ...item, status: 'active' as const }
              }
              return item
            })

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: updatedInventory,
            }
          })
        )
      },
      equipItem: (itemId: string, slot?: EquipmentSlotType) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const item = selectedCharacter.inventory.find(
              i => i.id === itemId && i.status !== 'deleted'
            )
            if (!item) return

            const targetSlot = slot ?? getEquipmentSlot(item)
            const equipment = selectedCharacter.equipment ?? { weapon: null, armor: null, accessory: null }
            const currentlyEquipped = equipment[targetSlot]

            // Build new inventory: remove the item being equipped, add back old equipped item
            let updatedInventory = selectedCharacter.inventory.filter(i => i.id !== itemId)
            if (currentlyEquipped) {
              updatedInventory = [...updatedInventory, currentlyEquipped]
            }

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: updatedInventory,
              equipment: {
                ...equipment,
                [targetSlot]: item,
              },
            }
          })
        )
      },
      unequipItem: (slot: EquipmentSlotType) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const equipment = selectedCharacter.equipment ?? { weapon: null, armor: null, accessory: null }
            const equippedItem = equipment[slot]
            if (!equippedItem) return

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: [...selectedCharacter.inventory, equippedItem],
              equipment: {
                ...equipment,
                [slot]: null,
              },
            }
          })
        )
      },
      learnSpell: (itemId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const item = selectedCharacter.inventory.find(
          i => i.id === itemId && i.status !== 'deleted' && i.type === 'spell_scroll'
        )
        if (!item) return null

        // Check if item has a spell (stored in item description or parsed)
        const spell = (item as Record<string, unknown>).spell
        if (!spell || typeof spell !== 'object') {
          return { message: 'This scroll contains no learnable spell.', learned: false }
        }

        // Check max slots
        const classConfig = getSpellConfigForCharacter(selectedCharacter.class, selectedCharacter.classData)
        const maxSlots = classConfig.maxSlots
        const currentSpells = selectedCharacter.spellbook ?? []
        if (currentSpells.length >= maxSlots) {
          return { message: `Your spellbook is full! (${maxSlots} slots max for ${selectedCharacter.class})`, learned: false }
        }

        // Check if already known
        const spellData = spell as { id: string; name: string }
        if (currentSpells.some(s => s.id === spellData.id)) {
          return { message: `You already know ${spellData.name}.`, learned: false }
        }

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return

            const updatedSpellbook = [...currentSpells, spell as FantasyCharacter['spellbook'] extends (infer U)[] | undefined ? U : never]
            // Remove the scroll from inventory
            const updatedInventory = selectedCharacter.inventory.map(i => {
              if (i.id !== itemId) return i
              const newQty = i.quantity - 1
              if (newQty <= 0) return { ...i, quantity: 0, status: 'deleted' as const }
              return { ...i, quantity: newQty }
            }).filter(i => i.quantity > 0 || i.status === 'deleted')

            state.gameState.characters[charIndex] = {
              ...selectedCharacter,
              spellbook: updatedSpellbook,
              inventory: updatedInventory,
            }
          })
        )

        return { message: `Learned ${spellData.name}!`, learned: true }
      },
      updateAchievements: (achievements: PlayerAchievement[]) => {
        set(
          produce((state: GameStore) => {
            state.gameState.achievements = achievements
          })
        )
      },
    }),
    {
      name: 'fantasy-tycoon-storage', // localStorage key (kept for backward compat)
      version: 9,
      migrate: (persistedState: unknown) => {
        const state = persistedState as GameStore
        if (state?.gameState && !('combatState' in state.gameState)) {
          (state.gameState as GameState).combatState = null
        }
        if (state?.gameState && !('shopState' in state.gameState)) {
          (state.gameState as GameState).shopState = null
        }
        if (state?.gameState?.characters) {
          for (const char of state.gameState.characters) {
            if (!char.equipment) {
              (char as FantasyCharacter).equipment = { weapon: null, armor: null, accessory: null }
            }
            if (char.deathCount === undefined) {
              (char as FantasyCharacter).deathCount = 0
            }
            // v5: Add persistent HP
            if (char.hp === undefined || char.maxHp === undefined) {
              const maxHp = 50 + (char.strength ?? 5) * 5 + (char.level ?? 1) * 10
              ;(char as FantasyCharacter).hp = maxHp
              ;(char as FantasyCharacter).maxHp = maxHp
            }
            // v6: Add pending stat points
            if (char.pendingStatPoints === undefined) {
              ;(char as FantasyCharacter).pendingStatPoints = 0
            }
            // v7: Add mana and spellbook
            if (char.mana === undefined || char.maxMana === undefined) {
              const maxMana = calculateMaxMana(char as FantasyCharacter)
              ;(char as FantasyCharacter).mana = maxMana
              ;(char as FantasyCharacter).maxMana = maxMana
            }
            if (!char.spellbook) {
              ;(char as FantasyCharacter).spellbook = []
            }
            // v8: Add classData
            if ((char as FantasyCharacter).classData === undefined) {
              ;(char as FantasyCharacter).classData = undefined
            }
          }
        }
        // v6: Add activeQuest
        if (state?.gameState && !('activeQuest' in state.gameState)) {
          (state.gameState as GameState).activeQuest = null
        }
        // v9: Add achievements
        if (state?.gameState && !('achievements' in state.gameState)) {
          (state.gameState as GameState).achievements = []
        }
        return state
      },
    }
  )
)

// Helper to get state with fallback to default
export function useEffectiveGameState(): GameState {
  const state = useGameStore(s => s.gameState)
  return state || defaultGameState
}

export function useGameStateBuilder() {
  const { gameState, setGameState: saveGameState } = useGameStore()

  const gameStateClone = structuredClone(gameState)

  const commit = () => {
    saveGameState(gameStateClone)
  }

  const addItem = (item: Item) => {
    const selectedCharacterId = gameStateClone.selectedCharacterId
    if (!selectedCharacterId) return
    const selectedCharacter = gameStateClone.characters?.find(c => c.id === selectedCharacterId)
    if (!selectedCharacter) return
    selectedCharacter.inventory.push(item)
  }

  const addStoryEvent = (event: FantasyStoryEvent) => {
    gameStateClone.storyEvents.push(event)
  }

  const setCombatState = (combatState: CombatState | null) => {
    gameStateClone.combatState = combatState
  }

  const setShopState = (shopState: ShopState | null) => {
    gameStateClone.shopState = shopState
  }

  const setActiveQuest = (quest: TimedQuest | null) => {
    gameStateClone.activeQuest = quest
  }

  const setDecisionPoint = (decisionPoint: FantasyDecisionPoint | null) => {
    gameStateClone.decisionPoint = decisionPoint
  }

  const setGenericMessage = (message: string | null) => {
    gameStateClone.genericMessage = message
  }

  const updateSelectedCharacter = (characterUpdate: Partial<FantasyCharacter>) => {
    const selectedCharacterId = gameStateClone.selectedCharacterId
    if (!selectedCharacterId || !gameStateClone.characters) return

    const charIndex = gameStateClone.characters.findIndex(c => c.id === selectedCharacterId)
    if (charIndex === -1) return

    // Create a new character object and recalculate level from distance
    const merged = {
      ...gameStateClone.characters[charIndex],
      ...characterUpdate,
    }
    gameStateClone.characters[charIndex] = applyLevelFromDistance(merged)
  }

  return {
    gameState: gameStateClone,
    commit,
    addItem,
    addStoryEvent,
    setCombatState,
    setShopState,
    setActiveQuest,
    setDecisionPoint,
    setGenericMessage,
    updateSelectedCharacter,
  }
}

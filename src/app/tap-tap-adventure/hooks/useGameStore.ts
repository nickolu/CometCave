'use client'
import { produce } from 'immer'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import { useItem as applyItemUse } from '@/app/tap-tap-adventure/lib/itemEffects'
import { applyLevelFromDistance } from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'
import {
  FantasyDecisionPoint,
  FantasyStoryEvent,
  GameState,
  Item,
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
  inventory: [],
}

export interface GameStore {
  gameState: GameState
  addCharacter: (c: Partial<FantasyCharacter>) => void
  clearGameState: () => void
  deleteCharacter: (id: string) => void
  getSelectedCharacter: () => FantasyCharacter | null
  incrementDistance: () => void
  selectCharacter: (id: string) => void
  setCombatState: (combatState: CombatState | null) => void
  setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => void
  setGameState: (gameState: GameState) => void
  setGenericMessage: (message: string) => void
  useItem: (itemId: string) => { message: string; consumed: boolean } | null
  discardItem: (itemId: string) => void
  restoreItem: (itemId: string) => void
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
            const updatedState = {
              gameState: {
                ...state.gameState,
                selectedCharacterId: id,
              },
            }
            return updatedState
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
    }),
    {
      name: 'fantasy-tycoon-storage', // localStorage key (kept for backward compat)
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = persistedState as GameStore
        if (state?.gameState && !('combatState' in state.gameState)) {
          (state.gameState as GameState).combatState = null
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
    setDecisionPoint,
    setGenericMessage,
    updateSelectedCharacter,
  }
}

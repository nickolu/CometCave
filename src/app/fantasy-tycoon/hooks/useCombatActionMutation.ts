'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inferItemTypeAndEffects } from '@/app/fantasy-tycoon/lib/itemPostProcessor'
import { CombatAction, CombatState } from '@/app/fantasy-tycoon/models/combat'
import { FantasyCharacter, Item } from '@/app/fantasy-tycoon/models/types'

import { useGameStateBuilder, useGameStore } from './useGameStore'

interface CombatActionResponse {
  combatState: CombatState
  rewards?: {
    xp: number
    gold: number
    loot: Item[]
    leveledUp?: boolean
    newLevel?: number
  }
  updatedCharacter: FantasyCharacter
  consumedItemId?: string
}

export function useCombatActionMutation() {
  const queryClient = useQueryClient()
  const { getSelectedCharacter } = useGameStore()
  const {
    addItem,
    addStoryEvent,
    commit,
    setCombatState,
    updateSelectedCharacter,
  } = useGameStateBuilder()

  return useMutation({
    mutationFn: async ({
      action,
      itemId,
    }: {
      action: CombatAction
      itemId?: string
    }) => {
      const character = getSelectedCharacter()
      if (!character) throw new Error('No character found')

      const { gameState } = useGameStore.getState()
      const combatState = gameState.combatState
      if (!combatState) throw new Error('No active combat')

      const res = await fetch('/api/v1/fantasy-tycoon/combat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combatState,
          action: { action, itemId },
          character,
        }),
      })

      if (!res.ok) throw new Error('Failed to process combat action')

      const data: CombatActionResponse = await res.json()

      // Update character with server state
      if (data.updatedCharacter) {
        updateSelectedCharacter(data.updatedCharacter)
      }

      // Handle consumed item - decrement from inventory
      if (data.consumedItemId) {
        const updatedInventory = character.inventory
          .map(i => {
            if (i.id !== data.consumedItemId) return i
            const newQty = i.quantity - 1
            if (newQty <= 0) return { ...i, quantity: 0, status: 'deleted' as const }
            return { ...i, quantity: newQty }
          })
          .filter(i => i.quantity > 0 || i.status === 'deleted')
        updateSelectedCharacter({ inventory: updatedInventory })
      }

      if (data.combatState.status === 'active') {
        // Combat continues
        setCombatState(data.combatState)
      } else {
        // Combat ended
        const enemy = combatState.enemy

        if (data.combatState.status === 'victory' && data.rewards) {
          // Add loot items
          for (const lootItem of data.rewards.loot) {
            addItem(inferItemTypeAndEffects(lootItem))
          }

          const levelMsg = data.rewards.leveledUp
            ? ` Level up! You are now level ${data.rewards.newLevel}!`
            : ''

          addStoryEvent({
            id: `combat-victory-${Date.now()}`,
            type: 'combat_victory',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You defeated ${enemy.name}! +${data.rewards.xp} XP, +${data.rewards.gold} Gold.${levelMsg}`,
            resourceDelta: {
              gold: data.rewards.gold,
            },
          })
        } else if (data.combatState.status === 'defeat') {
          addStoryEvent({
            id: `combat-defeat-${Date.now()}`,
            type: 'combat_defeat',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You were defeated by ${enemy.name}. You lost some gold fleeing the battle.`,
            resourceDelta: { gold: data.rewards?.gold },
          })
        } else if (data.combatState.status === 'fled') {
          addStoryEvent({
            id: `combat-fled-${Date.now()}`,
            type: 'combat_fled',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You fled from ${enemy.name}, losing some gold in your haste.`,
            resourceDelta: { gold: data.rewards?.gold },
          })
        }

        setCombatState(null)
      }

      commit()
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] })
    },
  })
}

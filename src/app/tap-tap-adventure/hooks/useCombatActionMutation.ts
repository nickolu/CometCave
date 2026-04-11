'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { DeathPenalty } from '@/app/tap-tap-adventure/lib/deathPenalty'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { checkQuestProgress } from '@/app/tap-tap-adventure/lib/questGenerator'
import { CombatAction, CombatState } from '@/app/tap-tap-adventure/models/combat'
import { FantasyCharacter, Item } from '@/app/tap-tap-adventure/models/types'

import { useGameStateBuilder, useGameStore } from './useGameStore'

interface CombatActionResponse {
  combatState: CombatState
  rewards?: {
    gold: number
    loot: Item[]
  }
  updatedCharacter: FantasyCharacter
  consumedItemId?: string
  deathPenalty?: DeathPenalty
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
      spellId,
    }: {
      action: CombatAction
      itemId?: string
      spellId?: string
    }) => {
      const character = getSelectedCharacter()
      if (!character) throw new Error('No character found')

      const { gameState } = useGameStore.getState()
      const combatState = gameState.combatState
      if (!combatState) throw new Error('No active combat')

      const res = await fetch('/api/v1/tap-tap-adventure/combat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combatState,
          action: { action, itemId, spellId },
          character,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.details || 'Failed to process combat action')
      }

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

      // Persist HP and mana back to character after every combat turn
      updateSelectedCharacter({
        hp: data.combatState.playerState.hp,
        maxHp: data.combatState.playerState.maxHp,
        mana: data.combatState.playerState.mana,
        maxMana: data.combatState.playerState.maxMana,
      })

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

          addStoryEvent({
            id: `combat-victory-${Date.now()}`,
            type: 'combat_victory',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You defeated ${enemy.name}! +${data.rewards.gold} Gold.`,
            resourceDelta: {
              gold: data.rewards.gold,
            },
          })
        } else if (data.combatState.status === 'defeat') {
          const penalty = data.deathPenalty
          const penaltyParts: string[] = []
          if (penalty) {
            if (penalty.goldLost > 0) penaltyParts.push(`${penalty.goldLost} gold`)
            if (penalty.itemsLost > 0)
              penaltyParts.push(
                `${penalty.itemsLost} item${penalty.itemsLost !== 1 ? 's' : ''} from your inventory`
              )
            penaltyParts.push('some of your reputation')
          }
          const lossDescription =
            penaltyParts.length > 0 ? ` You lost ${penaltyParts.join(', ')}.` : ''

          addStoryEvent({
            id: `combat-defeat-${Date.now()}`,
            type: 'combat_defeat',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You were defeated by ${enemy.name}.${lossDescription} (Death #${penalty?.newDeathCount ?? '?'})`,
            resourceDelta: {
              gold: data.rewards?.gold,
              reputation: penalty ? -penalty.reputationLost : undefined,
            },
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

        // Check quest progress after combat ends
        const { gameState: gs } = useGameStore.getState()
        if (gs.activeQuest?.status === 'active') {
          const combatWon = data.combatState.status === 'victory'
          const updatedQuest = checkQuestProgress(gs.activeQuest, data.updatedCharacter, combatWon)
          useGameStore.getState().setActiveQuest(updatedQuest)
        }
      }

      commit()
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tap-tap-adventure', 'game-state'] })
    },
  })
}

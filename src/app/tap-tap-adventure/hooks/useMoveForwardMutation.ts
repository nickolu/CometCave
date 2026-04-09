'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import {
  FantasyCharacter,
  FantasyDecisionPoint,
  FantasyStoryEvent,
  Item,
} from '@/app/tap-tap-adventure/models/types'

import { useGameStateBuilder, useGameStore } from './useGameStore'

export interface MoveForwardResponse {
  character: FantasyCharacter
  event?: FantasyStoryEvent | null
  decisionPoint?: FantasyDecisionPoint | null
  combatEncounter?: { enemy: unknown; scenario: string } | null
  genericMessage?: string | null
}

export function useMoveForwardMutation() {
  const queryClient = useQueryClient()
  const { getSelectedCharacter } = useGameStore()
  const { addItem, commit, setDecisionPoint, setGenericMessage, setCombatState } = useGameStateBuilder()

  return useMutation({
    mutationFn: async () => {
      const currentCharacter = getSelectedCharacter()
      if (!currentCharacter) throw new Error('No character found')

      const { gameState } = useGameStore.getState()
      const res = await fetch('/api/v1/tap-tap-adventure/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: currentCharacter,
          storyEvents: gameState.storyEvents,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to move forward')
      }

      const data: MoveForwardResponse = await res.json()

      const rewardItems: Item[] = data.event?.resourceDelta?.rewardItems ?? []
      for (const reward of rewardItems) {
        const item: Item = inferItemTypeAndEffects({
          id: reward.id,
          name: reward.name ?? '',
          description: reward.description ?? '',
          quantity: reward.quantity,
        })
        addItem(item)
      }

      if (data.combatEncounter) {
        // Start combat - fetch combat state from server
        const combatRes = await fetch('/api/v1/tap-tap-adventure/combat/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: currentCharacter,
            storyEvents: gameState.storyEvents,
          }),
        })
        if (combatRes.ok) {
          const combatData = await combatRes.json()
          setGenericMessage(null)
          setDecisionPoint(null)
          setCombatState(combatData.combatState)
        }
      } else if (data.decisionPoint) {
        setGenericMessage(null)
        setDecisionPoint(data.decisionPoint)
      }
      commit()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tap-tap-adventure', 'game-state'] })
    },
  })
}

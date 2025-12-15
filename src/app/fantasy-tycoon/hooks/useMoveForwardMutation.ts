'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  FantasyCharacter,
  FantasyDecisionPoint,
  FantasyStoryEvent,
  Item,
} from '@/app/fantasy-tycoon/models/types'

import { useGameStateBuilder, useGameStore } from './useGameStore'

export interface MoveForwardResponse {
  character: FantasyCharacter
  event?: FantasyStoryEvent | null
  decisionPoint?: FantasyDecisionPoint | null
  genericMessage?: string | null
}

export function useMoveForwardMutation() {
  const queryClient = useQueryClient()
  const { getSelectedCharacter } = useGameStore()
  const { addItem, commit, setDecisionPoint, setGenericMessage } = useGameStateBuilder()

  return useMutation({
    mutationFn: async () => {
      const currentCharacter = getSelectedCharacter()
      if (!currentCharacter) throw new Error('No character found')

      const res = await fetch('/api/v1/fantasy-tycoon/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: currentCharacter }),
      })

      if (!res.ok) {
        throw new Error('Failed to move forward')
      }

      const data: MoveForwardResponse = await res.json()

      const rewardItems: Item[] = data.event?.resourceDelta?.rewardItems ?? []
      for (const reward of rewardItems) {
        const item: Item = {
          id: reward.id,
          name: reward.name ?? '',
          description: reward.description ?? '',
          quantity: reward.quantity,
        }
        addItem(item)
      }
      if (data.decisionPoint) {
        setGenericMessage(null)
        setDecisionPoint(data.decisionPoint)
      }
      commit()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fantasy-tycoon', 'game-state'] })
    },
  })
}

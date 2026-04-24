'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { generateTimedQuest, checkQuestProgress } from '@/app/tap-tap-adventure/lib/questGenerator'
import {
  FantasyCharacter,
  FantasyDecisionPoint,
  FantasyStoryEvent,
  Item,
} from '@/app/tap-tap-adventure/models/types'

import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

import { useGameStateBuilder, useGameStore } from './useGameStore'

export interface MoveForwardResponse {
  character: FantasyCharacter
  event?: FantasyStoryEvent | null
  decisionPoint?: FantasyDecisionPoint | null
  shopEvent?: boolean | null
  genericMessage?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socialEncounter?: { npc: any; scenario: string } | null
}

export function useMoveForwardMutation() {
  const queryClient = useQueryClient()
  const { getSelectedCharacter } = useGameStore()
  const {
    addItem,
    commit,
    setDecisionPoint,
    setGenericMessage,
    setShopState,
    setActiveQuest,
    updateSelectedCharacter,
  } = useGameStateBuilder()

  return useMutation({
    mutationFn: async () => {
      const currentCharacter = getSelectedCharacter()
      if (!currentCharacter) throw new Error('No character found')
      const prevGold = currentCharacter.gold
      const prevReputation = currentCharacter.reputation

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

      // Update character with server response (includes incremented distance)
      if (data.character) {
        updateSelectedCharacter(data.character)
      }

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

      if (data.socialEncounter) {
        useGameStore.getState().setGameState({
          ...useGameStore.getState().gameState,
          socialEncounter: data.socialEncounter,
        })
      }

      if (data.shopEvent) {
        soundEngine.playGold()
        // Step milestone triggered a shop - fetch shop items from server
        const shopRes = await fetch('/api/v1/tap-tap-adventure/shop/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: currentCharacter }),
        })
        if (shopRes.ok) {
          const shopData = await shopRes.json()
          setGenericMessage(null)
          setDecisionPoint(null)
          setShopState({ items: shopData.shopItems, isOpen: true, shopMount: shopData.shopMount ?? null })
        }
      } else if (data.decisionPoint) {
        if (data.decisionPoint.isLegendary) {
          soundEngine.playBoss()  // Use boss sound for legendary — it's the most dramatic available
        } else {
          soundEngine.playEvent()
        }
        setGenericMessage(null)
        setDecisionPoint(data.decisionPoint)
      }

      // Check quest progress
      const { gameState: currentState } = useGameStore.getState()
      if (currentState.activeQuest?.status === 'active') {
        const updatedQuest = checkQuestProgress(currentState.activeQuest, data.character)
        setActiveQuest(updatedQuest)
      }

      // Offer a new quest if none active (5% chance after 50 steps)
      if (!currentState.activeQuest && data.character.distance > 50 && Math.random() < 0.05) {
        const quest = generateTimedQuest(data.character)
        setActiveQuest(quest)
      }

      commit()

      // Track daily challenge progress for gold and reputation gains
      const goldDelta = (data.character.gold ?? 0) - prevGold
      const repDelta = (data.character.reputation ?? 0) - prevReputation
      if (goldDelta > 0) {
        useGameStore.getState().updateDailyChallengeProgress('earn_gold', goldDelta)
      }
      if (repDelta > 0) {
        useGameStore.getState().updateDailyChallengeProgress('gain_reputation', repDelta)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tap-tap-adventure', 'game-state'] })
    },
  })
}

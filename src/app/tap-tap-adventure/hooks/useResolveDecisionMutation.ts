'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getRandomMount } from '@/app/tap-tap-adventure/config/mounts'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { FantasyCharacter, FantasyDecisionPoint, Item } from '@/app/tap-tap-adventure/models/types'

import { useGameStateBuilder, useGameStore } from './useGameStore'

export interface ResolveDecisionResponse {
  updatedCharacter: FantasyCharacter
  resultDescription?: string
  appliedEffects?: Record<string, unknown>
  selectedOptionId?: string
  selectedOptionText?: string
  outcomeDescription?: string
  resourceDelta?: {
    gold?: number
    reputation?: number
    distance?: number
    statusChange?: string
  }
  rewardItems?: Item[]
  triggersCombat?: boolean
}

export function useResolveDecisionMutation() {
  const { getSelectedCharacter } = useGameStore()
  const { addItem, addStoryEvent, commit, setCombatState, updateSelectedCharacter } = useGameStateBuilder()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      decisionPoint,
      optionId,
      onSuccess,
    }: {
      decisionPoint: FantasyDecisionPoint
      optionId: string
      onSuccess?: () => void
    }) => {
      const character = getSelectedCharacter()
      if (!character) throw new Error('No character found')

      // Handle crossroads region travel decisions client-side
      if (optionId.startsWith('travel-')) {
        const regionId = optionId.replace('travel-', '')
        updateSelectedCharacter({ currentRegion: regionId })
        const chosenOption = decisionPoint.options.find(o => o.id === optionId)
        addStoryEvent({
          id: `result-${Date.now()}`,
          type: 'region_travel',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: new Date().toISOString(),
          selectedOptionId: optionId,
          selectedOptionText: chosenOption?.text ?? '',
          outcomeDescription: chosenOption?.successDescription ?? `You travel to a new region.`,
        })
        commit()
        onSuccess?.()
        return
      }
      if (optionId === 'stay') {
        const chosenOption = decisionPoint.options.find(o => o.id === optionId)
        addStoryEvent({
          id: `result-${Date.now()}`,
          type: 'region_stay',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: new Date().toISOString(),
          selectedOptionId: optionId,
          selectedOptionText: chosenOption?.text ?? '',
          outcomeDescription: chosenOption?.successDescription ?? 'You continue on your way.',
        })
        commit()
        onSuccess?.()
        return
      }

      const res = await fetch('/api/v1/tap-tap-adventure/resolve-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          decisionPoint,
          optionId,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to resolve decision')
      }
      const data: ResolveDecisionResponse = await res.json()

      if (data.updatedCharacter) {
        updateSelectedCharacter(data.updatedCharacter)
      }

      const rewardItems = data.rewardItems ?? []

      for (const reward of rewardItems) {
        const item = inferItemTypeAndEffects({
          id: reward.id,
          name: reward.name,
          description: reward.description,
          quantity: 1,
        })
        addItem(item)
      }

      const newStoryEvent = {
        decisionPoint,
        id: `result-${Date.now()}`,
        type: data.triggersCombat ? 'combat_start' : 'decision_result',
        characterId: data.updatedCharacter.id,
        locationId: data.updatedCharacter.locationId,
        timestamp: new Date().toISOString(),
        selectedOptionId: data.selectedOptionId,
        selectedOptionText: data.selectedOptionText,
        outcomeDescription: data.triggersCombat
          ? `You chose to fight: ${data.selectedOptionText}`
          : (data.outcomeDescription ?? ''),
        resourceDelta: data.resourceDelta,
      }

      addStoryEvent(newStoryEvent)

      // Check if this event grants a mount (mount discovery events)
      const isMountEvent = optionId.includes('tame-horse') || optionId.includes('claim-mount')
      if (isMountEvent && data.outcomeDescription && !data.outcomeDescription.includes('bolts') && !data.outcomeDescription.includes("won't let you")) {
        const currentChar = getSelectedCharacter()
        const mount = getRandomMount(currentChar?.luck ?? 0)
        updateSelectedCharacter({ activeMount: mount })
      }

      // If the chosen option triggers combat, start a combat encounter
      // Pass the event description so the enemy matches the narrative
      if (data.triggersCombat) {
        const { gameState } = useGameStore.getState()
        const chosenOption = decisionPoint.options.find(o => o.id === optionId)
        const isBoss = (chosenOption as Record<string, unknown>)?.isBoss === true
        const combatRes = await fetch('/api/v1/tap-tap-adventure/combat/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: data.updatedCharacter,
            storyEvents: gameState.storyEvents,
            eventContext: decisionPoint.prompt,
            isBoss,
          }),
        })
        if (combatRes.ok) {
          const combatData = await combatRes.json()
          setCombatState(combatData.combatState)
        }
      }

      commit()
      onSuccess?.()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tap-tap-adventure', 'game-state'] })
    },
  })
}

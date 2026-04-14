'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getRandomMount } from '@/app/tap-tap-adventure/config/mounts'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { FantasyCharacter, FantasyDecisionPoint, Item } from '@/app/tap-tap-adventure/models/types'

import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

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
        const visitedRegions = character.visitedRegions ?? ['green_meadows']
        const isUnvisited = !visitedRegions.includes(regionId)

        // Boss-gated travel: unvisited regions require defeating a boss guardian
        if (isUnvisited) {
          soundEngine.playBoss()
          const destRegion = getRegion(regionId)
          const { gameState: gs } = useGameStore.getState()
          const bossContext = `A powerful guardian of ${destRegion.name} blocks the path. This ${destRegion.element !== 'none' ? destRegion.element + '-aligned ' : ''}boss protects the entrance to ${destRegion.name} (${destRegion.theme}). Enemy types in this region: ${destRegion.enemyTypes.join(', ')}. The boss should be a powerful version of these creatures.`
          const combatRes = await fetch('/api/v1/tap-tap-adventure/combat/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              character,
              storyEvents: gs.storyEvents,
              eventContext: bossContext,
              isBoss: true,
              pendingRegionId: regionId,
            }),
          })
          if (combatRes.ok) {
            const combatData = await combatRes.json()
            setCombatState(combatData.combatState)
          }
          addStoryEvent({
            id: `result-${Date.now()}`,
            type: 'boss_guardian',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            selectedOptionId: optionId,
            selectedOptionText: `Challenge the guardian of ${destRegion.name}`,
            outcomeDescription: `A fearsome guardian blocks the path to ${destRegion.name}! You must defeat it to enter.`,
          })
          commit()
          onSuccess?.()
          return
        }

        soundEngine.playCrossroads()
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
      const isMountEvent = optionId.includes('tame-') || optionId.includes('claim-mount')
      if (isMountEvent && data.outcomeDescription && !data.outcomeDescription.includes('bolts') && !data.outcomeDescription.includes("won't let you")) {
        const currentChar = getSelectedCharacter()
        const oldMount = currentChar?.activeMount
        const mount = getRandomMount(currentChar?.luck ?? 0)
        updateSelectedCharacter({ activeMount: mount })
        soundEngine.playMountAcquired()
        // Update the story event to note the mount gained (and any replacement)
        const replacedText = oldMount ? ` (Replaced ${oldMount.name})` : ''
        newStoryEvent.outcomeDescription = `${data.outcomeDescription} You gained a ${mount.name}! ${mount.icon}${replacedText}`
      }

      // If the chosen option triggers combat, start a combat encounter
      // Pass the event description so the enemy matches the narrative
      if (data.triggersCombat) {
        soundEngine.playBoss()
        const { gameState } = useGameStore.getState()
        const chosenOption = decisionPoint.options.find(o => o.id === optionId)
        const isBoss = (chosenOption as Record<string, unknown>)?.isBoss === true
        // Mini-boss: 5% chance on non-boss combat when distance > 100
        const isMiniBoss = !isBoss && (data.updatedCharacter.distance ?? 0) > 100 && Math.random() < 0.05
        const combatRes = await fetch('/api/v1/tap-tap-adventure/combat/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: data.updatedCharacter,
            storyEvents: gameState.storyEvents,
            eventContext: decisionPoint.prompt,
            isBoss,
            isMiniBoss,
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

'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getRandomMount } from '@/app/tap-tap-adventure/config/mounts'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { rollWeather } from '@/app/tap-tap-adventure/config/weather'
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
  mountDamage?: number
  mountDied?: boolean
  decisionPoint?: FantasyDecisionPoint | null
}

export function useResolveDecisionMutation() {
  const { getSelectedCharacter } = useGameStore()
  const { addItem, addStoryEvent, commit, setCombatState, setDecisionPoint, updateSelectedCharacter } = useGameStateBuilder()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      decisionPoint,
      optionId,
      onSuccess,
      onResourceDelta,
    }: {
      decisionPoint: FantasyDecisionPoint
      optionId: string
      onSuccess?: () => void
      onResourceDelta?: (delta: ResolveDecisionResponse['resourceDelta']) => void
    }) => {
      const character = getSelectedCharacter()
      if (!character) throw new Error('No character found')

      // Handle leaving a landmark during exploration
      if (optionId === 'leave-landmark') {
        const landmarkState = character.landmarkState
        if (landmarkState) {
          const landmarkName = landmarkState.exploringLandmarkName ?? 'the landmark'
          // Mark the current landmark as explored
          const exploredIndex = landmarkState.activeTargetIndex ?? 0
          const updatedLandmarks = landmarkState.landmarks.map((lm, i) =>
            i === exploredIndex ? { ...lm, explored: true } : lm
          )
          updateSelectedCharacter({
            landmarkState: {
              ...landmarkState,
              landmarks: updatedLandmarks,
              exploring: false,
              explorationDepth: 0,
              exploringLandmarkName: undefined,
            },
          })
          const chosenOption = decisionPoint.options.find(o => o.id === optionId)
          addStoryEvent({
            id: `result-${Date.now()}`,
            type: 'decision_result',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            selectedOptionId: optionId,
            selectedOptionText: chosenOption?.text ?? 'Leave',
            outcomeDescription: `You leave ${landmarkName} and continue your journey.`,
          })
          commit()
          onSuccess?.()
        }
        return
      }

      // Handle landmark bypass client-side — just increment the index and continue
      if (optionId === 'bypass-landmark' || optionId.startsWith('bypass-toward-')) {
        const landmarkState = character.landmarkState
        if (landmarkState) {
          // Use activeTargetIndex (not nextLandmarkIndex) to identify the bypassed landmark
          const bypassedLandmark = landmarkState.landmarks[landmarkState.activeTargetIndex ?? 0]
          const landmarkName = bypassedLandmark?.name ?? 'the landmark'

          // Determine target based on which direction was chosen
          let newActiveTargetIndex: number
          if (optionId.startsWith('bypass-toward-')) {
            const targetPart = optionId.replace('bypass-toward-', '')
            if (targetPart === 'exit') {
              newActiveTargetIndex = landmarkState.landmarks.length
            } else {
              newActiveTargetIndex = parseInt(targetPart, 10)
            }
          } else {
            // Original bypass-landmark behavior: go to next target
            newActiveTargetIndex = Math.min(
              (landmarkState.activeTargetIndex ?? 0) + 1,
              landmarkState.landmarks.length
            )
          }

          updateSelectedCharacter({
            landmarkState: {
              ...landmarkState,
              nextLandmarkIndex: newActiveTargetIndex, // keep in sync with activeTargetIndex
              activeTargetIndex: newActiveTargetIndex,
              exploring: false,
            },
          })
          const chosenOption = decisionPoint.options.find(o => o.id === optionId)
          addStoryEvent({
            id: `result-${Date.now()}`,
            type: 'decision_result',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            selectedOptionId: optionId,
            selectedOptionText: chosenOption?.text ?? 'Pass by without stopping',
            outcomeDescription: `You pass by ${landmarkName} and continue your journey.`,
          })
          commit()
          onSuccess?.()
        }
        return
      }

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
            if (combatData.updatedCharacter) {
              updateSelectedCharacter(combatData.updatedCharacter)
            }
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
        // Clear landmarkState so next step in new region initializes fresh landmarks
        updateSelectedCharacter({ currentRegion: regionId, currentWeather: rollWeather(regionId), landmarkState: undefined })
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
        // Clear landmarkState so the region re-initializes with fresh landmarks on the next step.
        // Add current region to visitedRegions to vary the landmark seed.
        const currentRegion = character.currentRegion ?? 'green_meadows'
        const updatedVisitedRegions = [...(character.visitedRegions ?? []), currentRegion]
        updateSelectedCharacter({
          landmarkState: undefined,
          visitedRegions: updatedVisitedRegions,
        })
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

      const { gameState: gs } = useGameStore.getState()
      const res = await fetch('/api/v1/tap-tap-adventure/resolve-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          decisionPoint,
          optionId,
          storyEvents: gs.storyEvents,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to resolve decision')
      }
      const data: ResolveDecisionResponse = await res.json()

      // Capture mount name before updating character (activeMount may be null after update)
      const previousMountName = getSelectedCharacter()?.activeMount?.name

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

      // Append mount damage/death messages to outcome description
      if (data.mountDied) {
        const mountName = previousMountName ?? 'Your mount'
        newStoryEvent.outcomeDescription = `${newStoryEvent.outcomeDescription} ${mountName} has fallen!`
      } else if (data.mountDamage && data.mountDamage > 0) {
        const mountName = previousMountName ?? 'Your mount'
        newStoryEvent.outcomeDescription = `${newStoryEvent.outcomeDescription} ${mountName} took ${data.mountDamage} damage!`
      }

      addStoryEvent(newStoryEvent)

      // If server returned a new decision point (e.g. from explore-landmark), set it
      if (data.decisionPoint) {
        soundEngine.playEvent()
        setDecisionPoint(data.decisionPoint)
      }

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

      // Notify caller of resource changes so floating notifications can be shown
      if (data.resourceDelta) {
        onResourceDelta?.(data.resourceDelta)
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
          if (combatData.updatedCharacter) {
            updateSelectedCharacter(combatData.updatedCharacter)
          }
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

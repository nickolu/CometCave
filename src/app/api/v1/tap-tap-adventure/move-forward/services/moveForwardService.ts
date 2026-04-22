import { MoveForwardResponse } from '@/app/api/v1/tap-tap-adventure/move-forward/schemas'
import { getRegion, getConnectedRegions, canEnterRegion } from '@/app/tap-tap-adventure/config/regions'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { generateLLMEvents, generateLegendaryEvent } from '@/app/tap-tap-adventure/lib/llmEventGenerator'
import {
  crossedMilestone,
  SHOP_MILESTONE_INTERVAL,
  calculateDay,
} from '@/app/tap-tap-adventure/lib/leveling'
import { generateLandmarks, seededRandom } from '@/app/tap-tap-adventure/lib/landmarkGenerator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyDecisionPoint, FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'

const BASE_DISTANCE = 1

export async function moveForwardService(
  character: FantasyCharacter,
  storyEvents: FantasyStoryEvent[] = []
): Promise<MoveForwardResponse> {
  const newDistance = character.distance + BASE_DISTANCE
  const updatedCharacter = { ...character, distance: newDistance }
  const day = calculateDay(newDistance)

  const currentRegion = character.currentRegion ?? 'green_meadows'
  const region = getRegion(currentRegion)

  // Priority 1: Landmark state initialization (new region or no state yet)
  const existingLandmarkState = character.landmarkState
  if (!existingLandmarkState || existingLandmarkState.regionId !== currentRegion) {
    const visitCount = (character.visitedRegions ?? []).filter(id => id === currentRegion).length
    const landmarks = generateLandmarks(currentRegion, character.id, visitCount)

    // Seeded region length between 150-250 steps
    const regionLengthSeed = `${currentRegion}-${character.id}-${visitCount}-length`
    const regionLength = 150 + Math.floor(seededRandom(regionLengthSeed)() * 101)

    const initializedCharacter: FantasyCharacter = {
      ...updatedCharacter,
      landmarkState: {
        regionId: currentRegion,
        landmarks,
        entryDistance: newDistance,
        nextLandmarkIndex: 0,
        exploring: false,
        explorationDepth: 0,
        positionInRegion: 0,
        activeTargetIndex: 0,
        regionLength,
      },
    }

    const firstLandmark = landmarks[0]
    const landmarkProgress = firstLandmark
      ? {
          nextLandmarkName: firstLandmark.name,
          nextLandmarkIcon: firstLandmark.icon,
          stepsRemaining: firstLandmark.distanceFromEntry,
        }
      : null

    // Build availableTargets for TargetList rendering
    const availableTargets = [
      ...landmarks.map((lm, i) => ({
        index: i,
        name: lm.name,
        icon: lm.icon,
        type: 'landmark' as const,
        position: lm.distanceFromEntry,
        distance: lm.distanceFromEntry,
        isExplored: false,
        hasShop: lm.hasShop,
      })),
      {
        index: landmarks.length,
        name: `Leave ${region.name}`,
        icon: '🚪',
        type: 'region_exit' as const,
        position: regionLength,
        distance: regionLength,
      },
    ]

    return {
      character: initializedCharacter,
      event: null,
      decisionPoint: null,
      genericMessage: `You enter ${region.icon} ${region.name}. ${region.description}`,
      landmarkProgress,
      availableTargets,
    }
  }

  const landmarkState = existingLandmarkState

  // Increment positionInRegion by 1 for this step
  const newPositionInRegion = (landmarkState.positionInRegion ?? 0) + 1
  const activeTargetIndex = landmarkState.activeTargetIndex ?? 0

  // Priority 2: Target arrival check
  const isExitTarget = activeTargetIndex >= landmarkState.landmarks.length

  if (!isExitTarget) {
    // Landmark target arrival
    const activeLandmark = landmarkState.landmarks[activeTargetIndex]

    if (activeLandmark && newPositionInRegion >= activeLandmark.distanceFromEntry) {
      const arrivalEventId = `landmark-arrival-${Date.now()}`

      const characterWithUpdatedState: FantasyCharacter = {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
          positionInRegion: newPositionInRegion,
        },
      }

      // Build directional bypass options: show what lies ahead
      const bypassOptions = []

      // Add next landmarks (after the current one)
      for (let i = activeTargetIndex + 1; i < landmarkState.landmarks.length; i++) {
        const nextLm = landmarkState.landmarks[i]
        const dist = nextLm.distanceFromEntry - newPositionInRegion
        bypassOptions.push({
          id: `bypass-toward-${i}`,
          text: `${nextLm.icon} Head toward ${nextLm.name} (${dist} steps)`,
          successProbability: 1.0,
          successDescription: `You leave ${activeLandmark.name} behind and head toward ${nextLm.name}.`,
          successEffects: {},
          failureDescription: '',
          failureEffects: {},
          resultDescription: `You pass by ${activeLandmark.name} and head toward ${nextLm.name}.`,
        })
      }

      // Add region exit option
      const exitDist = (landmarkState.regionLength ?? 200) - newPositionInRegion
      bypassOptions.push({
        id: `bypass-toward-exit`,
        text: `🚪 Head toward ${region.name} border (${exitDist} steps)`,
        successProbability: 1.0,
        successDescription: `You leave ${activeLandmark.name} behind and continue toward the edge of ${region.name}.`,
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
        resultDescription: `You pass by ${activeLandmark.name} and head toward the border.`,
      })

      return {
        character: characterWithUpdatedState,
        event: {
          id: arrivalEventId,
          type: 'landmark_arrival',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: new Date().toISOString(),
        },
        decisionPoint: {
          id: `decision-${arrivalEventId}`,
          eventId: arrivalEventId,
          prompt: `${activeLandmark.icon} You arrive at ${activeLandmark.name}. ${activeLandmark.description} What do you do?`,
          options: [
            {
              id: 'explore-landmark',
              text: `Explore ${activeLandmark.name}`,
              successProbability: 1.0,
              successDescription: `You venture into ${activeLandmark.name} to see what awaits.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You explore ${activeLandmark.name}.`,
            },
            ...bypassOptions,
          ],
          resolved: false,
        },
        shopEvent: activeLandmark.hasShop ? true : undefined,
        landmarkArrival: {
          name: activeLandmark.name,
          type: activeLandmark.type,
          description: activeLandmark.description,
          icon: activeLandmark.icon,
          hasShop: activeLandmark.hasShop,
        },
      }
    }
  } else {
    // Exit target arrival — triggers region travel decision
    const regionLength = landmarkState.regionLength ?? 200

    if (newPositionInRegion >= regionLength) {
      const connected = getConnectedRegions(region.id)
      const exitEventId = `region-exit-${Date.now()}`

      const difficultyLabel: Record<string, string> = {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
        very_hard: 'Very Hard',
      }

      const visitedRegions = character.visitedRegions ?? ['green_meadows']

      const travelOptions = connected.map(connectedRegion => {
        const meetsLevel = canEnterRegion(connectedRegion, character.level)
        const levelWarning = meetsLevel ? '' : ` [Requires Lv.${connectedRegion.minLevel}]`
        const isVisited = visitedRegions.includes(connectedRegion.id)
        const bossTag = !isVisited && meetsLevel ? ' — ⚔️ BOSS GUARDIAN' : ''
        return {
          id: `travel-${connectedRegion.id}`,
          text: `${!isVisited && meetsLevel ? '⚔️ ' : ''}${connectedRegion.icon} ${connectedRegion.name} (${difficultyLabel[connectedRegion.difficulty] ?? connectedRegion.difficulty})${levelWarning}${bossTag}`,
          requiresBoss: !isVisited && meetsLevel,
          successProbability: meetsLevel ? 1.0 : 0.0,
          successDescription: `You set out toward ${connectedRegion.name}. ${connectedRegion.description}`,
          successEffects: {},
          failureDescription: meetsLevel
            ? `You set out toward ${connectedRegion.name}.`
            : `You are not experienced enough to enter ${connectedRegion.name}. You need to be at least level ${connectedRegion.minLevel}.`,
          failureEffects: {},
          resultDescription: meetsLevel
            ? `You travel to ${connectedRegion.name}.`
            : `You cannot enter ${connectedRegion.name} yet.`,
        }
      })

      const stayOption = {
        id: 'stay',
        text: `${region.icon} Continue in ${region.name}`,
        successProbability: 1.0,
        successDescription: `You decide to continue exploring ${region.name}.`,
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
        resultDescription: `You continue in ${region.name}.`,
      }

      const characterWithUpdatedState: FantasyCharacter = {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
          positionInRegion: newPositionInRegion,
        },
      }

      return {
        character: characterWithUpdatedState,
        event: {
          id: exitEventId,
          type: 'crossroads',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: new Date().toISOString(),
        },
        decisionPoint: {
          id: `decision-${exitEventId}`,
          eventId: exitEventId,
          prompt: `You have reached the edge of ${region.icon} ${region.name}. Where will you go next?`,
          options: [...travelOptions, stayOption],
          resolved: false,
        },
      }
    }
  }

  // Priority 3: Compute landmark progress for non-arrival steps
  let landmarkProgress: MoveForwardResponse['landmarkProgress'] = null
  if (activeTargetIndex < landmarkState.landmarks.length) {
    const nextLandmark = landmarkState.landmarks[activeTargetIndex]
    const stepsRemaining = nextLandmark.distanceFromEntry - newPositionInRegion
    landmarkProgress = {
      nextLandmarkName: nextLandmark.name,
      nextLandmarkIcon: nextLandmark.icon,
      stepsRemaining: Math.max(1, stepsRemaining),
    }
  }

  // Trigger shop event every SHOP_MILESTONE_INTERVAL steps (100) — only when no landmarks remain
  const allLandmarksDone =
    !landmarkState || landmarkState.nextLandmarkIndex >= landmarkState.landmarks.length
  if (allLandmarksDone && crossedMilestone(character.distance, newDistance, SHOP_MILESTONE_INTERVAL)) {
    return {
      character: {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
          positionInRegion: newPositionInRegion,
        },
      },
      event: {
        id: `shop-event-${Date.now()}`,
        type: 'shop',
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      },
      decisionPoint: null,
      shopEvent: true,
      landmarkProgress,
    }
  }

  // Periodic merchant: ~5% chance every step after distance 50
  const merchantChance = newDistance > 50 ? 0.05 : 0
  if (merchantChance > 0 && Math.random() < merchantChance) {
    return {
      character: {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
          positionInRegion: newPositionInRegion,
        },
      },
      event: {
        id: `merchant-event-${Date.now()}`,
        type: 'shop',
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      },
      decisionPoint: null,
      shopEvent: true,
      landmarkProgress,
    }
  }

  // Rare legendary encounter: ~1% chance every step after distance 150
  if (newDistance > 150 && Math.random() < 0.01) {
    try {
      const context = buildStoryContext(character, storyEvents)
      const legendaryEvent = await generateLegendaryEvent(character, context)

      return {
        character: {
          ...updatedCharacter,
          landmarkState: {
            ...landmarkState,
            positionInRegion: newPositionInRegion,
          },
        },
        event: {
          id: legendaryEvent.id,
          type: 'legendary_encounter',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: new Date().toISOString(),
        },
        decisionPoint: {
          id: `decision-${legendaryEvent.id}`,
          eventId: legendaryEvent.id,
          prompt: legendaryEvent.description,
          options: legendaryEvent.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            successProbability: opt.successProbability,
            successDescription: opt.successDescription,
            successEffects: opt.successEffects,
            failureDescription: opt.failureDescription,
            failureEffects: opt.failureEffects,
            resultDescription: opt.successDescription,
            triggersCombat: opt.triggersCombat,
          })),
          resolved: false,
          isLegendary: true,
        },
        landmarkProgress,
      }
    } catch (err) {
      console.error('Legendary encounter generation failed, falling back to normal events', err)
      // Fall through to normal event generation
    }
  }

  let event: FantasyStoryEvent | null = null
  let decisionPoint: FantasyDecisionPoint | null = null

  try {
    const context = buildStoryContext(character, storyEvents)
    const llmEvents = await generateLLMEvents(character, context)
    const llmEvent = llmEvents[0]

    event = {
      id: llmEvent.id,
      type: 'decision_point',
      characterId: character.id,
      locationId: character.locationId,
      timestamp: new Date().toISOString(),
    }
    decisionPoint = {
      id: `decision-${llmEvent.id}`,
      eventId: llmEvent.id,
      prompt: llmEvent.description,
      options: llmEvent.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        successProbability: opt.successProbability,
        successDescription: opt.successDescription,
        successEffects: opt.successEffects,
        failureDescription: opt.failureDescription,
        failureEffects: opt.failureEffects,
        resultDescription: opt.successDescription,
        triggersCombat: opt.triggersCombat,
      })),
      resolved: false,
    }
  } catch (err) {
    console.error('moveForwardService failed', err)
    event = null
    decisionPoint = null
  }

  return {
    character: {
      ...updatedCharacter,
      landmarkState: {
        ...landmarkState,
        positionInRegion: newPositionInRegion,
      },
    },
    event,
    decisionPoint,
    landmarkProgress,
  }
}

import { MoveForwardResponse } from '@/app/api/v1/tap-tap-adventure/move-forward/schemas'
import { getRegion, getConnectedRegions, canEnterRegion, CROSSROADS_INTERVAL } from '@/app/tap-tap-adventure/config/regions'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { generateLLMEvents, generateLegendaryEvent } from '@/app/tap-tap-adventure/lib/llmEventGenerator'
import {
  crossedMilestone,
  SHOP_MILESTONE_INTERVAL,
  calculateDay,
} from '@/app/tap-tap-adventure/lib/leveling'
import { generateLandmarks } from '@/app/tap-tap-adventure/lib/landmarkGenerator'
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

    const initializedCharacter: FantasyCharacter = {
      ...updatedCharacter,
      landmarkState: {
        regionId: currentRegion,
        landmarks,
        entryDistance: newDistance,
        nextLandmarkIndex: 0,
        exploring: false,
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

    return {
      character: initializedCharacter,
      event: null,
      decisionPoint: null,
      genericMessage: `You enter ${region.icon} ${region.name}. ${region.description}`,
      landmarkProgress,
    }
  }

  const landmarkState = existingLandmarkState
  const stepsFromEntry = newDistance - landmarkState.entryDistance

  // Priority 2: Landmark arrival check
  if (landmarkState.nextLandmarkIndex < landmarkState.landmarks.length) {
    const nextLandmark = landmarkState.landmarks[landmarkState.nextLandmarkIndex]

    if (stepsFromEntry >= nextLandmark.distanceFromEntry) {
      const arrivalEventId = `landmark-arrival-${Date.now()}`

      const characterWithUpdatedState: FantasyCharacter = {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
        },
      }

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
          prompt: `${nextLandmark.icon} You arrive at ${nextLandmark.name}. ${nextLandmark.description} What do you do?`,
          options: [
            {
              id: 'explore-landmark',
              text: `Explore ${nextLandmark.name}`,
              successProbability: 1.0,
              successDescription: `You venture into ${nextLandmark.name} to see what awaits.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You explore ${nextLandmark.name}.`,
            },
            {
              id: 'bypass-landmark',
              text: 'Pass by without stopping',
              successProbability: 1.0,
              successDescription: `You leave ${nextLandmark.name} behind and continue on your journey.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You pass by ${nextLandmark.name}.`,
            },
          ],
          resolved: false,
        },
        shopEvent: nextLandmark.hasShop ? true : undefined,
        landmarkArrival: {
          name: nextLandmark.name,
          type: nextLandmark.type,
          description: nextLandmark.description,
          icon: nextLandmark.icon,
          hasShop: nextLandmark.hasShop,
        },
      }
    }
  }

  // Priority 3: Compute landmark progress for non-arrival steps
  let landmarkProgress: MoveForwardResponse['landmarkProgress'] = null
  if (landmarkState.nextLandmarkIndex < landmarkState.landmarks.length) {
    const nextLandmark = landmarkState.landmarks[landmarkState.nextLandmarkIndex]
    const stepsRemaining = nextLandmark.distanceFromEntry - stepsFromEntry
    landmarkProgress = {
      nextLandmarkName: nextLandmark.name,
      nextLandmarkIcon: nextLandmark.icon,
      stepsRemaining: Math.max(1, stepsRemaining),
    }
  }

  // Trigger crossroads event every CROSSROADS_INTERVAL steps (75)
  if (crossedMilestone(character.distance, newDistance, CROSSROADS_INTERVAL)) {
    const connected = getConnectedRegions(region.id)
    const crossroadsEventId = `crossroads-event-${Date.now()}`

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

    return {
      character: updatedCharacter,
      event: {
        id: crossroadsEventId,
        type: 'crossroads',
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      },
      decisionPoint: {
        id: `decision-${crossroadsEventId}`,
        eventId: crossroadsEventId,
        prompt: `You reach a crossroads. Multiple paths stretch before you. You are currently in ${region.icon} ${region.name}. Where will you go?`,
        options: [...travelOptions, stayOption],
        resolved: false,
      },
      landmarkProgress,
    }
  }

  // Trigger shop event every SHOP_MILESTONE_INTERVAL steps (100) — only when no landmarks remain
  const allLandmarksDone =
    !landmarkState || landmarkState.nextLandmarkIndex >= landmarkState.landmarks.length
  if (allLandmarksDone && crossedMilestone(character.distance, newDistance, SHOP_MILESTONE_INTERVAL)) {
    return {
      character: updatedCharacter,
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
      character: updatedCharacter,
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
        character: updatedCharacter,
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
    character: updatedCharacter,
    event,
    decisionPoint,
    landmarkProgress,
  }
}

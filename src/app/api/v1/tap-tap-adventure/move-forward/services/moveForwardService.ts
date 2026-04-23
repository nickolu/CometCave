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
import { moveToward, hasArrived, Vec2 } from '@/app/tap-tap-adventure/lib/movementUtils'

const BASE_DISTANCE = 1

export async function moveForwardService(
  character: FantasyCharacter,
  storyEvents: FantasyStoryEvent[] = []
): Promise<MoveForwardResponse> {
  const mountSpeed = character.activeMount?.bonuses?.autoWalkSpeed ?? 1
  const moveDistance = BASE_DISTANCE * mountSpeed
  const newDistance = character.distance + moveDistance
  const updatedCharacter = { ...character, distance: newDistance }
  const day = calculateDay(newDistance)

  const currentRegion = character.currentRegion ?? 'green_meadows'
  const region = getRegion(currentRegion)

  // Priority 1: Landmark state initialization (new region or no state yet)
  const existingLandmarkState = character.landmarkState
  if (!existingLandmarkState || existingLandmarkState.regionId !== currentRegion) {
    const visitCount = (character.visitedRegions ?? []).filter(id => id === currentRegion).length

    // Scale region size by difficulty: easy (0.8) → 80, medium (1.0) → 100, hard (1.5) → 150, extreme (3.0) → 300
    const regionSize = Math.round(100 * region.difficultyMultiplier)
    const landmarks = generateLandmarks(currentRegion, character.id, visitCount, region.difficultyMultiplier, regionSize)

    // Seeded region length scaled by difficulty
    const regionLengthSeed = `${currentRegion}-${character.id}-${visitCount}-length`
    const regionLength = Math.floor((50 + Math.floor(seededRandom(regionLengthSeed)() * 31)) * region.difficultyMultiplier)

    // Generate exit positions spread around region edges, one per connected region
    const connected = getConnectedRegions(region.id)
    const center = regionSize / 2
    const edgeRadius = regionSize * 0.48
    const exitPositions = connected.map((connRegion, i) => {
      const angle = (i / connected.length) * Math.PI * 2
      const edgeX = center + Math.cos(angle) * edgeRadius
      const edgeY = center + Math.sin(angle) * edgeRadius
      return {
        regionId: connRegion.id,
        name: `Path to ${connRegion.name}`,
        icon: connRegion.icon,
        position: { x: Math.round(edgeX), y: Math.round(edgeY) },
      }
    })

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
        position: { x: 0, y: 0 },
        exitPosition: exitPositions[0]?.position ?? { x: Math.round(regionSize * 0.98), y: Math.round(regionSize / 2) },
        exitPositions,
        regionBounds: { width: regionSize, height: regionSize },
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

    // Build availableTargets for TargetList rendering (hidden landmarks excluded)
    const availableTargets = [
      ...landmarks
        .map((lm, i) => ({
          index: i,
          name: lm.name,
          icon: lm.icon,
          type: 'landmark' as const,
          position: lm.distanceFromEntry,
          distance: lm.distanceFromEntry,
          isExplored: false,
          hasShop: lm.hasShop,
          position2d: lm.position,
        }))
        .filter((_, i) => !landmarks[i].hidden),
      ...exitPositions.map((exit, i) => ({
        index: landmarks.length + i,
        name: exit.name,
        icon: exit.icon,
        type: 'region_exit' as const,
        position: regionLength,
        distance: regionLength,
        position2d: exit.position,
        exitRegionId: exit.regionId,
      })),
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

  // Increment positionInRegion by moveDistance for this step
  const newPositionInRegion = (landmarkState.positionInRegion ?? 0) + moveDistance
  const activeTargetIndex = landmarkState.activeTargetIndex ?? 0

  // Compute updated 2D position for this step
  const isExitTargetForPos = activeTargetIndex >= landmarkState.landmarks.length
  let updatedPosition = landmarkState.position
  let activePosTarget: Vec2 | undefined
  if (isExitTargetForPos) {
    const exitIdx = activeTargetIndex - landmarkState.landmarks.length
    const exits = landmarkState.exitPositions ?? []
    activePosTarget = exits[exitIdx]?.position ?? landmarkState.exitPosition
  } else {
    activePosTarget = landmarkState.landmarks[activeTargetIndex]?.position
  }
  if (updatedPosition && activePosTarget) {
    updatedPosition = moveToward(updatedPosition, activePosTarget, moveDistance)
  }

  // Priority 2: Target arrival check
  const isExitTarget = activeTargetIndex >= landmarkState.landmarks.length

  if (!isExitTarget) {
    // Landmark target arrival
    const activeLandmark = landmarkState.landmarks[activeTargetIndex]

    // Check arrival: use 2D when data exists, fall back to 1D only when no 2D data
    const charPos = updatedPosition
    const targetPos = activeLandmark?.position
    const has2dData = charPos && targetPos
    const hasArrivedAtLandmark = has2dData
      ? hasArrived(charPos, targetPos)
      : newPositionInRegion >= (activeLandmark?.distanceFromEntry ?? Infinity)

    if (activeLandmark && !activeLandmark.hidden && hasArrivedAtLandmark) {
      const arrivalEventId = `landmark-arrival-${Date.now()}`

      const characterWithUpdatedState: FantasyCharacter = {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
          positionInRegion: newPositionInRegion,
          position: updatedPosition,
          nextLandmarkIndex: activeTargetIndex, // keep in sync with activeTargetIndex
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
    // Exit target arrival — triggers travel decision for the specific exit chosen
    const regionLength = landmarkState.regionLength ?? 200
    const exitIdx = activeTargetIndex - landmarkState.landmarks.length
    const exits = landmarkState.exitPositions ?? []
    const targetExit = exits[exitIdx]

    // Check arrival at the specific exit — 2D only when data exists, 1D fallback otherwise
    const exitTargetPos = targetExit?.position ?? landmarkState.exitPosition
    const exitCharPos = updatedPosition
    const has2dExitData = exitCharPos && exitTargetPos
    const hasArrivedAtExit = has2dExitData
      ? hasArrived(exitCharPos, exitTargetPos)
      : newPositionInRegion >= regionLength

    if (hasArrivedAtExit) {
      const exitEventId = `region-exit-${Date.now()}`
      const visitedRegions = character.visitedRegions ?? ['green_meadows']

      const characterWithUpdatedState: FantasyCharacter = {
        ...updatedCharacter,
        landmarkState: {
          ...landmarkState,
          positionInRegion: newPositionInRegion,
          position: updatedPosition,
        },
      }

      // If we have a specific target exit, show a focused decision for that region
      if (targetExit) {
        const targetRegion = getRegion(targetExit.regionId)
        const meetsLevel = canEnterRegion(targetRegion, character.level)
        const isVisited = visitedRegions.includes(targetExit.regionId)

        let travelOptions
        if (!meetsLevel) {
          travelOptions = [
            {
              id: 'turn-back',
              text: `${region.icon} Turn back — not high enough level (need Lv.${targetRegion.minLevel})`,
              successProbability: 1.0,
              successDescription: `You are not ready to enter ${targetRegion.name} yet. You return to explore ${region.name}.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You turn back from the path to ${targetRegion.name}.`,
            },
          ]
        } else if (!isVisited) {
          travelOptions = [
            {
              id: `travel-${targetExit.regionId}`,
              text: `⚔️ Face the Guardian of ${targetRegion.icon} ${targetRegion.name}`,
              requiresBoss: true,
              successProbability: 1.0,
              successDescription: `You approach ${targetRegion.name} and prepare to face its guardian.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You enter ${targetRegion.name}.`,
            },
            {
              id: 'turn-back',
              text: `${region.icon} Turn back`,
              successProbability: 1.0,
              successDescription: `You decide to continue exploring ${region.name}.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You continue in ${region.name}.`,
            },
          ]
        } else {
          travelOptions = [
            {
              id: `travel-${targetExit.regionId}`,
              text: `Enter ${targetRegion.icon} ${targetRegion.name}`,
              successProbability: 1.0,
              successDescription: `You set out toward ${targetRegion.name}. ${targetRegion.description}`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You travel to ${targetRegion.name}.`,
            },
            {
              id: 'turn-back',
              text: `${region.icon} Stay in ${region.name}`,
              successProbability: 1.0,
              successDescription: `You decide to continue exploring ${region.name}.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You continue in ${region.name}.`,
            },
          ]
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
            prompt: `You have reached the ${targetExit.icon} path toward ${targetRegion.name}. ${isVisited ? `This region is familiar to you.` : `A guardian blocks the way to this uncharted territory.`}`,
            options: travelOptions,
            resolved: false,
          },
        }
      }

      // Fallback: no specific exit found — show all connected regions (backward compat)
      const connected = getConnectedRegions(region.id)

      const difficultyLabel: Record<string, string> = {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
        very_hard: 'Very Hard',
      }

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
  // Find the next visible (non-hidden) target for progress display
  let progressTargetIndex = activeTargetIndex
  while (progressTargetIndex < landmarkState.landmarks.length && landmarkState.landmarks[progressTargetIndex]?.hidden) {
    progressTargetIndex++
  }
  let landmarkProgress: MoveForwardResponse['landmarkProgress'] = null
  if (progressTargetIndex < landmarkState.landmarks.length) {
    const nextLandmark = landmarkState.landmarks[progressTargetIndex]
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
          position: updatedPosition,
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
          position: updatedPosition,
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
            position: updatedPosition,
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
        position: updatedPosition,
      },
    },
    event,
    decisionPoint,
    landmarkProgress,
  }
}

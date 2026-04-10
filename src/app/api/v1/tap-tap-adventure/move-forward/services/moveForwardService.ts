import { MoveForwardResponse } from '@/app/api/v1/tap-tap-adventure/move-forward/schemas'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { generateCombatEncounter } from '@/app/tap-tap-adventure/lib/combatGenerator'
import { generateLLMEvents } from '@/app/tap-tap-adventure/lib/llmEventGenerator'
import { calculateLevel } from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyDecisionPoint, FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'

const BASE_DISTANCE = 1

export async function moveForwardService(
  character: FantasyCharacter,
  storyEvents: FantasyStoryEvent[] = []
): Promise<MoveForwardResponse> {
  const newDistance = character.distance + BASE_DISTANCE
  const oldLevel = calculateLevel(character.distance)
  const newLevel = calculateLevel(newDistance)
  const updatedCharacter = { ...character, distance: newDistance }

  // Trigger shop event on level up
  if (newLevel > oldLevel) {
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
      combatEncounter: null,
      shopEvent: true,
    }
  }

  let event: FantasyStoryEvent | null = null
  let decisionPoint: FantasyDecisionPoint | null = null
  let combatEncounter = null

  try {
    const context = buildStoryContext(character, storyEvents)

    // Combat chance: base 15% + level scaling, modified by reputation
    let combatChance = 0.15 + character.level * 0.01
    if (character.reputation >= 50) {
      combatChance -= 0.05 // High reputation: fewer hostile encounters
    } else if (character.reputation <= -20) {
      combatChance += 0.05 // Low reputation: more hostile encounters
    }
    if (Math.random() < combatChance) {
      const encounter = await generateCombatEncounter(character, context)
      combatEncounter = encounter
      event = {
        id: `combat-event-${Date.now()}`,
        type: 'combat_start',
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      }
      return {
        character: updatedCharacter,
        event,
        decisionPoint: null,
        combatEncounter,
      }
    }

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
        resultDescription: opt.successDescription, // Default to success description
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
    combatEncounter,
  }
}

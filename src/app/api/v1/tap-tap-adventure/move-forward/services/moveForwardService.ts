import { MoveForwardResponse } from '@/app/api/v1/tap-tap-adventure/move-forward/schemas'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
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

  // Trigger boss event every 5 levels
  if (newLevel > oldLevel && newLevel % 5 === 0) {
    const bossEventId = `boss-event-${Date.now()}`
    return {
      character: updatedCharacter,
      event: {
        id: bossEventId,
        type: 'boss_available',
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      },
      decisionPoint: {
        id: `decision-${bossEventId}`,
        eventId: bossEventId,
        prompt: `You sense a powerful presence ahead. A formidable guardian blocks the path forward. You are now level ${newLevel} — do you feel ready to face this challenge?`,
        options: [
          {
            id: `boss-fight-${bossEventId}`,
            text: 'Challenge the boss!',
            triggersCombat: true,
            isBoss: true,
            successProbability: 0.5,
            successDescription: 'You prepare for an epic battle!',
            successEffects: {},
            failureDescription: 'You prepare for an epic battle!',
            failureEffects: {},
            resultDescription: 'You prepare for an epic battle!',
          },
          {
            id: `boss-skip-${bossEventId}`,
            text: 'Not yet — keep traveling and grow stronger',
            successProbability: 1.0,
            successDescription: 'You wisely decide to prepare more before facing this challenge. The boss will still be here when you return.',
            successEffects: { reputation: 0 },
            failureDescription: 'You continue your journey.',
            failureEffects: {},
            resultDescription: 'You wisely decide to prepare more before facing this challenge.',
          },
        ],
        resolved: false,
      },
    }
  }

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
      shopEvent: true,
    }
  }

  // Periodic merchant: ~10% chance every step after distance 15, but not within 10 steps of last shop
  const merchantChance = newDistance > 15 ? 0.10 : 0
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
  }
}

import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'
import { FantasyStoryEvent, FantasyDecisionPoint } from '@/app/fantasy-tycoon/models/story'
import { generateLLMEvents } from '@/app/fantasy-tycoon/lib/llmEventGenerator'
import { MoveForwardResponse } from '../schemas'

const BASE_DISTANCE = 1

export async function moveForwardService(
  character: FantasyCharacter
): Promise<MoveForwardResponse> {
  const updatedCharacter = { ...character, distance: character.distance + BASE_DISTANCE }

  let event: FantasyStoryEvent | null = null
  let decisionPoint: FantasyDecisionPoint | null = null

  try {
    const context = ''
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
  }
}

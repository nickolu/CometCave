import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';
import { FantasyStoryEvent, FantasyDecisionPoint } from '@/app/fantasy-tycoon/models/story';
import { generateLLMEvents } from '@/app/fantasy-tycoon/lib/llmEventGenerator';
import extractRewardItemsFromText from '@/app/fantasy-tycoon/lib/parsers/rewardExtractor';
import { MoveForwardResponse } from '../schemas';
import { Item } from '@/app/fantasy-tycoon/models/item';

const BASE_DISTANCE = 1;

export async function moveForwardService(
  character: FantasyCharacter
): Promise<MoveForwardResponse> {
  const updatedCharacter = { ...character, distance: character.distance + BASE_DISTANCE };

  let event: FantasyStoryEvent | null = null;
  let decisionPoint: FantasyDecisionPoint | null = null;

  try {
    console.log('[moveForwardService]')
    const context = '';
    const llmEvents = await generateLLMEvents(character, context);
    const llmEvent = llmEvents[0];
    console.log('llmEvent', llmEvent)
    event = {
      id: llmEvent.id,
      type: 'decision_point',
      description: llmEvent.description,
      characterId: character.id,
      locationId: character.locationId,
      timestamp: new Date().toISOString(),
    };
    console.log('event', event)
    decisionPoint = {
      id: `decision-${llmEvent.id}`,
      eventId: llmEvent.id,
      prompt: llmEvent.description,
      options: await Promise.all(
        llmEvent.options.map(async opt => {
          console.log('raw option:', opt)
          let extractedRewardItems: Item[] = [];
          if (opt.outcome.description) {
            extractedRewardItems = await extractRewardItemsFromText(opt.outcome.description);
          }
          return {
            id: opt.id,
            text: opt.text,
            effects: {
              gold: opt.outcome.goldDelta ?? 0,
              reputation: opt.outcome.reputationDelta ?? 0,
              statusChange: opt.outcome.statusChange,
              rewardItems:
                extractedRewardItems.length > 0
                  ? extractedRewardItems
                  : (opt.outcome.rewardItems ?? []),
            },
            resultDescription: opt.outcome.description,
            rewardItems:
              extractedRewardItems.length > 0
                ? extractedRewardItems
                : (opt.outcome.rewardItems ?? []),
          };
        })
      ),
      resolved: false,
    };
    console.log('decisionPoint', decisionPoint)
  } catch (err) {
    console.error('moveForwardService failed', err);
    event = null;
    decisionPoint = null;
  }

  return {
    character: updatedCharacter,
    event,
    decisionPoint,
  };
}

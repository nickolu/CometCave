import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';
import { FantasyStoryEvent, FantasyDecisionPoint } from '@/app/fantasy-tycoon/models/story';
import { generateLLMEvents } from '@/app/fantasy-tycoon/lib/llmEventGenerator';
import { MoveForwardResponse } from '../schemas';

const BASE_DISTANCE = 1;

export function rollEvent(character: FantasyCharacter): {
  event: FantasyStoryEvent | null;
  decisionPoint: FantasyDecisionPoint | null;
  goldDelta: number;
  reputationDelta: number;
} {
  const eventWeights = [
    { type: 0, weight: 60 },
    { type: 1, weight: 10 },
    { type: 2, weight: 10 },
    { type: 3, weight: 10 },
  ];
  const totalWeight = eventWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const rand = Math.random() * totalWeight;
  let acc = 0;
  let roll = 0;
  for (let i = 0; i < eventWeights.length; i++) {
    acc += eventWeights[i].weight;
    if (rand < acc) {
      roll = eventWeights[i].type;
      break;
    }
  }
  const now = new Date().toISOString();
  switch (roll) {
    case 0:
      return {
        event: null,
        decisionPoint: null,
        goldDelta: 0,
        reputationDelta: 0,
      };
    case 1:
      return {
        event: {
          id: `event-gold-${now}`,
          type: 'gain_gold',
          description: 'You found 10 gold on the road.',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: now,
        },
        decisionPoint: null,
        goldDelta: 10,
        reputationDelta: 0,
      };
    case 2:
      return {
        event: {
          id: `event-rep-${now}`,
          type: 'gain_reputation',
          description: 'You helped a traveler and gained reputation.',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: now,
        },
        decisionPoint: null,
        goldDelta: 0,
        reputationDelta: 5,
      };
    case 3:
      const decisionPoint: FantasyDecisionPoint = {
        id: `decision-${now}`,
        eventId: `event-decision-${now}`,
        prompt: 'A fork in the road! Which path do you take?',
        options: [
          {
            id: 'left',
            text: 'Take the left path',
            effects: { gold: 0, reputation: 2 },
          },
          {
            id: 'right',
            text: 'Take the right path',
            effects: { gold: 5, reputation: 0 },
          },
        ],
        resolved: false,
      };
      return {
        event: {
          id: decisionPoint.eventId,
          type: 'decision_point',
          description: 'You encountered a fork in the road.',
          characterId: character.id,
          locationId: character.locationId,
          timestamp: now,
        },
        decisionPoint,
        goldDelta: 0,
        reputationDelta: 0,
      };
    default:
      return { event: null, decisionPoint: null, goldDelta: 0, reputationDelta: 0 };
  }
}

export async function moveForwardService(character: FantasyCharacter): Promise<MoveForwardResponse> {
  let updatedCharacter = { ...character, distance: character.distance + BASE_DISTANCE };
  const eventWeights = [
    { type: 0, weight: 60 },
    { type: 1, weight: 10 },
    { type: 2, weight: 10 },
    { type: 3, weight: 10 },
  ];
  const totalWeight = eventWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const rand = Math.random() * totalWeight;
  let acc = 0;
  let roll = 0;
  for (let i = 0; i < eventWeights.length; i++) {
    acc += eventWeights[i].weight;
    if (rand < acc) {
      roll = eventWeights[i].type;
      break;
    }
  }

  let event: FantasyStoryEvent | null = null;
  let decisionPoint: FantasyDecisionPoint | null = null;
  let goldDelta = 0;
  let reputationDelta = 0;
  const genericMessages = [
    'The road is quiet. You travel onward.',
    'A gentle breeze rustles the trees. Nothing of note happens.',
    'You take a moment to rest and reflect.',
    'You hear distant laughter, but nothing comes of it.',
    'The journey continues uneventfully.',
  ];
  let genericMessage: string | null = null;

  if (roll === 0) {
    event = null;
    decisionPoint = null;
    genericMessage = genericMessages[Math.floor(Math.random() * genericMessages.length)];
  } else if (roll === 1) {
    try {
      const context = '';
      const llmEvents = await generateLLMEvents(character, context);
      const llmEvent = llmEvents[0];
      event = {
        id: llmEvent.id,
        type: 'decision_point',
        description: llmEvent.description,
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      };
      decisionPoint = {
        id: `decision-${llmEvent.id}`,
        eventId: llmEvent.id,
        prompt: llmEvent.description,
        options: llmEvent.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          effects: {
            gold: opt.outcome.goldDelta ?? 0,
            reputation: opt.outcome.reputationDelta ?? 0,
            statusChange: opt.outcome.statusChange,
            rewardItems: opt.outcome.rewardItems ?? [],
          },
          resultDescription: opt.outcome.description,
        })),
        resolved: false,
      };
    } catch (err) {
      console.error('LLM event generation failed', err);
      event = null;
      decisionPoint = null;
      genericMessage = genericMessages[Math.floor(Math.random() * genericMessages.length)];
    }
  } else if (roll === 2) {
    event = {
      id: `event-rep-${Date.now()}`,
      type: 'gain_reputation',
      description: 'You helped a traveler and gained reputation.',
      characterId: character.id,
      locationId: character.locationId,
      timestamp: new Date().toISOString(),
    };
    reputationDelta = 5;
  } else if (roll === 3) {
    try {
      const context = '';
      const llmEvents = await generateLLMEvents(character, context);
      const llmEvent = llmEvents[0];
      event = {
        id: llmEvent.id,
        type: 'decision_point',
        description: llmEvent.description,
        characterId: character.id,
        locationId: character.locationId,
        timestamp: new Date().toISOString(),
      };
      decisionPoint = {
        id: `decision-${llmEvent.id}`,
        eventId: llmEvent.id,
        prompt: llmEvent.description,
        options: llmEvent.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          effects: {
            gold: opt.outcome.goldDelta ?? 0,
            reputation: opt.outcome.reputationDelta ?? 0,
            statusChange: opt.outcome.statusChange,
            rewardItems: opt.outcome.rewardItems ?? [],
          },
          resultDescription: opt.outcome.description,
        })),
        resolved: false,
      };
    } catch (err) {
      console.error('LLM event generation failed', err);
      const legacy = rollEvent(character);
      event = legacy.event;
      decisionPoint = legacy.decisionPoint;
      goldDelta = legacy.goldDelta;
      reputationDelta = legacy.reputationDelta;
    }
  }

  if (goldDelta) updatedCharacter = { ...updatedCharacter, gold: updatedCharacter.gold + goldDelta };
  if (reputationDelta) updatedCharacter = { ...updatedCharacter, reputation: updatedCharacter.reputation + reputationDelta };

  return {
    character: updatedCharacter,
    event,
    decisionPoint,
    genericMessage,
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';
import {
  FantasyStoryEvent,
  FantasyDecisionPoint,
} from '@/app/fantasy-tycoon/models/story';

interface MoveForwardRequest {
  character: FantasyCharacter;
}

interface MoveForwardResponse {
  character: FantasyCharacter;
  event?: FantasyStoryEvent | null;
  decisionPoint?: FantasyDecisionPoint | null;
}

const BASE_DISTANCE = 1;

export function rollEvent(character: FantasyCharacter): {
  event: FantasyStoryEvent | null;
  decisionPoint: FantasyDecisionPoint | null;
  goldDelta: number;
  reputationDelta: number;
} {
  // 0: nothing, 1: gold, 2: reputation, 3: decision
  const roll = Math.floor(Math.random() * 4);
  const now = new Date().toISOString();
  switch (roll) {
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

export async function POST(req: NextRequest): Promise<NextResponse<MoveForwardResponse>> {
  const body = await req.json();
  const { character }: MoveForwardRequest = body;
  let updatedCharacter = { ...character, distance: character.distance + BASE_DISTANCE };

  const { event, decisionPoint, goldDelta, reputationDelta } = rollEvent(updatedCharacter);
  if (goldDelta) updatedCharacter = { ...updatedCharacter, gold: updatedCharacter.gold + goldDelta };
  if (reputationDelta) updatedCharacter = { ...updatedCharacter, reputation: updatedCharacter.reputation + reputationDelta };

  return NextResponse.json({
    character: updatedCharacter,
    event,
    decisionPoint,
  });
}

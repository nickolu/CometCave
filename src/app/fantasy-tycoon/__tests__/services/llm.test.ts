import { describe, expect, it } from 'vitest';
import { buildPrompt, parseResponse } from '../../services/llm';
import { FantasyCharacter } from '../../models/character';

describe('LLM Service', () => {
  const character: FantasyCharacter = {
    id: 'char-1',
    playerId: 'player-1',
    name: 'Aelwyn',
    class: 'Ranger',
    level: 5,
    gold: 50,
    reputation: 10,
    status: 'active',
    locationId: 'loc1',
    distance: 0,
    race: 'Human',
    abilities: [],
    strength: 10,
    intelligence: 10,
    luck: 10,
  };
  const context = 'Aelwyn is traveling through the enchanted forest.';

  it('buildPrompt should return a formatted prompt string', () => {
    const prompt = buildPrompt(character, context);
    expect(prompt).toContain('Generate 3 fantasy adventure event objects');
    expect(prompt).toContain('Aelwyn');
    expect(prompt).toContain('enchanted forest');
  });

  it('parseResponse should parse a valid array response', () => {
    const mockRaw = JSON.stringify([
      {
        id: 'event1',
        description: 'A wild boar appears.',
        options: [
          {
            id: 'attack',
            text: 'Attack the boar',
            probability: 0.7,
            outcome: { description: 'You defeat the boar.', goldDelta: 10 }
          },
          {
            id: 'flee',
            text: 'Run away',
            probability: 0.3,
            outcome: { description: 'You escape unharmed.' }
          }
        ]
      },
      {
        id: 'event2',
        description: 'A merchant offers a potion.',
        options: [
          {
            id: 'buy',
            text: 'Buy the potion',
            probability: 0.5,
            outcome: { description: 'You gain reputation.', reputationDelta: 2 }
          },
          {
            id: 'decline',
            text: 'Decline',
            probability: 0.5,
            outcome: { description: 'Nothing happens.' }
          }
        ]
      },
      {
        id: 'event3',
        description: 'You find a hidden path.',
        options: [
          {
            id: 'explore',
            text: 'Explore the path',
            probability: 0.6,
            outcome: { description: 'You discover treasure.', goldDelta: 20 }
          },
          {
            id: 'ignore',
            text: 'Ignore it',
            probability: 0.4,
            outcome: { description: 'You move on.' }
          }
        ]
      }
    ]);
    const events = parseResponse(mockRaw);
    expect(events).toHaveLength(3);
    expect(events[0].options.length).toBe(2);
    expect(events[1].description).toContain('merchant');
  });

  it('parseResponse should throw on invalid response', () => {
    expect(() => parseResponse('not json')).toThrow();
    expect(() => parseResponse('{}')).toThrow();
    expect(() => parseResponse('')).toThrow();
  });
});

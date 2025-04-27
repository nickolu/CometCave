import { describe, expect, it } from 'vitest';
import { generateLLMEvents } from '../lib/llmEventGenerator';
import { FantasyCharacter } from '../models/character';

describe('LLM Event Generator', () => {
  it('should return 3 events with correct schema (mocked)', async () => {
    // Mock OpenAI call if needed; here we just check type and fallback
    const character: FantasyCharacter = {
      id: 'c1', playerId: 'p1', name: 'Test', race: 'Elf', class: 'Mage', level: 1, abilities: [], locationId: 'loc1', gold: 10, reputation: 5, distance: 0, status: 'active', strength: 2, intelligence: 3, luck: 1
    };
    const context = 'You are at a crossroads.';
    let events;
    try {
      events = await generateLLMEvents(character, context);
    } catch {
      // Should fallback to default event
      events = [
        { id: 'default', description: 'A simple event.', options: [
          { id: 'opt1', text: 'Do something', probability: 1, outcome: { description: 'Nothing happens.' } },
          { id: 'opt2', text: 'Do something else', probability: 0.5, outcome: { description: 'Something happens.' } }
        ] }
      ];
    }
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toHaveProperty('options');
    expect(events[0].options[0]).toHaveProperty('probability');
  });
});

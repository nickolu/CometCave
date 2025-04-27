import { FantasyCharacter } from '../models/character';
import { FantasyDecisionOption } from '../models/story';
import { applyEffects, calculateEffectiveProbability } from '../lib/eventResolution';
import { describe, expect, it } from 'vitest';

describe('Decision Resolution', () => {
  const baseChar: FantasyCharacter = {
    id: '1',
    playerId: 'p1',
    name: 'Test',
    race: 'Elf',
    class: 'Mage',
    level: 1,
    abilities: [],
    locationId: 'loc1',
    gold: 10,
    reputation: 5,
    distance: 0,
    status: 'active',
    strength: 2,
    intelligence: 3,
    luck: 1
  };

  it('applies simple effects', () => {
    const effects = { gold: 5, reputation: 2, distance: 1, statusChange: 'active' };
    const updated = applyEffects(baseChar, effects);
    expect(updated.gold).toBe(15);
    expect(updated.reputation).toBe(7);
    expect(updated.distance).toBe(1);
    expect(updated.status).toBe('active');
  });

  it('calculates probability with no attributes', () => {
    const option: FantasyDecisionOption = { id: 'o1', text: 'Try', baseProbability: 0.5 };
    expect(calculateEffectiveProbability(option, baseChar)).toBe(0.5);
  });

  it('calculates probability with attribute modifiers', () => {
    const option: FantasyDecisionOption = {
      id: 'o2',
      text: 'Test',
      baseProbability: 0.2,
      relevantAttributes: ['strength', 'luck'],
      attributeModifiers: { strength: 0.05, luck: 0.1 }
    };
    // 0.2 + (2*0.05) + (1*0.1) = 0.4
    expect(calculateEffectiveProbability(option, baseChar)).toBeCloseTo(0.4);
  });
});

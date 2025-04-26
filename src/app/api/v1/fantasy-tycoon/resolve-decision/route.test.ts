import { applyDecisionEffects } from './route';
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';
import { FantasyDecisionOption } from '@/app/fantasy-tycoon/models/story';

describe('applyDecisionEffects', () => {
  const baseCharacter: FantasyCharacter = {
    id: 'char1',
    playerId: 'player1',
    name: 'Hero',
    race: 'Elf',
    class: 'Ranger',
    level: 3,
    abilities: [],
    locationId: 'loc1',
    gold: 100,
    reputation: 10,
    distance: 5,
    status: 'active',
  };

  it('applies all effects', () => {
    const option: FantasyDecisionOption = {
      id: 'opt1',
      text: 'Brave action',
      effects: {
        gold: 50,
        reputation: 5,
        distance: 2,
        statusChange: 'retired',
      },
    };
    const updated = applyDecisionEffects(baseCharacter, option);
    expect(updated.gold).toBe(150);
    expect(updated.reputation).toBe(15);
    expect(updated.distance).toBe(7);
    expect(updated.status).toBe('retired');
  });

  it('applies partial effects', () => {
    const option: FantasyDecisionOption = {
      id: 'opt2',
      text: 'Greedy action',
      effects: {
        gold: -20,
      },
    };
    const updated = applyDecisionEffects(baseCharacter, option);
    expect(updated.gold).toBe(80);
    expect(updated.reputation).toBe(10);
    expect(updated.distance).toBe(5);
    expect(updated.status).toBe('active');
  });

  it('does nothing if no effects', () => {
    const option: FantasyDecisionOption = {
      id: 'opt3',
      text: 'Neutral action',
    };
    const updated = applyDecisionEffects(baseCharacter, option);
    expect(updated).toEqual(baseCharacter);
  });

  it('handles zero and negative values', () => {
    const option: FantasyDecisionOption = {
      id: 'opt4',
      text: 'Mixed action',
      effects: {
        gold: 0,
        reputation: -5,
        distance: 0,
      },
    };
    const updated = applyDecisionEffects(baseCharacter, option);
    expect(updated.gold).toBe(100);
    expect(updated.reputation).toBe(5);
    expect(updated.distance).toBe(5);
    expect(updated.status).toBe('active');
  });
});

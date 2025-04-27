import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rollEvent } from './route';
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';

const mockCharacter: FantasyCharacter = {
  id: 'c1',
  playerId: 'p1',
  name: 'Hero',
  race: 'Elf',
  class: 'Ranger',
  level: 2,
  abilities: [],
  locationId: 'loc1',
  gold: 100,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 7,
  intelligence: 8,
  luck: 6,
};

describe('rollEvent', () => {
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, 'random');
  });
  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('returns nothing event', () => {
    mathRandomSpy.mockReturnValue(0 / 4); // 0
    const result = rollEvent(mockCharacter);
    expect(result).toMatchObject({ event: null, decisionPoint: null, goldDelta: 0, reputationDelta: 0 });
  });

  it('returns gold event', () => {
    mathRandomSpy.mockReturnValue(1 / 4); // 1
    const result = rollEvent(mockCharacter);
    expect(result.event?.type).toBe('gain_gold');
    expect(result.goldDelta).toBe(10);
    expect(result.reputationDelta).toBe(0);
    expect(result.decisionPoint).toBeNull();
  });

  it('returns reputation event', () => {
    mathRandomSpy.mockReturnValue(2 / 4); // 2
    const result = rollEvent(mockCharacter);
    expect(result.event?.type).toBe('gain_reputation');
    expect(result.goldDelta).toBe(0);
    expect(result.reputationDelta).toBe(5);
    expect(result.decisionPoint).toBeNull();
  });

  it('returns decision point event', () => {
    mathRandomSpy.mockReturnValue(3 / 4); // 3
    const result = rollEvent(mockCharacter);
    expect(result.event?.type).toBe('decision_point');
    expect(result.decisionPoint).not.toBeNull();
    expect(result.goldDelta).toBe(0);
    expect(result.reputationDelta).toBe(0);
    expect(result.decisionPoint?.prompt).toContain('fork in the road');
  });
});

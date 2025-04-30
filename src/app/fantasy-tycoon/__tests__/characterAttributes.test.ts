import { describe, expect, it } from 'vitest';
import { FantasyCharacter } from '../models/character';

describe('Character Attribute Management', () => {
  it('should create a character with correct attributes', () => {
    const char: FantasyCharacter = {
      id: 'c1', playerId: 'p1', name: 'Test', race: 'Elf', class: 'Mage', level: 1, abilities: [], locationId: 'loc1', gold: 10, reputation: 5, distance: 0, status: 'active', strength: 2, intelligence: 3, luck: 1
    };
    expect(char.strength).toBe(2);
    expect(char.intelligence).toBe(3);
    expect(char.luck).toBe(1);
  });

  it('should update attributes correctly', () => {
    let char: FantasyCharacter = {
      id: 'c1', playerId: 'p1', name: 'Test', race: 'Elf', class: 'Mage', level: 1, abilities: [], locationId: 'loc1', gold: 10, reputation: 5, distance: 0, status: 'active', strength: 2, intelligence: 3, luck: 1
    };
    char = { ...char, strength: char.strength + 1 };
    expect(char.strength).toBe(3);
  });
});

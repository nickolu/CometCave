import { FantasyCharacter } from '../models/character';
import { FantasyDecisionOption } from '../models/story';

export function applyEffects(
  character: FantasyCharacter,
  effects?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
  }
): FantasyCharacter {
  if (!effects) return character;
  return {
    ...character,
    gold: character.gold + (effects.gold ?? 0),
    reputation: character.reputation + (effects.reputation ?? 0),
    distance: character.distance + (effects.distance ?? 0),
    status: effects.statusChange ? (effects.statusChange as FantasyCharacter['status']) : character.status,
  };
}

export function calculateEffectiveProbability(
  option: FantasyDecisionOption,
  character: FantasyCharacter
): number {
  const base = option.baseProbability ?? 1;
  if (!option.relevantAttributes || option.relevantAttributes.length === 0) {
    return Math.max(0, Math.min(1, base));
  }
  let modifier = 0;
  for (const attr of option.relevantAttributes) {
    const value = character[attr] ?? 0;
    const attrMod = option.attributeModifiers?.[attr] ?? 0.01;
    modifier += value * attrMod;
  }
  return Math.max(0, Math.min(1, base + modifier));
}

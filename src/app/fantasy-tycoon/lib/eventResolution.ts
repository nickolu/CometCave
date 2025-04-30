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
  const typedOption = option as {
    baseProbability?: number;
    relevantAttributes?: string[];
    attributeModifiers?: Record<string, number>;
  };
  const base = typedOption.baseProbability ?? 1;

  if (!typedOption.relevantAttributes || typedOption.relevantAttributes.length === 0) {
    return Math.max(0, Math.min(1, base));
  }

  let modifier = 0;
  for (const attr of typedOption.relevantAttributes) {
    const value = Number(character[attr as keyof typeof character] ?? 0);
    const attrMod = Number(typedOption.attributeModifiers?.[attr] ?? 0.01);
    modifier += value * attrMod;
  }
  return Math.max(0, Math.min(1, Number(base) + modifier));
}

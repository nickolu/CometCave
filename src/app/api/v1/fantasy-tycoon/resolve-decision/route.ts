import { NextRequest, NextResponse } from 'next/server';
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';
import { FantasyDecisionPoint, FantasyDecisionOption } from '@/app/fantasy-tycoon/models/story';

// Simulate applying the effects of a decision option to a character
type ResolveDecisionRequest = {
  character: FantasyCharacter;
  decisionPoint: FantasyDecisionPoint;
  optionId: string;
};

type ResolveDecisionResponse = {
  updatedCharacter: FantasyCharacter;
  resultDescription?: string;
  appliedEffects?: FantasyDecisionOption['effects'];
};

function applyEffects(
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

function calculateEffectiveProbability(
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


export async function POST(req: NextRequest) {
  console.log('Resolving decision...');
  try {
    const body = await req.json() as ResolveDecisionRequest;
    const { character, decisionPoint, optionId } = body;
    const option = decisionPoint.options.find(o => o.id === optionId);
    if (!option) {
      return NextResponse.json({ error: 'Invalid optionId' }, { status: 400 });
    }

    // If option has new resolution fields, use them
    let outcome: 'success' | 'failure' = 'success';
    let resultDescription = option.resultDescription;
    let appliedEffects = option.effects;
    let updatedCharacter = character;
    if (
      option.baseProbability !== undefined ||
      option.successEffects !== undefined ||
      option.failureEffects !== undefined
    ) {
      // Calculate effective probability
      const prob = calculateEffectiveProbability(option, character);
      const roll = Math.random();
      outcome = roll < prob ? 'success' : 'failure';
      if (outcome === 'success') {
        updatedCharacter = applyEffects(character, option.successEffects);
        resultDescription = option.successDescription ?? option.resultDescription;
        appliedEffects = option.successEffects;
      } else {
        updatedCharacter = applyEffects(character, option.failureEffects);
        resultDescription = option.failureDescription ?? option.resultDescription;
        appliedEffects = option.failureEffects;
      }
    } else {
      // Fallback to legacy logic
      updatedCharacter = applyEffects(character, option.effects);
      resultDescription = option.resultDescription;
      appliedEffects = option.effects;
    }

    return NextResponse.json<ResolveDecisionResponse>({
      updatedCharacter,
      resultDescription,
      appliedEffects,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: (err as Error).message }, { status: 400 });
  }
}


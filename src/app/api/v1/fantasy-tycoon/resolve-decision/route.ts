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
  selectedOptionId?: string;
  selectedOptionText?: string;
  outcomeDescription?: string;
  resourceDelta?: {
    gold?: number;
    reputation?: number;
    distance?: number;
    statusChange?: string;
  };
};

import { applyEffects, calculateEffectiveProbability } from '@/app/fantasy-tycoon/lib/eventResolution';


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
      selectedOptionId: option.id,
      selectedOptionText: option.text,
      outcomeDescription: resultDescription,
      resourceDelta: appliedEffects || {},
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: (err as Error).message }, { status: 400 });
  }
}


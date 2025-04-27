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

export function applyDecisionEffects(
  character: FantasyCharacter,
  option: FantasyDecisionOption
): FantasyCharacter {
  const effects = option.effects || {};
  return {
    ...character,
    gold: character.gold + (effects.gold ?? 0),
    reputation: character.reputation + (effects.reputation ?? 0),
    distance: character.distance + (effects.distance ?? 0),
    status: effects.statusChange ? (effects.statusChange as FantasyCharacter['status']) : character.status,
  };
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
    const updatedCharacter = applyDecisionEffects(character, option);
    return NextResponse.json<ResolveDecisionResponse>({
      updatedCharacter,
      resultDescription: option.resultDescription,
      appliedEffects: option.effects,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: (err as Error).message }, { status: 400 });
  }
}

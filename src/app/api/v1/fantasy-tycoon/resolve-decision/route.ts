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

import extractRewardItemsFromText from '@/app/fantasy-tycoon/lib/extractRewardItemsFromText';
import { Item } from '@/app/fantasy-tycoon/models/item';



export async function POST(req: NextRequest) {
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
    let rewardItems: Item[] = [];
    let extractedRewardItems: Item[] = [];
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
        const effects = option.successEffects as {
          gold?: number;
          reputation?: number;
          distance?: number;
          statusChange?: string;
          rewardItems?: { id: string; name: string; description: string; quantity: number }[];
        } | undefined;
        updatedCharacter = applyEffects(character, effects);
        resultDescription = option.successDescription ?? option.resultDescription;
        appliedEffects = option.successEffects;
        if (effects?.rewardItems) {
          rewardItems = effects.rewardItems;
        }
      } else {
        const effects = option.failureEffects as {
          gold?: number;
          reputation?: number;
          distance?: number;
          statusChange?: string;
          rewardItems?: { id: string; name: string; description: string; quantity: number }[];
        } | undefined;
        updatedCharacter = applyEffects(character, effects);
        resultDescription = option.failureDescription ?? option.resultDescription;
        appliedEffects = option.failureEffects;
        if (effects?.rewardItems) {
          rewardItems = effects.rewardItems;
        }
      }
      // LLM/Heuristic extraction from outcome text
      if (resultDescription && typeof resultDescription === 'string') {
        extractedRewardItems = await extractRewardItemsFromText(resultDescription);
        if (extractedRewardItems.length > 0) {
          // Merge with any rewardItems already present
          rewardItems = [...rewardItems, ...extractedRewardItems];
        }
      }
    } else {
      // Fallback to legacy logic
      const effects = option.effects as {
        gold?: number;
        reputation?: number;
        distance?: number;
        statusChange?: string;
        rewardItems?: { id: string; name: string; description: string; quantity: number }[];
      } | undefined;
      updatedCharacter = applyEffects(character, effects);
      resultDescription = option.resultDescription;
      appliedEffects = option.effects;
      if (effects?.rewardItems) {
        rewardItems = effects.rewardItems;
      }
      // LLM/Heuristic extraction from outcome text
      if (resultDescription && typeof resultDescription === 'string') {
        extractedRewardItems = await extractRewardItemsFromText(resultDescription);
        if (extractedRewardItems.length > 0) {
          rewardItems = [...rewardItems, ...extractedRewardItems];
        }
      }
    }

    // Collect reward items from all possible sources
    // 1. Root-level rewardItems on the option
    const typedOption = option as {
      rewardItems?: { id: string; name: string; description: string; quantity: number }[];
      text?: string;
      resultDescription?: string;
    };
    if (typedOption.rewardItems && Array.isArray(typedOption.rewardItems)) {
      rewardItems = [...rewardItems, ...typedOption.rewardItems];
    }
    // 2. Already merged in effects, successEffects, failureEffects, and LLM extraction above

    // Build response
    // Extend response type to include rewardItems for client inventory patching
    const response: ResolveDecisionResponse & { rewardItems?: Item[] } = {
      updatedCharacter,
      resultDescription: resultDescription as string | undefined,
      appliedEffects,
      selectedOptionId: optionId,
      selectedOptionText: typedOption.text,
      outcomeDescription: resultDescription as string | undefined,
      resourceDelta: appliedEffects as { gold?: number; reputation?: number; distance?: number; statusChange?: string } | undefined,
      rewardItems: rewardItems.length > 0 ? rewardItems : undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: (err as Error).message }, { status: 400 });
  }
}

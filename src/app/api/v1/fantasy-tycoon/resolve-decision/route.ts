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
import { addItem } from '@/app/fantasy-tycoon/lib/inventory';
import { Item } from '@/app/fantasy-tycoon/models/item';
import { RewardItem } from '@/app/fantasy-tycoon/models/story';


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
    let rewardItems: RewardItem[] = [];
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
        if (option.successEffects?.rewardItems) {
          rewardItems = option.successEffects.rewardItems;
        }
      } else {
        updatedCharacter = applyEffects(character, option.failureEffects);
        resultDescription = option.failureDescription ?? option.resultDescription;
        appliedEffects = option.failureEffects;
        if (option.failureEffects?.rewardItems) {
          rewardItems = option.failureEffects.rewardItems;
        }
      }
    } else {
      // Fallback to legacy logic
      updatedCharacter = applyEffects(character, option.effects);
      resultDescription = option.resultDescription;
      appliedEffects = option.effects;
      if (option.effects?.rewardItems) {
        rewardItems = option.effects.rewardItems;
      }
    }

    // Inventory integration: add reward items to inventory
    let updatedInventory: Item[] = [];
    if (rewardItems.length > 0) {
      // Load current inventory from localStorage (if present)
      let gameState: import('@/app/fantasy-tycoon/lib/storage').GameState | undefined = undefined;
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('fantasy-tycoon-save');
          if (raw) {
            gameState = JSON.parse(raw);
          }
        }
      } catch {}
      if (!gameState) {
        gameState = {
          player: { id: 'player-1', settings: {} },
          character: null,
          locations: [],
          storyEvents: [],
          decisionPoint: null,
          genericMessage: null,
          inventory: [],
        };
      }
      rewardItems.forEach(reward => {
        // You'd want to look up item name, icon, etc. by id in a real app
        const item: Item = {
          id: reward.id,
          name: reward.id, // Placeholder, should resolve from item DB
          description: '',
          icon: '',
          quantity: reward.qty,
        };
        gameState = addItem(gameState!, item);
      });
      updatedInventory = gameState.inventory;
      // Persist updated inventory
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('fantasy-tycoon-save', JSON.stringify(gameState));
        }
      } catch {}
    }

    // Build response
    const response: ResolveDecisionResponse & { rewardItems?: RewardItem[], newInventory?: Item[] } = {
      updatedCharacter,
      resultDescription,
      appliedEffects,
      selectedOptionId: optionId,
      selectedOptionText: option.text,
      outcomeDescription: resultDescription,
      resourceDelta: appliedEffects,
      rewardItems: rewardItems.length > 0 ? rewardItems : undefined,
      newInventory: updatedInventory.length > 0 ? updatedInventory : undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: (err as Error).message }, { status: 400 });
  }
}

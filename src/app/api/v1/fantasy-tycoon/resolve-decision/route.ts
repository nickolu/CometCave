import { NextRequest, NextResponse } from 'next/server'

import {
  applyEffects,
  calculateEffectiveProbability,
} from '@/app/fantasy-tycoon/lib/eventResolution'
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'
import { Item } from '@/app/fantasy-tycoon/models/item'
import { FantasyDecisionOption, FantasyDecisionPoint } from '@/app/fantasy-tycoon/models/story'


type ResolveDecisionRequest = {
  character: FantasyCharacter
  decisionPoint: FantasyDecisionPoint
  optionId: string
}

type ResolveDecisionResponse = {
  updatedCharacter: FantasyCharacter
  resultDescription?: string
  appliedEffects?: FantasyDecisionOption['effects']
  selectedOptionId?: string
  selectedOptionText?: string
  outcomeDescription?: string
  resourceDelta?: {
    gold?: number
    reputation?: number
    distance?: number
    statusChange?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResolveDecisionRequest

    const { character, decisionPoint, optionId } = body
    const option = decisionPoint.options.find(o => o.id === optionId)
    if (!option) {
      return NextResponse.json({ error: 'Invalid optionId' }, { status: 400 })
    }

    let outcome: 'success' | 'failure' = 'success'
    let resultDescription = option.resultDescription
    let appliedEffects = option.effects
    let updatedCharacter = character
    let rewardItems: Item[] = []

    if (
      option.successProbability !== undefined ||
      option.successEffects !== undefined ||
      option.failureEffects !== undefined
    ) {
      const prob = calculateEffectiveProbability(option, character)
      const roll = Math.random()
      outcome = roll < prob ? 'success' : 'failure'

      if (outcome === 'success') {
        const effects = option.successEffects
        updatedCharacter = applyEffects(character, effects)
        resultDescription = option.successDescription ?? option.resultDescription
        appliedEffects = option.successEffects
        if (effects?.rewardItems) {
          rewardItems = effects.rewardItems
        }
      } else {
        const effects = option.failureEffects
        updatedCharacter = applyEffects(character, effects)
        resultDescription = option.failureDescription ?? option.resultDescription
        appliedEffects = option.failureEffects
        if (effects?.rewardItems) {
          rewardItems = effects.rewardItems
        }
      }
    } else {
      const effects = option.effects
      updatedCharacter = applyEffects(character, effects)
      resultDescription = option.resultDescription
      appliedEffects = option.effects
      if (effects?.rewardItems) {
        rewardItems = effects.rewardItems
      }
    }

    const typedOption = option
    if (typedOption.rewardItems && Array.isArray(typedOption.rewardItems)) {
      rewardItems = [...rewardItems, ...typedOption.rewardItems]
    }
    const response: ResolveDecisionResponse & { rewardItems?: Item[] } = {
      updatedCharacter,
      resultDescription: resultDescription,
      appliedEffects,
      selectedOptionId: optionId,
      selectedOptionText: typedOption.text,
      outcomeDescription: resultDescription,
      resourceDelta: appliedEffects,
      rewardItems: rewardItems.length > 0 ? rewardItems : undefined,
    }

    return NextResponse.json(response)
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request', details: (err as Error).message },
      { status: 400 }
    )
  }
}

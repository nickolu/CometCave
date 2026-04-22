import { NextRequest, NextResponse } from 'next/server'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import {
  applyEffects,
  calculateEffectiveProbability,
} from '@/app/tap-tap-adventure/lib/eventResolution'
import { generateLLMEvents } from '@/app/tap-tap-adventure/lib/llmEventGenerator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { FantasyDecisionOption, FantasyDecisionPoint, FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'

type ResolveDecisionRequest = {
  character: FantasyCharacter
  decisionPoint: FantasyDecisionPoint
  optionId: string
  storyEvents?: FantasyStoryEvent[]
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
  mountDamage?: number
  mountDied?: boolean
  decisionPoint?: FantasyDecisionPoint | null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResolveDecisionRequest

    const { character, decisionPoint, optionId, storyEvents = [] } = body
    const option = decisionPoint.options.find(o => o.id === optionId)
    if (!option) {
      return NextResponse.json({ error: 'Invalid optionId' }, { status: 400 })
    }

    // Handle explore-landmark: increment nextLandmarkIndex, call LLM with landmark context
    if (optionId === 'explore-landmark') {
      const landmarkState = character.landmarkState
      const exploredLandmark = landmarkState?.landmarks[landmarkState.nextLandmarkIndex]

      const updatedLandmarkState = landmarkState
        ? {
            ...landmarkState,
            nextLandmarkIndex: landmarkState.nextLandmarkIndex + 1,
            exploring: true,
          }
        : undefined

      const updatedCharacter: FantasyCharacter = {
        ...character,
        landmarkState: updatedLandmarkState,
      }

      // Build enriched context with landmark's encounterPrompt prepended
      const MAX_CONTEXT = 1500
      const baseContext = buildStoryContext(character, storyEvents)
      const landmarkPrefix = exploredLandmark
        ? `Landmark: ${exploredLandmark.name} (${exploredLandmark.type}). ${exploredLandmark.encounterPrompt}\n\n`
        : ''
      const combined = landmarkPrefix + baseContext
      const enrichedContext = combined.length > MAX_CONTEXT ? combined.slice(0, MAX_CONTEXT) : combined

      try {
        const llmEvents = await generateLLMEvents(updatedCharacter, enrichedContext)
        const llmEvent = llmEvents[0]

        const explorationDecisionPoint: FantasyDecisionPoint = {
          id: `decision-${llmEvent.id}`,
          eventId: llmEvent.id,
          prompt: llmEvent.description,
          options: llmEvent.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            successProbability: opt.successProbability,
            successDescription: opt.successDescription,
            successEffects: opt.successEffects,
            failureDescription: opt.failureDescription,
            failureEffects: opt.failureEffects,
            resultDescription: opt.successDescription,
            triggersCombat: opt.triggersCombat,
          })),
          resolved: false,
        }

        const response: ResolveDecisionResponse & { rewardItems?: Item[]; triggersCombat?: boolean } = {
          updatedCharacter,
          resultDescription: `You venture into ${exploredLandmark?.name ?? 'the landmark'}.`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You venture into ${exploredLandmark?.name ?? 'the landmark'} to explore.`,
          resourceDelta: {},
          decisionPoint: explorationDecisionPoint,
        }

        return NextResponse.json(response)
      } catch (err) {
        console.error('explore-landmark LLM generation failed', err)
        // Fallback: return a generic response without a new decision point
        const fallbackResponse: ResolveDecisionResponse & { rewardItems?: Item[]; triggersCombat?: boolean } = {
          updatedCharacter,
          resultDescription: `You explore ${exploredLandmark?.name ?? 'the landmark'} but find nothing remarkable.`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You explore ${exploredLandmark?.name ?? 'the landmark'} but find nothing remarkable.`,
          resourceDelta: {},
        }
        return NextResponse.json(fallbackResponse)
      }
    }

    // Scale gold rewards by region difficulty so harder regions give better non-combat rewards
    const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier

    function scaleGold(effects?: { gold?: number; [key: string]: unknown }) {
      if (!effects || !effects.gold || effects.gold <= 0) return effects
      return { ...effects, gold: Math.round(effects.gold * regionMult) }
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
        const effects = scaleGold(option.successEffects)
        updatedCharacter = applyEffects(character, effects)
        resultDescription = option.successDescription ?? option.resultDescription
        appliedEffects = effects
        if (effects?.rewardItems) {
          rewardItems = (effects as { rewardItems: Item[] }).rewardItems
        }
      } else {
        const effects = scaleGold(option.failureEffects)
        updatedCharacter = applyEffects(character, effects)
        resultDescription = option.failureDescription ?? option.resultDescription
        appliedEffects = effects
        if (effects?.rewardItems) {
          rewardItems = (effects as { rewardItems: Item[] }).rewardItems
        }
      }
    } else {
      const effects = scaleGold(option.effects)
      updatedCharacter = applyEffects(character, effects)
      resultDescription = option.resultDescription
      appliedEffects = effects
      if (effects?.rewardItems) {
        rewardItems = (effects as { rewardItems: Item[] }).rewardItems
      }
    }

    // Default reputation fallback: if no reputation effect was applied, nudge +1 for success, -1 for failure
    const typedOpt = option as FantasyDecisionOption
    if (!typedOpt.triggersCombat && (appliedEffects as Record<string, unknown>)?.reputation === undefined) {
      const defaultRep = outcome === 'success' ? 1 : -1
      appliedEffects = { ...appliedEffects, reputation: defaultRep }
      updatedCharacter = { ...updatedCharacter, reputation: (updatedCharacter.reputation ?? 0) + defaultRep }
    }

    const typedOption = option
    if (typedOption.rewardItems && Array.isArray(typedOption.rewardItems)) {
      rewardItems = [...rewardItems, ...typedOption.rewardItems]
    }

    const mountDied = !!character.activeMount && !updatedCharacter.activeMount
    const mountDamageAmt =
      character.activeMount && updatedCharacter.activeMount
        ? (character.activeMount.hp ?? character.activeMount.maxHp ?? 0) -
          (updatedCharacter.activeMount.hp ?? 0)
        : undefined

    const response: ResolveDecisionResponse & { rewardItems?: Item[]; triggersCombat?: boolean } = {
      updatedCharacter,
      resultDescription: resultDescription,
      appliedEffects,
      selectedOptionId: optionId,
      selectedOptionText: typedOption.text,
      outcomeDescription: resultDescription,
      resourceDelta: appliedEffects,
      rewardItems: rewardItems.length > 0 ? rewardItems : undefined,
      triggersCombat: typedOption.triggersCombat,
      mountDied: mountDied || undefined,
      mountDamage: mountDamageAmt && mountDamageAmt > 0 ? mountDamageAmt : undefined,
    }

    return NextResponse.json(response)
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request', details: (err as Error).message },
      { status: 400 }
    )
  }
}

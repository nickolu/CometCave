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

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return hash
}

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

    // Handle continue-exploring: generate next encounter in landmark chain
    if (optionId === 'continue-exploring') {
      const landmarkState = character.landmarkState
      if (!landmarkState?.exploring || !landmarkState.exploringLandmarkName) {
        return NextResponse.json({ error: 'Not currently exploring a landmark' }, { status: 400 })
      }

      const currentDepth = (landmarkState.explorationDepth ?? 1)
      const newDepth = currentDepth + 1

      const updatedLandmarkState = {
        ...landmarkState,
        explorationDepth: newDepth,
      }

      const updatedCharacter: FantasyCharacter = {
        ...character,
        landmarkState: updatedLandmarkState,
      }

      // Build context with depth info
      const MAX_CONTEXT = 1500
      const baseContext = buildStoryContext(character, storyEvents)
      const depthPrefix = `You are exploring deeper into ${landmarkState.exploringLandmarkName}. This is encounter ${newDepth} of your exploration. The player has been exploring for a while — make this encounter more interesting or rewarding than earlier ones. Previous exploration choices are reflected in the story context.\n\n`
      const combined = depthPrefix + baseContext
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

        return NextResponse.json({
          updatedCharacter,
          resultDescription: `You venture deeper into ${landmarkState.exploringLandmarkName}...`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: 'Continue exploring',
          outcomeDescription: `You continue exploring ${landmarkState.exploringLandmarkName}.`,
          resourceDelta: {},
          decisionPoint: explorationDecisionPoint,
        })
      } catch (err) {
        console.error('continue-exploring LLM generation failed', err)
        const fallbackId = `fallback-explore-${Date.now()}`
        const fallbackDecisionPoint: FantasyDecisionPoint = {
          id: `decision-${fallbackId}`,
          eventId: fallbackId,
          prompt: `You explore ${landmarkState.exploringLandmarkName}, but the area seems quiet for now. What would you like to do?`,
          options: [
            {
              id: 'continue-exploring',
              text: 'Continue Exploring',
              successProbability: 1.0,
              successDescription: 'You press on, searching for something of interest.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You press on, searching for something of interest.',
            },
            {
              id: 'leave-landmark',
              text: 'Leave Landmark',
              successProbability: 1.0,
              successDescription: 'You decide to move on from this place.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You decide to move on from this place.',
            },
          ],
          resolved: false,
        }
        return NextResponse.json({
          updatedCharacter,
          resultDescription: `You've explored all there is to see in ${landmarkState.exploringLandmarkName}.`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: 'Continue exploring',
          outcomeDescription: `There is nothing more to find in ${landmarkState.exploringLandmarkName}.`,
          resourceDelta: {},
          decisionPoint: fallbackDecisionPoint,
        })
      }
    }

    // Handle explore-landmark: use activeTargetIndex to find the landmark the player walked to
    if (optionId === 'explore-landmark') {
      const landmarkState = character.landmarkState
      const targetIndex = landmarkState?.activeTargetIndex ?? 0
      const exploredLandmark = landmarkState?.landmarks[targetIndex]

      const updatedLandmarkState = landmarkState
        ? {
            ...landmarkState,
            // Don't auto-advance indexes — player stays at this landmark until they leave
            nextLandmarkIndex: targetIndex,
            exploring: true,
            explorationDepth: 1,
            exploringLandmarkName: exploredLandmark?.name ?? 'the landmark',
          }
        : undefined

      const updatedCharacter: FantasyCharacter = {
        ...character,
        landmarkState: updatedLandmarkState,
      }

      // Build enriched context with landmark's encounterPrompt prepended
      const MAX_CONTEXT = 1500
      const baseContext = buildStoryContext(character, storyEvents)
      const explorationDepth = updatedLandmarkState?.explorationDepth ?? 1
      const landmarkPrefix = exploredLandmark
        ? `Landmark: ${exploredLandmark.name} (${exploredLandmark.type}). ${exploredLandmark.encounterPrompt}\nExploration depth: ${explorationDepth}. Scale rewards with depth — deeper encounters should have greater risks and greater rewards.\n\n`
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
        const fallbackId = `fallback-explore-${Date.now()}`
        const fallbackDecisionPoint: FantasyDecisionPoint = {
          id: `decision-${fallbackId}`,
          eventId: fallbackId,
          prompt: `You explore ${exploredLandmark?.name ?? 'the landmark'} and discover a dimly lit chamber. Ancient symbols line the walls, and you notice what could be hidden compartments. What would you like to do?`,
          options: [
            {
              id: 'search-treasure',
              text: 'Search for hidden treasure',
              successProbability: 0.7,
              successDescription: 'You find a hidden cache of coins and supplies!',
              successEffects: { gold: 15, reputation: 1 },
              failureDescription: 'You trigger a trap while searching! A dart grazes your arm.',
              failureEffects: { gold: -5, statusChange: 'Wounded' },
              resultDescription: 'You search the area thoroughly.',
            },
            {
              id: 'continue-exploring',
              text: 'Continue Exploring cautiously',
              successProbability: 0.9,
              successDescription: 'You find a few coins and something interesting.',
              successEffects: { gold: 5 },
              failureDescription: 'The area proves difficult to navigate.',
              failureEffects: {},
              resultDescription: 'You explore cautiously.',
            },
            {
              id: 'leave-landmark',
              text: 'Leave Landmark',
              successProbability: 1.0,
              successDescription: 'You decide to move on from this place.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You decide to move on from this place.',
            },
          ],
          resolved: false,
        }
        const fallbackResponse: ResolveDecisionResponse & { rewardItems?: Item[]; triggersCombat?: boolean } = {
          updatedCharacter,
          resultDescription: `You explore ${exploredLandmark?.name ?? 'the landmark'} but find nothing remarkable.`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You explore ${exploredLandmark?.name ?? 'the landmark'} but find nothing remarkable.`,
          resourceDelta: {},
          decisionPoint: fallbackDecisionPoint,
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

    // If exploring a landmark, append continue/leave options as next decision
    const currentLandmarkState = updatedCharacter.landmarkState
    if (currentLandmarkState?.exploring && currentLandmarkState.exploringLandmarkName) {
      const depth = currentLandmarkState.explorationDepth ?? 1
      const maxDepth = 2 + Math.floor(Math.abs(hashString(currentLandmarkState.exploringLandmarkName)) % 4)

      // Find the currently-explored landmark to check isSecret
      const exploredLandmarkIndex = currentLandmarkState.activeTargetIndex ?? 0
      const exploredLandmark = currentLandmarkState.landmarks[exploredLandmarkIndex]
      const isSecretLandmark = exploredLandmark?.isSecret === true

      if (depth < maxDepth) {
        const continueDecision: FantasyDecisionPoint = {
          id: `decision-continue-${Date.now()}`,
          eventId: `continue-explore-${Date.now()}`,
          prompt: `You pause and look around ${currentLandmarkState.exploringLandmarkName}. There seems to be more to discover... (Encounter ${depth} of ~${maxDepth})`,
          options: [
            {
              id: 'continue-exploring',
              text: `Keep exploring ${currentLandmarkState.exploringLandmarkName}`,
              successProbability: 1.0,
              successDescription: `You venture deeper into ${currentLandmarkState.exploringLandmarkName}.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You continue exploring.`,
            },
            {
              id: 'leave-landmark',
              text: 'Leave and continue your journey',
              successProbability: 1.0,
              successDescription: `You step back outside and continue on your way.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You leave ${currentLandmarkState.exploringLandmarkName}.`,
            },
          ],
          resolved: false,
        }
        response.decisionPoint = continueDecision
      } else if (isSecretLandmark) {
        // Max depth reached on a secret landmark — boss encounter instead of ending
        const guardianDecision: FantasyDecisionPoint = {
          id: `decision-guardian-${Date.now()}`,
          eventId: `guardian-${Date.now()}`,
          prompt: `As you reach the innermost sanctum of ${currentLandmarkState.exploringLandmarkName}, a powerful guardian emerges from the shadows. This ancient protector has watched over this secret place since time immemorial. The air crackles with dangerous energy — this will be no ordinary fight.`,
          options: [
            {
              id: 'fight-secret-boss',
              text: 'Face the Guardian',
              successProbability: 1.0,
              successDescription: 'You steel yourself and charge at the guardian!',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You engage the guardian in battle!',
              triggersCombat: true,
            },
            {
              id: 'leave-landmark',
              text: 'Retreat — this is too dangerous',
              successProbability: 1.0,
              successDescription: 'You back away carefully and slip out of the sanctum.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You retreat from ${currentLandmarkState.exploringLandmarkName}.`,
            },
          ],
          resolved: false,
        }
        response.decisionPoint = guardianDecision
      } else {
        // Max depth reached on a normal landmark — end exploration, mark as explored
        // Award completion bonus scaled by region difficulty
        const completionGold = Math.round(20 * regionMult)
        const completionRep = 2

        updatedCharacter = {
          ...updatedCharacter,
          gold: (updatedCharacter.gold ?? 0) + completionGold,
          reputation: (updatedCharacter.reputation ?? 0) + completionRep,
        }

        const updatedLandmarks = currentLandmarkState.landmarks.map(lm =>
          lm.name === currentLandmarkState.exploringLandmarkName
            ? { ...lm, explored: true }
            : lm
        )
        updatedCharacter = {
          ...updatedCharacter,
          landmarkState: {
            ...currentLandmarkState,
            landmarks: updatedLandmarks,
            exploring: false,
            explorationDepth: 0,
            exploringLandmarkName: undefined,
          },
        }

        response.outcomeDescription = `${response.outcomeDescription ?? ''} You've explored everything ${currentLandmarkState.exploringLandmarkName} has to offer. Exploration complete! +${completionGold} gold, +${completionRep} reputation.`
        response.updatedCharacter = updatedCharacter
        response.appliedEffects = { ...response.appliedEffects, gold: completionGold, reputation: completionRep }
      }
    }

    return NextResponse.json(response)
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request', details: (err as Error).message },
      { status: 400 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { buildStoryContext, clampGold } from '@/app/tap-tap-adventure/lib/contextBuilder'
import {
  applyEffects,
  calculateEffectiveProbability,
} from '@/app/tap-tap-adventure/lib/eventResolution'
import { generateLLMEvents } from '@/app/tap-tap-adventure/lib/llmEventGenerator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { FantasyDecisionOption, FantasyDecisionPoint, FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'
import { getNPCsForRegion } from '@/app/tap-tap-adventure/config/npcs'

function buildNPCOptions(regionId: string): FantasyDecisionOption[] {
  const regionNPCs = getNPCsForRegion(regionId)
  return regionNPCs.map(npc => ({
    id: `talk-to-npc-${npc.id}`,
    text: `${npc.icon} Talk to ${npc.name} — ${npc.role}`,
    successProbability: 1.0,
    successDescription: `You approach ${npc.name}.`,
    successEffects: {},
    failureDescription: '',
    failureEffects: {},
    resultDescription: `You talk to ${npc.name}.`,
  }))
}

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

    // Handle pay-bounty: pay bounty to enter town
    if (optionId === 'pay-bounty') {
      const landmarkState = character.landmarkState
      const targetIndex = landmarkState?.activeTargetIndex ?? 0
      const townLandmark = landmarkState?.landmarks[targetIndex]
      const bountyAmount = character.bounty ?? 0

      if ((character.gold ?? 0) < bountyAmount) {
        return NextResponse.json({
          updatedCharacter: character,
          resultDescription: `You don't have enough gold to pay your bounty of ${bountyAmount} gold.`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You need ${bountyAmount} gold but only have ${character.gold ?? 0}.`,
          resourceDelta: {},
        })
      }

      // Pay bounty and enter town (same as enter-town flow)
      const updatedLandmarkState = landmarkState
        ? {
            ...landmarkState,
            exploring: true,
            explorationDepth: 0,
            exploringLandmarkName: townLandmark?.name ?? 'the town',
          }
        : undefined

      const updatedCharacter: FantasyCharacter = {
        ...character,
        gold: clampGold((character.gold ?? 0) - bountyAmount),
        bounty: 0,
        landmarkState: updatedLandmarkState,
      }

      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      // Return the standard town hub (same as enter-town)
      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `You pay your ${bountyAmount} gold bounty to the guards. Your name is cleared! Welcome to ${townLandmark?.name ?? 'the town'}. What would you like to do?`,
        options: [
          {
            id: 'visit-shop', text: '🏪 Visit the Shop', successProbability: 1.0,
            successDescription: 'You browse the wares.', successEffects: {},
            failureDescription: '', failureEffects: {}, resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn', text: `🛏️ Rest at the Inn (${innCost} gold)`, successProbability: 1.0,
            successDescription: `You pay ${innCost} gold for rest.`, successEffects: {},
            failureDescription: '', failureEffects: {}, resultDescription: 'You rest.',
          },
          {
            id: 'hire-transport', text: '🐴 Hire Transport', successProbability: 1.0,
            successDescription: 'You check transport.', successEffects: {},
            failureDescription: '', failureEffects: {}, resultDescription: 'You check transport.',
          },
          {
            id: 'visit-stable', text: '🐴 Visit the Stable', successProbability: 1.0,
            successDescription: 'You visit the stable to manage your mounts.', successEffects: {},
            failureDescription: '', failureEffects: {}, resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox', text: '📬 Check Mailbox', successProbability: 1.0,
            successDescription: 'You check your mailbox for messages.', successEffects: {},
            failureDescription: '', failureEffects: {}, resultDescription: 'You check your mailbox.',
          },
          {
            id: 'leave-town', text: '🚪 Leave Town', successProbability: 1.0,
            successDescription: 'You leave.', successEffects: {},
            failureDescription: '', failureEffects: {}, resultDescription: `You leave.`,
          },
        ],
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter,
        resultDescription: `You pay your ${bountyAmount} gold bounty. Your name is cleared!`,
        appliedEffects: { gold: -bountyAmount },
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: `Bounty paid! (-${bountyAmount} gold)`,
        resourceDelta: { gold: -bountyAmount },
        decisionPoint: townHub,
        shopEvent: true,
      })
    }

    // Handle sneak-into-town: risky attempt to enter town with bounty
    if (optionId === 'sneak-into-town') {
      const landmarkState = character.landmarkState
      const targetIndex = landmarkState?.activeTargetIndex ?? 0
      const townLandmark = landmarkState?.landmarks[targetIndex]
      const bountyAmount = character.bounty ?? 0

      // Success based on luck (higher luck = better chance)
      const luckBonus = Math.min(0.3, (character.luck ?? 0) * 0.02)
      const sneakChance = 0.35 + luckBonus
      const success = Math.random() < sneakChance

      if (success) {
        // Sneak in successfully — enter town but bounty remains
        const updatedLandmarkState = landmarkState
          ? {
              ...landmarkState,
              exploring: true,
              explorationDepth: 0,
              exploringLandmarkName: townLandmark?.name ?? 'the town',
            }
          : undefined

        const updatedCharacter: FantasyCharacter = {
          ...character,
          landmarkState: updatedLandmarkState,
        }

        const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
        const innCost = Math.round(10 * regionMult)

        const townHub: FantasyDecisionPoint = {
          id: `decision-town-hub-${Date.now()}`,
          eventId: `town-hub-${Date.now()}`,
          prompt: `You slip past the guards! You're inside ${townLandmark?.name ?? 'the town'}, but keep a low profile — your bounty is still active. What would you like to do?`,
          options: [
            {
              id: 'visit-shop', text: '🏪 Visit the Shop', successProbability: 1.0,
              successDescription: 'You browse the wares.', successEffects: {},
              failureDescription: '', failureEffects: {}, resultDescription: 'You visit the shop.',
            },
            {
              id: 'rest-at-inn', text: `🛏️ Rest at the Inn (${innCost} gold)`, successProbability: 1.0,
              successDescription: 'You rest.', successEffects: {},
              failureDescription: '', failureEffects: {}, resultDescription: 'You rest.',
            },
            {
              id: 'hire-transport', text: '🐴 Hire Transport', successProbability: 1.0,
              successDescription: 'You check transport.', successEffects: {},
              failureDescription: '', failureEffects: {}, resultDescription: 'You check transport.',
            },
            {
              id: 'visit-stable', text: '🐴 Visit the Stable', successProbability: 1.0,
              successDescription: 'You visit the stable to manage your mounts.', successEffects: {},
              failureDescription: '', failureEffects: {}, resultDescription: 'You visit the stable.',
            },
            {
              id: 'check-mailbox', text: '📬 Check Mailbox', successProbability: 1.0,
              successDescription: 'You check your mailbox for messages.', successEffects: {},
              failureDescription: '', failureEffects: {}, resultDescription: 'You check your mailbox.',
            },
            {
              id: 'leave-town', text: '🚪 Leave Town', successProbability: 1.0,
              successDescription: 'You leave.', successEffects: {},
              failureDescription: '', failureEffects: {}, resultDescription: 'You leave.',
            },
          ],
          resolved: false,
        }

        return NextResponse.json({
          updatedCharacter,
          resultDescription: `You successfully sneak into ${townLandmark?.name ?? 'the town'}!`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You slip past the guards unnoticed.`,
          resourceDelta: {},
          decisionPoint: townHub,
          shopEvent: true,
        })
      } else {
        // Failed sneak — bounty increases by 25%
        const bountyIncrease = Math.max(5, Math.ceil(bountyAmount * 0.25))
        const updatedCharacter: FantasyCharacter = {
          ...character,
          bounty: bountyAmount + bountyIncrease,
        }

        return NextResponse.json({
          updatedCharacter,
          resultDescription: `The guards spot you! "Halt! Your bounty just went up!" (+${bountyIncrease} bounty)`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You're caught trying to sneak in! Bounty increased to ${bountyAmount + bountyIncrease} gold.`,
          resourceDelta: {},
        })
      }
    }

    // Handle pay-bounty-hunter: pay bounty to the hunter
    if (optionId === 'pay-bounty-hunter') {
      const bountyAmount = character.bounty ?? 0

      if ((character.gold ?? 0) < bountyAmount) {
        return NextResponse.json({
          updatedCharacter: character,
          resultDescription: `You don't have enough gold. The bounty hunter draws their weapon!`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You can't afford to pay. The hunter attacks!`,
          resourceDelta: {},
          triggersCombat: true,
        })
      }

      const updatedCharacter: FantasyCharacter = {
        ...character,
        gold: clampGold((character.gold ?? 0) - bountyAmount),
        bounty: 0,
      }

      return NextResponse.json({
        updatedCharacter,
        resultDescription: `You hand over ${bountyAmount} gold. The bounty hunter nods and disappears into the shadows. Your name is cleared.`,
        appliedEffects: { gold: -bountyAmount },
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: `Bounty paid! (-${bountyAmount} gold). Your record is clean.`,
        resourceDelta: { gold: -bountyAmount },
      })
    }

    // Handle enter-town: set up town hub and present town menu
    if (optionId === 'enter-town') {
      const landmarkState = character.landmarkState
      const targetIndex = landmarkState?.activeTargetIndex ?? 0
      const townLandmark = landmarkState?.landmarks[targetIndex]

      const updatedLandmarkState = landmarkState
        ? {
            ...landmarkState,
            exploring: true,
            explorationDepth: 0,
            exploringLandmarkName: townLandmark?.name ?? 'the town',
          }
        : undefined

      const updatedCharacter: FantasyCharacter = {
        ...character,
        landmarkState: updatedLandmarkState,
      }

      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `Welcome to ${townLandmark?.name ?? 'the town'}! The town square is alive with merchants, travelers, and townsfolk going about their day. What would you like to do?`,
        options: [
          {
            id: 'visit-shop',
            text: '🏪 Visit the Shop',
            successProbability: 1.0,
            successDescription: 'You browse the merchant\'s wares.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn',
            text: `🛏️ Rest at the Inn (${innCost} gold)`,
            successProbability: 1.0,
            successDescription: `You pay ${innCost} gold for a warm meal and a soft bed. You feel completely refreshed!`,
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You rest at the inn for ${innCost} gold.`,
          },
          {
            id: 'hire-transport',
            text: '🐴 Hire Transport',
            successProbability: 1.0,
            successDescription: 'You check the transport board for available destinations.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check available transport.',
          },
          {
            id: 'visit-stable',
            text: '🐴 Visit the Stable',
            successProbability: 1.0,
            successDescription: 'You visit the town stable to manage your mounts.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox',
            text: '📬 Check Mailbox',
            successProbability: 1.0,
            successDescription: 'You check your mailbox for messages.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check your mailbox.',
          },
          ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
          {
            id: 'leave-town',
            text: '🚪 Leave Town',
            successProbability: 1.0,
            successDescription: `You wave goodbye and head back out on the road.`,
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You leave ${townLandmark?.name ?? 'the town'}.`,
          },
        ],
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter,
        resultDescription: `You enter ${townLandmark?.name ?? 'the town'}.`,
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: `You walk through the gates of ${townLandmark?.name ?? 'the town'}.`,
        resourceDelta: {},
        decisionPoint: townHub,
        shopEvent: true,
      })
    }

    // Handle visit-shop: show town hub again with shop triggered
    if (optionId === 'visit-shop') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `You've browsed the shop. What else would you like to do in ${townName}?`,
        options: [
          {
            id: 'visit-shop',
            text: '🏪 Visit the Shop again',
            successProbability: 1.0,
            successDescription: 'You browse the merchant\'s wares.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn',
            text: `🛏️ Rest at the Inn (${innCost} gold)`,
            successProbability: 1.0,
            successDescription: `You pay ${innCost} gold for a warm meal and a soft bed.`,
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You rest at the inn.`,
          },
          {
            id: 'hire-transport',
            text: '🐴 Hire Transport',
            successProbability: 1.0,
            successDescription: 'You check the transport board for available destinations.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check available transport.',
          },
          {
            id: 'visit-stable',
            text: '🐴 Visit the Stable',
            successProbability: 1.0,
            successDescription: 'You visit the town stable to manage your mounts.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox',
            text: '📬 Check Mailbox',
            successProbability: 1.0,
            successDescription: 'You check your mailbox for messages.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check your mailbox.',
          },
          ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
          {
            id: 'leave-town',
            text: '🚪 Leave Town',
            successProbability: 1.0,
            successDescription: `You wave goodbye and head back out on the road.`,
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You leave ${townName}.`,
          },
        ],
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter: character,
        resultDescription: 'You browse the shop\'s offerings.',
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: 'You browse the shop.',
        resourceDelta: {},
        decisionPoint: townHub,
        shopEvent: true,
      })
    }

    // Handle rest-at-inn: pay gold, restore HP and MP to full
    if (optionId === 'rest-at-inn') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      let updatedCharacter = { ...character }
      let outcomeDesc: string

      if ((updatedCharacter.gold ?? 0) >= innCost) {
        updatedCharacter = {
          ...updatedCharacter,
          gold: (updatedCharacter.gold ?? 0) - innCost,
          hp: updatedCharacter.maxHp ?? 100,
          mana: updatedCharacter.maxMana ?? 50,
        }
        outcomeDesc = `You pay ${innCost} gold and enjoy a warm meal and a comfortable bed. You wake feeling completely refreshed! HP and MP fully restored.`
      } else {
        outcomeDesc = `You don't have enough gold to stay at the inn. You need ${innCost} gold.`
      }

      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `${outcomeDesc} What else would you like to do in ${townName}?`,
        options: [
          {
            id: 'visit-shop',
            text: '🏪 Visit the Shop',
            successProbability: 1.0,
            successDescription: 'You browse the merchant\'s wares.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn',
            text: `🛏️ Rest at the Inn (${innCost} gold)`,
            successProbability: 1.0,
            successDescription: `You pay ${innCost} gold for rest.`,
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You rest at the inn.',
          },
          {
            id: 'hire-transport',
            text: '🐴 Hire Transport',
            successProbability: 1.0,
            successDescription: 'You check the transport board for available destinations.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check available transport.',
          },
          {
            id: 'visit-stable',
            text: '🐴 Visit the Stable',
            successProbability: 1.0,
            successDescription: 'You visit the town stable to manage your mounts.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox',
            text: '📬 Check Mailbox',
            successProbability: 1.0,
            successDescription: 'You check your mailbox for messages.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check your mailbox.',
          },
          ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
          {
            id: 'leave-town',
            text: '🚪 Leave Town',
            successProbability: 1.0,
            successDescription: `You head back out on the road.`,
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You leave ${townName}.`,
          },
        ],
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter,
        resultDescription: outcomeDesc,
        appliedEffects: (updatedCharacter.gold ?? 0) !== (character.gold ?? 0) ? { gold: -innCost } : {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: outcomeDesc,
        resourceDelta: (updatedCharacter.gold ?? 0) !== (character.gold ?? 0) ? { gold: -innCost } : {},
        decisionPoint: townHub,
      })
    }

    // Handle hire-transport: show available destinations with prices
    if (optionId === 'hire-transport') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)
      const charPos = landmarkState?.position ?? { x: 0, y: 0 }

      // Build destination options from known (non-hidden) landmarks
      const destinations = (landmarkState?.landmarks ?? [])
        .map((lm, idx) => ({ ...lm, index: idx }))
        .filter(lm => {
          // Filter out: hidden landmarks, the current landmark, landmarks without positions
          if (lm.hidden) return false
          if (lm.name === townName) return false
          if (!lm.position) return false
          return true
        })
        .map(lm => {
          const dist = Math.sqrt(
            Math.pow((lm.position!.x - charPos.x), 2) +
            Math.pow((lm.position!.y - charPos.y), 2)
          )
          const price = Math.max(5, Math.ceil(dist * 0.5 * regionMult))
          return { ...lm, dist, price }
        })
        .sort((a, b) => a.dist - b.dist)

      const destinationOptions = destinations.map(dest => ({
        id: `transport-to-${dest.index}`,
        text: `${dest.icon} ${dest.name} — ${dest.price} gold (${Math.round(dest.dist)} steps)`,
        successProbability: 1.0,
        successDescription: `The driver takes you to ${dest.name}.`,
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
        resultDescription: `You travel to ${dest.name}.`,
      }))

      if (destinationOptions.length === 0) {
        // No destinations — return to town hub
        const townHub: FantasyDecisionPoint = {
          id: `decision-town-hub-${Date.now()}`,
          eventId: `town-hub-${Date.now()}`,
          prompt: `There are no available transport destinations from ${townName}. What else would you like to do?`,
          options: [
            {
              id: 'visit-shop',
              text: '🏪 Visit the Shop',
              successProbability: 1.0,
              successDescription: 'You browse the merchant\'s wares.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You visit the shop.',
            },
            {
              id: 'rest-at-inn',
              text: `🛏️ Rest at the Inn (${innCost} gold)`,
              successProbability: 1.0,
              successDescription: `You pay ${innCost} gold for rest.`,
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You rest at the inn.',
            },
            {
              id: 'hire-transport',
              text: '🐴 Hire Transport',
              successProbability: 1.0,
              successDescription: 'You check for transport.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You check transport.',
            },
            {
              id: 'visit-stable',
              text: '🐴 Visit the Stable',
              successProbability: 1.0,
              successDescription: 'You visit the town stable to manage your mounts.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You visit the stable.',
            },
            {
              id: 'check-mailbox',
              text: '📬 Check Mailbox',
              successProbability: 1.0,
              successDescription: 'You check your mailbox for messages.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You check your mailbox.',
            },
            ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
            {
              id: 'leave-town',
              text: '🚪 Leave Town',
              successProbability: 1.0,
              successDescription: 'You head back on the road.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You leave ${townName}.`,
            },
          ],
          resolved: false,
        }
        return NextResponse.json({
          updatedCharacter: character,
          resultDescription: 'No transport destinations available.',
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: 'No transport destinations available from here.',
          resourceDelta: {},
          decisionPoint: townHub,
        })
      }

      // Add a back option
      destinationOptions.push({
        id: 'back-to-town',
        text: '↩️ Back to town',
        successProbability: 1.0,
        successDescription: 'You return to the town square.',
        successEffects: {},
        failureDescription: '',
        failureEffects: {},
        resultDescription: 'You go back.',
      })

      const transportBoard: FantasyDecisionPoint = {
        id: `decision-transport-${Date.now()}`,
        eventId: `transport-${Date.now()}`,
        prompt: `🐴 Transport Board — Choose your destination from ${townName}:`,
        options: destinationOptions,
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter: character,
        resultDescription: 'You check the transport board.',
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: 'You review available transport destinations.',
        resourceDelta: {},
        decisionPoint: transportBoard,
      })
    }

    // Handle transport-to-X: pay gold and teleport to destination landmark
    if (optionId.startsWith('transport-to-')) {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const destIndex = parseInt(optionId.replace('transport-to-', ''), 10)
      const destLandmark = landmarkState?.landmarks[destIndex]
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const charPos = landmarkState?.position ?? { x: 0, y: 0 }

      if (!destLandmark || !destLandmark.position) {
        return NextResponse.json({ error: 'Invalid transport destination' }, { status: 400 })
      }

      // Calculate price
      const dist = Math.sqrt(
        Math.pow((destLandmark.position.x - charPos.x), 2) +
        Math.pow((destLandmark.position.y - charPos.y), 2)
      )
      const price = Math.max(5, Math.ceil(dist * 0.5 * regionMult))

      if ((character.gold ?? 0) < price) {
        // Not enough gold — show message and return to town hub
        const innCost = Math.round(10 * regionMult)
        const townHub: FantasyDecisionPoint = {
          id: `decision-town-hub-${Date.now()}`,
          eventId: `town-hub-${Date.now()}`,
          prompt: `You don't have enough gold for transport to ${destLandmark.name}. You need ${price} gold but only have ${character.gold ?? 0}. What would you like to do?`,
          options: [
            {
              id: 'visit-shop',
              text: '🏪 Visit the Shop',
              successProbability: 1.0,
              successDescription: 'You browse the wares.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You visit the shop.',
            },
            {
              id: 'rest-at-inn',
              text: `🛏️ Rest at the Inn (${innCost} gold)`,
              successProbability: 1.0,
              successDescription: 'You rest.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You rest.',
            },
            {
              id: 'hire-transport',
              text: '🐴 Hire Transport',
              successProbability: 1.0,
              successDescription: 'You check transport.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You check transport.',
            },
            {
              id: 'visit-stable',
              text: '🐴 Visit the Stable',
              successProbability: 1.0,
              successDescription: 'You visit the town stable to manage your mounts.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You visit the stable.',
            },
            {
              id: 'check-mailbox',
              text: '📬 Check Mailbox',
              successProbability: 1.0,
              successDescription: 'You check your mailbox for messages.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: 'You check your mailbox.',
            },
            ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
            {
              id: 'leave-town',
              text: '🚪 Leave Town',
              successProbability: 1.0,
              successDescription: 'You leave.',
              successEffects: {},
              failureDescription: '',
              failureEffects: {},
              resultDescription: `You leave ${townName}.`,
            },
          ],
          resolved: false,
        }
        return NextResponse.json({
          updatedCharacter: character,
          resultDescription: `Not enough gold for transport to ${destLandmark.name}.`,
          appliedEffects: {},
          selectedOptionId: optionId,
          selectedOptionText: option.text,
          outcomeDescription: `You need ${price} gold but only have ${character.gold ?? 0}.`,
          resourceDelta: {},
          decisionPoint: townHub,
        })
      }

      // Deduct gold and teleport
      const updatedCharacter: FantasyCharacter = {
        ...character,
        gold: (character.gold ?? 0) - price,
        landmarkState: landmarkState
          ? {
              ...landmarkState,
              position: destLandmark.position,
              activeTargetIndex: destIndex,
              exploring: false,
              explorationDepth: 0,
              exploringLandmarkName: undefined,
            }
          : undefined,
      }

      return NextResponse.json({
        updatedCharacter,
        resultDescription: `You hire transport to ${destLandmark.name} for ${price} gold. The journey is swift and uneventful.`,
        appliedEffects: { gold: -price },
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: `🐴 You arrive at ${destLandmark.name} after a comfortable ride. (-${price} gold)`,
        resourceDelta: { gold: -price },
      })
    }

    // Handle back-to-town: return to town hub from transport board
    if (optionId === 'back-to-town') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `You return to the town square of ${townName}. What would you like to do?`,
        options: [
          {
            id: 'visit-shop',
            text: '🏪 Visit the Shop',
            successProbability: 1.0,
            successDescription: 'You browse the wares.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn',
            text: `🛏️ Rest at the Inn (${innCost} gold)`,
            successProbability: 1.0,
            successDescription: 'You rest.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You rest.',
          },
          {
            id: 'hire-transport',
            text: '🐴 Hire Transport',
            successProbability: 1.0,
            successDescription: 'You check transport.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check transport.',
          },
          {
            id: 'visit-stable',
            text: '🐴 Visit the Stable',
            successProbability: 1.0,
            successDescription: 'You visit the town stable to manage your mounts.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox',
            text: '📬 Check Mailbox',
            successProbability: 1.0,
            successDescription: 'You check your mailbox for messages.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check your mailbox.',
          },
          ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
          {
            id: 'leave-town',
            text: '🚪 Leave Town',
            successProbability: 1.0,
            successDescription: 'You leave.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You leave ${townName}.`,
          },
        ],
        resolved: false,
      }
      return NextResponse.json({
        updatedCharacter: character,
        resultDescription: `You return to ${townName}.`,
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: `You return to the town square.`,
        resourceDelta: {},
        decisionPoint: townHub,
      })
    }

    // Handle visit-stable: return the town hub with stableOpen flag so client shows StablePanel
    if (optionId === 'visit-stable') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `You visit the town stable. Here you can stash, retrieve, and heal your mounts. What else would you like to do in ${townName}?`,
        options: [
          {
            id: 'visit-shop',
            text: '🏪 Visit the Shop',
            successProbability: 1.0,
            successDescription: 'You browse the wares.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn',
            text: `🛏️ Rest at the Inn (${innCost} gold)`,
            successProbability: 1.0,
            successDescription: 'You rest.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You rest.',
          },
          {
            id: 'hire-transport',
            text: '🐴 Hire Transport',
            successProbability: 1.0,
            successDescription: 'You check transport.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check transport.',
          },
          {
            id: 'visit-stable',
            text: '🐴 Visit the Stable again',
            successProbability: 1.0,
            successDescription: 'You visit the stable again.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox',
            text: '📬 Check Mailbox',
            successProbability: 1.0,
            successDescription: 'You check your mailbox for messages.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check your mailbox.',
          },
          ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
          {
            id: 'leave-town',
            text: '🚪 Leave Town',
            successProbability: 1.0,
            successDescription: 'You leave.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You leave ${townName}.`,
          },
        ],
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter: character,
        resultDescription: 'You head to the town stable.',
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: 'You visit the town stable.',
        resourceDelta: {},
        decisionPoint: townHub,
        stableOpen: true,
      })
    }

    // Handle check-mailbox: client-side panel, server just returns town hub
    if (optionId === 'check-mailbox') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      const innCost = Math.round(10 * regionMult)

      const townHub: FantasyDecisionPoint = {
        id: `decision-town-hub-${Date.now()}`,
        eventId: `town-hub-${Date.now()}`,
        prompt: `You check your mailbox. What else would you like to do in ${townName}?`,
        options: [
          {
            id: 'visit-shop',
            text: '🏪 Visit the Shop',
            successProbability: 1.0,
            successDescription: 'You browse the wares.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the shop.',
          },
          {
            id: 'rest-at-inn',
            text: `🛏️ Rest at the Inn (${innCost} gold)`,
            successProbability: 1.0,
            successDescription: 'You rest.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You rest.',
          },
          {
            id: 'hire-transport',
            text: '🐴 Hire Transport',
            successProbability: 1.0,
            successDescription: 'You check transport.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check transport.',
          },
          {
            id: 'visit-stable',
            text: '🐴 Visit the Stable',
            successProbability: 1.0,
            successDescription: 'You visit the stable.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You visit the stable.',
          },
          {
            id: 'check-mailbox',
            text: '📬 Check Mailbox again',
            successProbability: 1.0,
            successDescription: 'You check your mailbox again.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: 'You check your mailbox.',
          },
          ...buildNPCOptions(character.currentRegion ?? 'green_meadows'),
          {
            id: 'leave-town',
            text: '🚪 Leave Town',
            successProbability: 1.0,
            successDescription: 'You leave.',
            successEffects: {},
            failureDescription: '',
            failureEffects: {},
            resultDescription: `You leave ${townName}.`,
          },
        ],
        resolved: false,
      }

      return NextResponse.json({
        updatedCharacter: character,
        resultDescription: 'You check your mailbox.',
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: 'You check your mailbox for messages.',
        resourceDelta: {},
        decisionPoint: townHub,
        mailboxOpen: true,
      })
    }

    // Handle leave-town: exit town without marking as explored
    if (optionId === 'leave-town') {
      const landmarkState = character.landmarkState
      const townName = landmarkState?.exploringLandmarkName ?? 'the town'

      const updatedCharacter: FantasyCharacter = {
        ...character,
        landmarkState: landmarkState
          ? {
              ...landmarkState,
              exploring: false,
              explorationDepth: 0,
              exploringLandmarkName: undefined,
            }
          : undefined,
      }

      return NextResponse.json({
        updatedCharacter,
        resultDescription: `You leave ${townName} and continue your journey.`,
        appliedEffects: {},
        selectedOptionId: optionId,
        selectedOptionText: option.text,
        outcomeDescription: `You leave ${townName} and head back out on the road.`,
        resourceDelta: {},
      })
    }

    // Handle explore-landmark: use activeTargetIndex to find the landmark the player walked to
    if (optionId === 'explore-landmark') {
      const landmarkState = character.landmarkState
      const targetIndex = landmarkState?.activeTargetIndex ?? 0
      const exploredLandmark = landmarkState?.landmarks[targetIndex]

      const updatedLandmarkState = landmarkState
        ? {
            ...landmarkState,
            nextLandmarkIndex: targetIndex,
            exploring: true,
            explorationDepth: 1,
            exploringLandmarkName: exploredLandmark?.name ?? 'the landmark',
            // Mark landmark explored immediately and snap position
            landmarks: landmarkState.landmarks.map((lm, i) =>
              i === targetIndex ? { ...lm, explored: true } : lm
            ),
            ...(exploredLandmark?.position ? { position: exploredLandmark.position } : {}),
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
        ? `IMPORTANT: This encounter takes place INSIDE the landmark "${exploredLandmark.name}" (${exploredLandmark.type}). ${exploredLandmark.encounterPrompt}\nDo NOT generate a generic road or travel event. The encounter MUST be directly related to this specific location.\nExploration depth: ${explorationDepth}. Scale rewards with depth — deeper encounters should have greater risks and greater rewards.\n\n`
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
          prompt: `You pause and look around ${currentLandmarkState.exploringLandmarkName}. There seems to be more to discover...`,
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
        // (Towns use their own hub flow and should never reach this code path)
        const exploredLandmarkForCompletion = currentLandmarkState.landmarks[exploredLandmarkIndex]
        const isTown = exploredLandmarkForCompletion?.type === 'town'

        // Award completion bonus scaled by region difficulty
        const completionGold = Math.round(20 * regionMult)
        const completionRep = 2

        updatedCharacter = {
          ...updatedCharacter,
          gold: (updatedCharacter.gold ?? 0) + completionGold,
          reputation: (updatedCharacter.reputation ?? 0) + completionRep,
        }

        const updatedLandmarks = currentLandmarkState.landmarks.map(lm =>
          lm.name === currentLandmarkState.exploringLandmarkName && !isTown
            ? { ...lm, explored: true }
            : lm
        )
        const newLandmarkIndex = Math.min(exploredLandmarkIndex + 1, currentLandmarkState.landmarks.length)
        updatedCharacter = {
          ...updatedCharacter,
          landmarkState: {
            ...currentLandmarkState,
            landmarks: updatedLandmarks,
            exploring: false,
            explorationDepth: 0,
            exploringLandmarkName: undefined,
            activeTargetIndex: newLandmarkIndex,
            nextLandmarkIndex: newLandmarkIndex,
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

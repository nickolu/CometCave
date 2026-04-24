import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { getNPCsForRegion } from '@/app/tap-tap-adventure/config/npcs'
import { FantasyDecisionOption, FantasyDecisionPoint } from '@/app/tap-tap-adventure/models/story'

interface TownFeatures {
  hasShop?: boolean
  hasInn?: boolean
  hasStable?: boolean
  hasMailbox?: boolean
  hasNoticeBoard?: boolean
  hasTransport?: boolean
}

export function buildTownHubDecisionPoint(params: {
  townName: string
  prompt: string
  regionId: string
  features?: TownFeatures
}): FantasyDecisionPoint {
  const { townName, prompt, regionId, features } = params
  const regionMult = getRegion(regionId).difficultyMultiplier
  const innCost = Math.round(10 * regionMult)

  // Default: all features enabled (backward compat for towns without explicit flags)
  const hasShop = features?.hasShop !== false
  const hasInn = features?.hasInn !== false
  const hasTransport = features?.hasTransport !== false
  const hasStable = features?.hasStable !== false
  const hasMailbox = features?.hasMailbox !== false
  const hasNoticeBoard = features?.hasNoticeBoard !== false

  const options: FantasyDecisionOption[] = []

  if (hasShop) {
    options.push({
      id: 'visit-shop',
      text: '🏪 Visit the Shop',
      successProbability: 1.0,
      successDescription: "You browse the merchant's wares.",
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: 'You visit the shop.',
    })
  }

  if (hasInn) {
    options.push({
      id: 'rest-at-inn',
      text: `🛏️ Rest at the Inn (${innCost} gold)`,
      successProbability: 1.0,
      successDescription: `You pay ${innCost} gold for a warm meal and a soft bed.`,
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: 'You rest at the inn.',
    })
  }

  if (hasTransport) {
    options.push({
      id: 'hire-transport',
      text: '🐴 Hire Transport',
      successProbability: 1.0,
      successDescription: 'You check the transport board for available destinations.',
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: 'You check available transport.',
    })
  }

  if (hasStable) {
    options.push({
      id: 'visit-stable',
      text: '🐴 Visit the Stable',
      successProbability: 1.0,
      successDescription: 'You visit the town stable to manage your mounts.',
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: 'You visit the stable.',
    })
  }

  if (hasMailbox) {
    options.push({
      id: 'check-mailbox',
      text: '📬 Check Mailbox',
      successProbability: 1.0,
      successDescription: 'You check your mailbox for messages.',
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: 'You check your mailbox.',
    })
  }

  if (hasNoticeBoard) {
    options.push({
      id: 'visit-notice-board',
      text: '📋 Notice Board',
      successProbability: 1.0,
      successDescription: 'You check the town notice board.',
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: 'You check the notice board.',
    })
  }

  // Add NPC options
  const regionNPCs = getNPCsForRegion(regionId)
  for (const npc of regionNPCs) {
    options.push({
      id: `talk-to-npc-${npc.id}`,
      text: `${npc.icon} Talk to ${npc.name} — ${npc.role}`,
      successProbability: 1.0,
      successDescription: `You approach ${npc.name}.`,
      successEffects: {},
      failureDescription: '',
      failureEffects: {},
      resultDescription: `You talk to ${npc.name}.`,
    })
  }

  // Always add leave option
  options.push({
    id: 'leave-town',
    text: '🚪 Leave Town',
    successProbability: 1.0,
    successDescription: 'You wave goodbye and head back out on the road.',
    successEffects: {},
    failureDescription: '',
    failureEffects: {},
    resultDescription: `You leave ${townName}.`,
  })

  return {
    id: `decision-town-hub-${Date.now()}`,
    eventId: `town-hub-${Date.now()}`,
    prompt,
    options,
    resolved: false,
  }
}

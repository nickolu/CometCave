import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'

const MAX_CONTEXT_LENGTH = 1500

export type ReputationTier = 'Infamous' | 'Disreputable' | 'Unknown' | 'Respected' | 'Renowned' | 'Legendary'

const REPUTATION_TIER_IMPLICATIONS: Record<ReputationTier, string> = {
  Infamous: 'NPCs are hostile or fearful. Bounty hunters pursue the character. Prices are much higher. Few will offer aid.',
  Disreputable: 'NPCs are suspicious and distrustful. Prices are higher. Fewer friendly encounters.',
  Unknown: 'NPCs are neutral. Standard pricing and interactions.',
  Respected: 'NPCs are friendly and helpful. Better deals available. Some share useful information.',
  Renowned: 'NPCs eagerly offer help, share secrets, and propose important quests. Excellent prices.',
  Legendary: 'NPCs revere the character. The best deals, exclusive quests, and powerful allies seek them out.',
}

export function getReputationTier(reputation: number): ReputationTier {
  if (reputation < -20) return 'Infamous'
  if (reputation < 0) return 'Disreputable'
  if (reputation < 20) return 'Unknown'
  if (reputation < 50) return 'Respected'
  if (reputation < 100) return 'Renowned'
  return 'Legendary'
}

export function buildStoryContext(
  character: FantasyCharacter,
  storyEvents: FantasyStoryEvent[],
  maxEvents: number = 10
): string {
  const characterEvents = storyEvents
    .filter(e => e.characterId === character.id)
    .slice(-maxEvents)

  const parts: string[] = []

  // Character summary
  const tier = getReputationTier(character.reputation)
  parts.push(
    `Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}. ` +
    `Gold: ${character.gold}, Reputation: ${character.reputation} (${tier}), Distance: ${character.distance}. ` +
    `Stats: STR ${character.strength}, INT ${character.intelligence}, LCK ${character.luck}.`
  )
  parts.push(`Reputation implications: ${REPUTATION_TIER_IMPLICATIONS[tier]}`)

  // Inventory highlights
  const activeItems = character.inventory.filter(i => i.status !== 'deleted')
  if (activeItems.length > 0) {
    const itemNames = activeItems.slice(0, 5).map(i => i.name).join(', ')
    parts.push(`Inventory: ${itemNames}${activeItems.length > 5 ? ` and ${activeItems.length - 5} more` : ''}.`)
  }

  // Recent events summary
  if (characterEvents.length > 0) {
    parts.push('Recent adventures:')
    for (const event of characterEvents) {
      const eventParts: string[] = []
      if (event.decisionPoint?.prompt) {
        eventParts.push(event.decisionPoint.prompt)
      }
      if (event.selectedOptionText) {
        eventParts.push(`Chose: ${event.selectedOptionText}`)
      }
      if (event.outcomeDescription) {
        eventParts.push(`Result: ${event.outcomeDescription}`)
      }
      if (eventParts.length > 0) {
        parts.push(`- ${eventParts.join('. ')}`)
      }
    }
  }

  let context = parts.join('\n')

  // Trim to max length
  if (context.length > MAX_CONTEXT_LENGTH) {
    context = context.slice(0, MAX_CONTEXT_LENGTH - 3) + '...'
  }

  return context
}

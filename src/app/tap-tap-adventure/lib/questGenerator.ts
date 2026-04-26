import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'

import { calculateDay } from './leveling'
import { inferItemTypeAndEffects } from './itemPostProcessor'

const QUEST_COMPANION_NAMES = [
  { name: 'Rescued Scout', description: 'A grateful scout who pledges loyalty after being saved.', icon: '🏹' },
  { name: 'Freed Prisoner', description: 'A former captive, eager to repay their debt.', icon: '⛓️' },
  { name: 'Grateful Pilgrim', description: 'A traveling pilgrim who offers their sword in thanks.', icon: '🙏' },
  { name: 'Lost Squire', description: 'A young squire separated from their knight, seeking protection.', icon: '🛡️' },
  { name: 'Wandering Monk', description: 'A monk whose monastery was destroyed, looking for purpose.', icon: '🧘' },
]

type QuestType = 'reach_distance' | 'collect_gold' | 'win_combat' | 'gain_reputation' | 'explore_landmarks' | 'survive_combats' | 'reach_level' | 'hoard_items' | 'visit_region'

interface QuestTemplate {
  type: QuestType
  getTitle: (target: number) => string
  getDescription: (target: number, daysLeft: number) => string
  getTarget: (character: FantasyCharacter) => number
  getDaysAllowed: (character: FantasyCharacter) => number
  getStartValue: (character: FantasyCharacter) => number
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    type: 'reach_distance',
    getTitle: (target) => `Journey to km ${target}`,
    getDescription: (target, days) => `Travel to km ${target} within ${days} days. Keep moving!`,
    getTarget: (char) => char.distance + 75 + Math.floor(Math.random() * 50),
    getDaysAllowed: (char) => 3 + Math.floor(char.level / 2),
    getStartValue: (char) => char.distance,
  },
  {
    type: 'collect_gold',
    getTitle: (target) => `Amass ${target} Gold`,
    getDescription: (target, days) => `Accumulate at least ${target} gold within ${days} days. Trade, fight, and loot!`,
    getTarget: (char) => char.gold + 30 + char.level * 10 + Math.floor(Math.random() * 20),
    getDaysAllowed: () => 4 + Math.floor(Math.random() * 2),
    getStartValue: (char) => char.gold,
  },
  {
    type: 'win_combat',
    getTitle: () => 'Prove Your Valor',
    getDescription: (_target, days) => `Win a combat encounter within ${days} days. Seek out a fight!`,
    getTarget: () => 1,
    getDaysAllowed: () => 3,
    getStartValue: () => 0,
  },
  {
    type: 'gain_reputation',
    getTitle: (target) => `Earn ${target} Reputation`,
    getDescription: (target, days) => `Increase your reputation by ${target} within ${days} days. Make good choices!`,
    getTarget: (char) => char.reputation + 5 + Math.floor(Math.random() * 5),
    getDaysAllowed: () => 4 + Math.floor(Math.random() * 2),
    getStartValue: (char) => char.reputation,
  },
  {
    type: 'explore_landmarks',
    getTitle: (target) => `Explore ${target} Landmarks`,
    getDescription: (target, days) => `Explore ${target} landmark${target > 1 ? 's' : ''} within ${days} days. Seek out points of interest!`,
    getTarget: () => 2 + Math.floor(Math.random() * 2),
    getDaysAllowed: () => 5 + Math.floor(Math.random() * 2),
    getStartValue: (char) => (char.landmarkState?.landmarks ?? []).filter(lm => lm.explored).length,
  },
  {
    type: 'survive_combats',
    getTitle: (target) => `Win ${target} Battles`,
    getDescription: (target, days) => `Win ${target} combat encounter${target > 1 ? 's' : ''} within ${days} days. Seek out worthy foes!`,
    getTarget: () => 2 + Math.floor(Math.random() * 2),
    getDaysAllowed: () => 4 + Math.floor(Math.random() * 2),
    getStartValue: () => 0,
  },
  {
    type: 'reach_level',
    getTitle: (target) => `Reach Level ${target}`,
    getDescription: (target, days) => `Advance to level ${target} within ${days} days. Defeat enemies and gain experience!`,
    getTarget: (char) => char.level + 1,
    getDaysAllowed: () => 5 + Math.floor(Math.random() * 3),
    getStartValue: (char) => char.level,
  },
  {
    type: 'hoard_items',
    getTitle: (target) => `Collect ${target} Items`,
    getDescription: (target, days) => `Gather ${target} item${target > 1 ? 's' : ''} in your inventory within ${days} days. Loot, buy, and craft!`,
    getTarget: (char) => char.inventory.length + 3 + Math.floor(Math.random() * 3),
    getDaysAllowed: () => 4 + Math.floor(Math.random() * 2),
    getStartValue: (char) => char.inventory.length,
  },
  {
    type: 'visit_region',
    getTitle: () => 'Venture to New Lands',
    getDescription: (_target, days) => `Enter a new region within ${days} days. Push forward past the edge of the known world!`,
    getTarget: (char) => (char.visitedRegions?.length ?? 1) + 1,
    getDaysAllowed: () => 6 + Math.floor(Math.random() * 3),
    getStartValue: (char) => char.visitedRegions?.length ?? 1,
  },
]

export function generateTimedQuest(character: FantasyCharacter): TimedQuest {
  const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)]
  const target = template.getTarget(character)
  const daysAllowed = template.getDaysAllowed(character)
  const currentDay = calculateDay(character.distance)
  const deadlineDay = currentDay + daysAllowed

  const goldReward = 15 + character.level * 10 + Math.floor(Math.random() * 10)
  const repReward = 3 + Math.floor(Math.random() * 5)

  // ~10% chance of companion reward for level 3+ characters on harder quests
  let companionReward: { name: string; description?: string; icon?: string; rarity?: 'common' | 'uncommon' | 'rare' | 'legendary' } | undefined
  if (character.level >= 3 && Math.random() < 0.1) {
    const companion = QUEST_COMPANION_NAMES[Math.floor(Math.random() * QUEST_COMPANION_NAMES.length)]
    companionReward = {
      ...companion,
      rarity: character.level >= 8 ? 'uncommon' : 'common',
    }
  }

  return {
    id: `quest-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    title: template.getTitle(target),
    description: template.getDescription(target, daysAllowed),
    status: 'active',
    type: template.type,
    target,
    startValue: template.getStartValue(character),
    deadlineDay,
    startDay: currentDay,
    rewards: {
      gold: goldReward,
      reputation: repReward,
      items: [
        inferItemTypeAndEffects({
          id: `quest-reward-${Date.now()}`,
          name: character.level >= 3 ? 'Greater Healing Potion' : 'Healing Potion',
          description: 'A reward for completing your quest.',
          quantity: 1,
        }),
      ],
      companion: companionReward,
    },
  }
}

/**
 * Check quest progress and return updated quest status.
 */
export function checkQuestProgress(
  quest: TimedQuest,
  character: FantasyCharacter,
  combatWon: boolean = false
): TimedQuest {
  if (quest.status !== 'active') return quest

  const currentDay = calculateDay(character.distance)

  // Check completion
  let completed = false
  switch (quest.type) {
    case 'reach_distance':
      completed = character.distance >= quest.target
      break
    case 'collect_gold':
      completed = character.gold >= quest.target
      break
    case 'win_combat':
      completed = combatWon
      break
    case 'gain_reputation':
      completed = character.reputation >= quest.target
      break
    case 'explore_landmarks': {
      const exploredCount = (character.landmarkState?.landmarks ?? []).filter(lm => lm.explored).length
      completed = exploredCount >= quest.target
      break
    }
    case 'survive_combats':
      if (combatWon) {
        const newProgress = (quest.startValue ?? 0) + 1
        if (newProgress >= quest.target) {
          completed = true
        } else {
          // Update startValue to track cumulative wins
          return { ...quest, startValue: newProgress }
        }
      }
      break
    case 'reach_level':
      completed = character.level >= quest.target
      break
    case 'hoard_items':
      completed = character.inventory.length >= quest.target
      break
    case 'visit_region':
      completed = (character.visitedRegions?.length ?? 1) >= quest.target
      break
  }

  if (completed) {
    return { ...quest, status: 'completed' }
  }

  // Check deadline
  if (currentDay > quest.deadlineDay) {
    return { ...quest, status: 'failed' }
  }

  return quest
}

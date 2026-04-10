import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'

import { calculateDay } from './leveling'
import { inferItemTypeAndEffects } from './itemPostProcessor'

type QuestType = 'reach_distance' | 'collect_gold' | 'win_combat' | 'gain_reputation'

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
    getTitle: (target) => `Journey to Step ${target}`,
    getDescription: (target, days) => `Travel to step ${target} within ${days} days. Keep moving!`,
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
]

export function generateTimedQuest(character: FantasyCharacter): TimedQuest {
  const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)]
  const target = template.getTarget(character)
  const daysAllowed = template.getDaysAllowed(character)
  const currentDay = calculateDay(character.distance)
  const deadlineDay = currentDay + daysAllowed

  const goldReward = 15 + character.level * 10 + Math.floor(Math.random() * 10)
  const repReward = 3 + Math.floor(Math.random() * 5)

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

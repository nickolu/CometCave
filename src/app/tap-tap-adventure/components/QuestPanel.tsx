'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { calculateDay, STEPS_PER_DAY } from '@/app/tap-tap-adventure/lib/leveling'
import { createPartyMember } from '@/app/tap-tap-adventure/lib/partyRecruitment'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import { MAX_PARTY_SIZE } from '@/app/tap-tap-adventure/models/partyMember'
import { QuestCelebration } from './QuestCelebration'

function getUrgencyStyle(daysLeft: number): { badge: string; bar: string; border: string } {
  if (daysLeft >= 3) return {
    badge: 'bg-emerald-900/50 text-emerald-400',
    bar: 'bg-emerald-500',
    border: 'border-emerald-700/30',
  }
  if (daysLeft === 2) return {
    badge: 'bg-yellow-900/50 text-yellow-400',
    bar: 'bg-yellow-500',
    border: 'border-yellow-700/30',
  }
  return {
    badge: 'bg-red-900/50 text-red-400',
    bar: 'bg-red-500',
    border: 'border-red-700/30',
  }
}

function RewardPreview({ quest }: { quest: TimedQuest }) {
  const hasRewards = quest.rewards.gold || quest.rewards.reputation || (quest.rewards.items && quest.rewards.items.length > 0) || quest.rewards.companion
  if (!hasRewards) return null

  return (
    <div className="bg-slate-800/50 rounded p-2 space-y-0.5">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Rewards</p>
      <div className="flex flex-wrap gap-2">
        {quest.rewards.gold && (
          <span className="text-[10px] text-yellow-400">+{quest.rewards.gold} Gold</span>
        )}
        {quest.rewards.reputation && (
          <span className="text-[10px] text-blue-400">+{quest.rewards.reputation} Rep</span>
        )}
        {quest.rewards.items?.map(item => (
          <span key={item.id} className="text-[10px] text-purple-400">+ {item.name}</span>
        ))}
        {quest.rewards.companion && (
          <span className="text-[10px] text-green-400">+ {quest.rewards.companion.name} (companion)</span>
        )}
      </div>
    </div>
  )
}

export function QuestPanel() {
  const { gameState, getSelectedCharacter, setActiveQuest } = useGameStore()
  const quest = gameState.activeQuest
  const character = getSelectedCharacter()
  const [showCelebration, setShowCelebration] = useState(false)
  const failSoundPlayed = useRef(false)

  // Play defeat sound once when quest fails
  useEffect(() => {
    if (quest?.status === 'failed' && !failSoundPlayed.current) {
      soundEngine.playDefeat()
      failSoundPlayed.current = true
    }
    if (quest?.status !== 'failed') {
      failSoundPlayed.current = false
    }
  }, [quest?.status])

  // Show celebration modal when quest completes
  useEffect(() => {
    if (quest?.status === 'completed') {
      setShowCelebration(true)
    }
  }, [quest?.status])

  const handleClaimRewards = useCallback(() => {
    if (!quest || !character) return
    const rewards = quest.rewards
    const updatedGold = character.gold + (rewards.gold ?? 0)
    const updatedRep = character.reputation + (rewards.reputation ?? 0)

    const { gameState: gs, setGameState } = useGameStore.getState()
    const updatedChars = gs.characters.map(c => {
      if (c.id !== character.id) return c
      const updatedInventory = [...c.inventory, ...(rewards.items ?? [])]
      let updatedParty = [...(c.party ?? [])]
      if (rewards.companion && updatedParty.length < MAX_PARTY_SIZE) {
        const member = createPartyMember({
          id: `quest-companion-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: rewards.companion.name,
          description: rewards.companion.description,
          icon: rewards.companion.icon ?? '⚔️',
          level: character.level,
          dailyCost: 0,  // Quest companions are loyal — no upkeep
          rarity: rewards.companion.rarity ?? 'common',
          role: 'combatant',
        })
        updatedParty = [...updatedParty, member]
      }
      return { ...c, gold: updatedGold, reputation: updatedRep, inventory: updatedInventory, party: updatedParty }
    })
    setGameState({ ...gs, characters: updatedChars, activeQuest: null })
    setShowCelebration(false)
  }, [quest, character])

  const handleDismiss = useCallback(() => {
    setActiveQuest(null)
  }, [setActiveQuest])

  if (!quest || !character) return null

  const currentDay = calculateDay(character.distance)
  const daysLeft = Math.max(0, quest.deadlineDay - currentDay)
  const stepsUntilDeadline = Math.max(0, quest.deadlineDay * STEPS_PER_DAY - character.distance)

  // Progress calculation
  let progress = 0
  let progressText = ''
  let targetDescription = ''
  switch (quest.type) {
    case 'reach_distance': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.distance - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.distance} / ${quest.target} km`
      targetDescription = `Travel ${quest.target} km`
      break
    }
    case 'collect_gold': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.gold - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.gold} / ${quest.target} gold`
      targetDescription = `Collect ${quest.target} gold`
      break
    }
    case 'win_combat':
      progress = quest.status === 'completed' ? 1 : 0
      progressText = quest.status === 'completed' ? 'Completed!' : 'Win a fight'
      targetDescription = 'Win a combat encounter'
      break
    case 'gain_reputation': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.reputation - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.reputation} / ${quest.target} reputation`
      targetDescription = `Reach ${quest.target} reputation`
      break
    }
    case 'explore_landmarks': {
      const explored = (character.landmarkState?.landmarks ?? []).filter(lm => lm.explored).length
      const needed = quest.target - quest.startValue
      const done = Math.max(0, explored - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `${explored} / ${quest.target} explored`
      targetDescription = `Explore ${quest.target} landmarks`
      break
    }
    case 'survive_combats': {
      const wins = quest.startValue
      progress = Math.min(1, wins / quest.target)
      progressText = `${wins} / ${quest.target} won`
      targetDescription = `Win ${quest.target} battles`
      break
    }
    case 'reach_level': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.level - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `Level ${character.level} / ${quest.target}`
      targetDescription = `Reach level ${quest.target}`
      break
    }
    case 'hoard_items': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.inventory.length - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `${character.inventory.length} / ${quest.target} items`
      targetDescription = `Collect ${quest.target} items`
      break
    }
    case 'visit_region': {
      const visited = character.visitedRegions?.length ?? 1
      const needed = quest.target - quest.startValue
      const done = Math.max(0, visited - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `${visited} / ${quest.target} regions`
      targetDescription = `Visit ${quest.target} regions`
      break
    }
  }

  // Celebration modal for completed quests
  if (quest.status === 'completed' && showCelebration) {
    return <QuestCelebration quest={quest} onClaim={handleClaimRewards} />
  }

  // Completed but celebration dismissed (fallback)
  if (quest.status === 'completed') {
    return (
      <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-emerald-400">Quest Complete!</span>
        </div>
        <p className="text-xs text-emerald-300">{quest.title}</p>
        <div className="text-xs text-slate-300 space-y-0.5">
          {quest.rewards.gold && <div>+{quest.rewards.gold} Gold</div>}
          {quest.rewards.reputation && <div>+{quest.rewards.reputation} Reputation</div>}
          {quest.rewards.items?.map(item => (
            <div key={item.id}>+ {item.name}</div>
          ))}
          {quest.rewards.companion && <div>+ {quest.rewards.companion.name} (companion)</div>}
        </div>
        <Button
          className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-1.5 rounded"
          onClick={handleClaimRewards}
        >
          Claim Rewards
        </Button>
      </div>
    )
  }

  // Failed quest — detailed feedback
  if (quest.status === 'failed') {
    const daysOverdue = currentDay - quest.deadlineDay
    const questDuration = quest.deadlineDay - quest.startDay
    return (
      <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-red-400">Quest Failed</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded">
            {daysOverdue > 0 ? `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue` : 'Expired'}
          </span>
        </div>
        <p className="text-xs text-white font-semibold">{quest.title}</p>
        <div className="bg-red-950/40 rounded p-2 space-y-1">
          <p className="text-[10px] text-red-300">
            <span className="text-slate-400">Objective:</span> {targetDescription}
          </p>
          <p className="text-[10px] text-red-300">
            <span className="text-slate-400">Progress:</span> {progressText} ({Math.round(progress * 100)}%)
          </p>
          <p className="text-[10px] text-red-300">
            <span className="text-slate-400">Time given:</span> {questDuration} day{questDuration !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <Button
          className="w-full bg-red-900 hover:bg-red-800 text-white text-xs py-1.5 rounded"
          onClick={handleDismiss}
        >
          Dismiss
        </Button>
      </div>
    )
  }

  // Active quest — enhanced with urgency, rewards, and steps
  const urgency = getUrgencyStyle(daysLeft)

  return (
    <div className={`bg-[#1e1f30] border ${urgency.border} rounded-lg p-3 space-y-2`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">Active Quest</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${urgency.badge}`}>
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
        </span>
      </div>
      <p className="text-xs text-white font-semibold">{quest.title}</p>
      <p className="text-[10px] text-slate-400">{quest.description}</p>

      {/* Deadline detail */}
      <p className="text-[10px] text-slate-500">
        ~{stepsUntilDeadline} km until deadline
      </p>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>{progressText}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${urgency.bar} rounded-full transition-all duration-300`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Reward preview */}
      <RewardPreview quest={quest} />
    </div>
  )
}

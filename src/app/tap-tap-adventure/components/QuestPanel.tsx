'use client'

import { useCallback } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'

export function QuestPanel() {
  const { gameState, getSelectedCharacter, setActiveQuest } = useGameStore()
  const quest = gameState.activeQuest
  const character = getSelectedCharacter()

  const handleDismiss = useCallback(() => {
    if (!quest) return
    if (quest.status === 'completed' && character) {
      // Apply rewards
      const rewards = quest.rewards
      const updatedGold = character.gold + (rewards.gold ?? 0)
      const updatedRep = character.reputation + (rewards.reputation ?? 0)

      // Update character with rewards via store
      const { gameState: gs, setGameState } = useGameStore.getState()
      const updatedChars = gs.characters.map(c => {
        if (c.id !== character.id) return c
        const updatedInventory = [...c.inventory, ...(rewards.items ?? [])]
        return { ...c, gold: updatedGold, reputation: updatedRep, inventory: updatedInventory }
      })
      setGameState({ ...gs, characters: updatedChars, activeQuest: null })
    } else {
      setActiveQuest(null)
    }
  }, [quest, character, setActiveQuest])

  if (!quest || !character) return null

  const currentDay = calculateDay(character.distance)
  const daysLeft = Math.max(0, quest.deadlineDay - currentDay)

  // Progress calculation
  let progress = 0
  let progressText = ''
  switch (quest.type) {
    case 'reach_distance': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.distance - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.distance} / ${quest.target} steps`
      break
    }
    case 'collect_gold': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.gold - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.gold} / ${quest.target} gold`
      break
    }
    case 'win_combat':
      progress = quest.status === 'completed' ? 1 : 0
      progressText = quest.status === 'completed' ? 'Completed!' : 'Win a fight'
      break
    case 'gain_reputation': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.reputation - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.reputation} / ${quest.target} reputation`
      break
    }
  }

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
        </div>
        <Button
          className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-1.5 rounded"
          onClick={handleDismiss}
        >
          Claim Rewards
        </Button>
      </div>
    )
  }

  if (quest.status === 'failed') {
    return (
      <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-red-400">Quest Failed</span>
        </div>
        <p className="text-xs text-red-300">{quest.title}</p>
        <p className="text-xs text-slate-400">The deadline has passed.</p>
        <Button
          className="w-full bg-red-900 hover:bg-red-800 text-white text-xs py-1.5 rounded"
          onClick={handleDismiss}
        >
          Dismiss
        </Button>
      </div>
    )
  }

  // Active quest
  return (
    <div className="bg-[#1e1f30] border border-amber-700/30 rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">Active Quest</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          daysLeft <= 1 ? 'bg-red-900/50 text-red-400' : 'bg-amber-900/50 text-amber-400'
        }`}>
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
        </span>
      </div>
      <p className="text-xs text-white font-semibold">{quest.title}</p>
      <p className="text-[10px] text-slate-400">{quest.description}</p>
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>{progressText}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

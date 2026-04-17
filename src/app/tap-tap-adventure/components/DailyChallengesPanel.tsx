'use client'

import { useState } from 'react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { canClaimBonusReward, computeBonusReward, getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyChallengeTracker'
import { DailyChallenge } from '@/app/tap-tap-adventure/models/dailyChallenge'

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChallengeRow({ challenge }: { challenge: DailyChallenge }) {
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100))

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-300 flex-1">{challenge.description}</span>
        <div className="flex items-center gap-1 shrink-0">
          {challenge.reward.gold && (
            <span className="text-[10px] text-yellow-400">+{challenge.reward.gold}g</span>
          )}
          {challenge.reward.reputation && (
            <span className="text-[10px] text-blue-400">+{challenge.reward.reputation} rep</span>
          )}
          {challenge.completed && (
            <span className="text-emerald-400 text-xs font-bold ml-1">&#10003;</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${challenge.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-400 shrink-0 w-12 text-right">
          {challenge.progress}/{challenge.target}
        </span>
      </div>
    </div>
  )
}

export function DailyChallengesPanel() {
  const { gameState, claimDailyChallengeBonus } = useGameStore()
  const [expanded, setExpanded] = useState(true)

  const challenges = gameState.dailyChallenges

  // Don't render if no challenges have been generated yet (first step triggers generation)
  if (!challenges) return null

  const today = getTodayDateString()
  // If the panel date doesn't match today, challenges are stale — still show them
  const displayDate = challenges.date === today ? today : challenges.date

  const allDone = challenges.challenges.every(c => c.completed)
  const canClaim = canClaimBonusReward(challenges)
  const bonus = computeBonusReward(challenges.streak)

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-2">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-400">Daily Challenges</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
            {formatDate(displayDate)}
          </span>
          {challenges.streak > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-900/50 text-orange-300 rounded">
              &#128293; {challenges.streak}
            </span>
          )}
        </div>
        <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <>
          {/* Challenge rows */}
          <div className="space-y-3 pt-1">
            {challenges.challenges.map(challenge => (
              <ChallengeRow key={challenge.id} challenge={challenge} />
            ))}
          </div>

          {/* Bonus section */}
          {canClaim && (
            <div className="mt-2 bg-emerald-950/40 border border-emerald-700/40 rounded p-2 space-y-1">
              <p className="text-xs font-semibold text-emerald-400">All Complete! Bonus Reward:</p>
              <div className="flex gap-3 text-[10px]">
                <span className="text-yellow-400">+{bonus.gold} Gold</span>
                <span className="text-blue-400">+{bonus.reputation} Reputation</span>
              </div>
              <Button
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-1 rounded mt-1"
                onClick={() => claimDailyChallengeBonus()}
              >
                Claim Bonus
              </Button>
            </div>
          )}

          {/* Already claimed */}
          {allDone && challenges.allCompletedClaimed && (
            <p className="text-[10px] text-emerald-400 text-center py-1">
              Challenges complete for today!
            </p>
          )}
        </>
      )}
    </div>
  )
}

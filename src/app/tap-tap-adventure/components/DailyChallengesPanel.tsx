'use client'

/**
 * Today's three challenges as a printed checklist: a box ticked when done,
 * a thin ink rule for progress, the reward as a stamp, and the day's bonus
 * paid out on brass.
 */
import { useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { canClaimBonusReward, computeBonusReward, getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyChallengeTracker'
import { DailyChallenge } from '@/app/tap-tap-adventure/models/dailyChallenge'
import { ChevronIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillRule, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border-2 border-ps-ink', done ? 'bg-ps-ink text-ps-playbill' : 'bg-transparent')}
    >
      {done && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12l5 5L20 6" />
        </svg>
      )}
    </span>
  )
}

function ChallengeRow({ challenge }: { challenge: DailyChallenge }) {
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100))

  return (
    <li className="py-2">
      <div className="flex items-start gap-2.5">
        <Tick done={challenge.completed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className={cn('font-body text-sm leading-snug', challenge.completed ? 'text-ps-ink-soft line-through' : 'text-ps-ink')}>
              {challenge.description}
              {challenge.completed && <span className="sr-only"> (done)</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {challenge.reward.gold && <Stamp tone="gold" tilt={false}>+{challenge.reward.gold} gold</Stamp>}
              {challenge.reward.reputation && <Stamp tone="blue" tilt={false}>+{challenge.reward.reputation} rep</Stamp>}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-ps-playbill-edge"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={challenge.description}
            >
              <div className={cn('h-full rounded-full transition-[width] duration-300', challenge.completed ? 'bg-ps-stamp-green' : 'bg-ps-ink')} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right font-playbill text-xs tabular-nums text-ps-ink-soft">
              {challenge.progress}/{challenge.target}
            </span>
          </div>
        </div>
      </div>
    </li>
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
  const doneCount = challenges.challenges.filter(c => c.completed).length

  return (
    <section aria-label="Daily challenges">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-y-2 border-ps-ink py-1.5 px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-playbill text-sm uppercase tracking-widest text-ps-ink">Today&apos;s challenges</span>
          <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">{formatDate(displayDate)}</span>
          {challenges.streak > 0 && (
            <Stamp tone="red" tilt={false} title={`${challenges.streak}-day streak`}>
              {challenges.streak}-day streak
            </Stamp>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-playbill text-sm tabular-nums text-ps-ink">{doneCount}<span className="text-ps-ink-soft">/{challenges.challenges.length}</span></span>
          <ChevronIcon className={cn('text-ps-ink transition-transform motion-reduce:transition-none', expanded && 'rotate-90')} />
        </span>
      </button>

      {expanded && (
        <>
          <ol className="divide-y divide-ps-playbill-edge">
            {challenges.challenges.map(challenge => (
              <ChallengeRow key={challenge.id} challenge={challenge} />
            ))}
          </ol>

          {canClaim && (
            <>
              <PlaybillRule className="my-2" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <PlaybillCaption>All three done · bonus</PlaybillCaption>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Stamp tone="gold" animate>+{bonus.gold} gold</Stamp>
                    <Stamp tone="blue" animate>+{bonus.reputation} repute</Stamp>
                  </div>
                </div>
                <PaperButton variant="brass" onClick={() => claimDailyChallengeBonus()}>
                  Claim bonus
                </PaperButton>
              </div>
            </>
          )}

          {allDone && challenges.allCompletedClaimed && (
            <div className="flex justify-center pt-2">
              <Stamp tone="green">Bonus claimed today</Stamp>
            </div>
          )}
        </>
      )}
    </section>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'

import { buildShareText, copyShareText } from '@/app/clusters/lib/shareGrid'
import {
  type ClusterGroup,
  type ClustersProfile,
  type GuessRecord,
  MAX_MISTAKES,
  type SessionStatus,
  TIERS,
  statsFrom,
} from '@/app/clusters/models/clusters'
import { ROUTE_CONSTANTS } from '@/app/route-constants'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { displayedStreak } from '@/lib/clusters/profile'

import { SolvedGroupBanner } from './SolvedGroupBanner'

interface ClustersResultsProps {
  sourceDate: string | null
  puzzleNumber: number
  status: SessionStatus
  mistakes: number
  guesses: GuessRecord[]
  /** Found groups first, then anything a loss revealed. */
  groups: ClusterGroup[]
  solution: ClusterGroup[]
  profile: ClustersProfile
  today: string
  isAnonymous: boolean
  editor: string | null
}

export function ClustersResults({
  sourceDate,
  puzzleNumber,
  status,
  mistakes,
  guesses,
  groups,
  solution,
  profile,
  today,
  isAnonymous,
  editor,
}: ClustersResultsProps) {
  const [copied, setCopied] = useState(false)

  // A win means all four were earned, including the forced last group the
  // server resolves for you. A loss means only the correct guesses count.
  const found =
    status === 'won' ? TIERS.length : guesses.filter((g) => g.result === 'correct').length

  const purpleFirst = groups.length > 0 && groups[0].tier === 'purple' && found > 0
  const perfect = status === 'won' && mistakes === 0
  const streak = displayedStreak(profile, today)
  const stats = statsFrom(profile)

  const shareText = buildShareText({ puzzleNumber, guesses, groups: solution, status })

  async function onShare() {
    const ok = await copyShareText(shareText)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="font-headline text-2xl font-extrabold text-on-surface">
          {status === 'won' ? 'All four groups found.' : 'Out of mistakes.'}
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Puzzle #{puzzleNumber} ·{' '}
          {status === 'won'
            ? mistakes === 0
              ? 'no mistakes'
              : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`
            : `${MAX_MISTAKES} mistakes`}
        </p>
      </div>

      {(purpleFirst || perfect) && (
        <div className="flex flex-wrap justify-center gap-2">
          {purpleFirst && (
            <span
              className="rounded-full px-3 py-1 font-label text-[11px] uppercase tracking-[0.14em]"
              style={{ backgroundColor: 'var(--cl-purple)', color: 'var(--cl-ink)' }}
            >
              Purple first
            </span>
          )}
          {perfect && (
            <span className="rounded-full bg-primary-container px-3 py-1 font-label text-[11px] uppercase tracking-[0.14em] text-on-primary-container">
              Perfect
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {groups.map((group, index) => (
          <SolvedGroupBanner
            key={group.tier}
            group={group}
            revealed={index >= found}
            celebrate={index === 0 && group.tier === 'purple' && found > 0}
          />
        ))}
      </div>

      <ChunkyCard variant="surface-container">
        <ChunkyCardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-col items-center gap-1">
            <pre className="font-mono text-lg leading-[1.35] tracking-[0.12em]">{shareText}</pre>
          </div>
          <ChunkyButton variant="primary" size="lg" onClick={onShare} className="w-full">
            {copied ? 'Copied' : 'Share result'}
          </ChunkyButton>
        </ChunkyCardContent>
      </ChunkyCard>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-ds-sm border border-outline-variant bg-outline-variant">
        <Figure label="Streak" value={streak} />
        <Figure label="Played" value={stats.played} />
        <Figure
          label="Win rate"
          value={stats.played > 0 ? `${Math.round(stats.winRate * 100)}%` : '—'}
        />
      </div>

      {isAnonymous && (
        <ChunkyCard variant="surface-container-high">
          <ChunkyCardContent className="flex flex-col items-center gap-2 py-5 text-center">
            <h3 className="font-headline text-lg font-bold text-on-surface">Keep your streak</h3>
            <p className="text-sm text-on-surface-variant">
              Your stats live on this device only. Add an account to keep them.
            </p>
            <Link href={`/auth?redirect=${encodeURIComponent(ROUTE_CONSTANTS.CLUSTERS)}`} className="w-full">
              <ChunkyButton variant="secondary" size="lg" className="w-full">
                Create an account
              </ChunkyButton>
            </Link>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href={`${ROUTE_CONSTANTS.CLUSTERS}/stats`} className="text-ds-tertiary underline-offset-4 hover:underline">
          Your stats
        </Link>
        <span className="text-outline">·</span>
        <Link href={`${ROUTE_CONSTANTS.CLUSTERS}/calendar`} className="text-ds-tertiary underline-offset-4 hover:underline">
          Past puzzles
        </Link>
      </div>

      {editor && (
        <p className="text-center text-xs text-on-surface-variant/60">
          Puzzle by {editor}, originally published by The New York Times
          {sourceDate ? ` on ${sourceDate}` : ''}.
        </p>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container px-3 py-3 text-center">
      <p className="font-headline text-xl font-extrabold tabular-nums text-on-surface">{value}</p>
      <p className="font-label text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </p>
    </div>
  )
}

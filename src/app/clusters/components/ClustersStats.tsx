'use client'

import Link from 'next/link'

import { useClustersUser } from '@/app/clusters/hooks/useClustersUser'
import { MAX_MISTAKES, statsFrom } from '@/app/clusters/models/clusters'
import { ROUTE_CONSTANTS } from '@/app/route-constants'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { displayedStreak } from '@/lib/clusters/profile'
import { formatDisplayDate } from '@/lib/dates'

const BUCKET_LABEL = ['No mistakes', '1 mistake', '2 mistakes', '3 mistakes', 'Lost']

export function ClustersStats({ today }: { today: string }) {
  const { loading, profile, history, isAnonymous } = useClustersUser()

  if (loading) {
    return <p className="py-16 text-center text-sm text-on-surface-variant">Loading your stats…</p>
  }

  const stats = statsFrom(profile)
  const streak = displayedStreak(profile, today)
  const peak = Math.max(1, ...profile.mistakeDistribution)

  if (stats.played === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface">Your stats</h1>
        <p className="text-sm text-on-surface-variant">
          Nothing here yet. Finish a puzzle and your record starts.
        </p>
        <Link href={ROUTE_CONSTANTS.CLUSTERS}>
          <ChunkyButton variant="primary" size="lg">
            Play today&apos;s puzzle
          </ChunkyButton>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-6">
      <header>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface">Your stats</h1>
        <p className="text-xs text-on-surface-variant">Clusters</p>
      </header>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-ds-sm border border-outline-variant bg-outline-variant">
        <Figure label="Completed" value={stats.played} />
        <Figure label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} />
        <Figure label="Current streak" value={streak} />
        <Figure label="Max streak" value={stats.maxStreak} />
        <Figure label="Perfect" value={stats.perfect} />
        <Figure label="Purple firsts" value={stats.purpleFirst} />
      </div>

      <section>
        <h2 className="mb-3 font-headline text-lg font-bold text-on-surface">Mistakes per puzzle</h2>
        <ul className="flex flex-col gap-2">
          {profile.mistakeDistribution.map((count, bucket) => (
            <li key={bucket} className="grid grid-cols-[92px_1fr_28px] items-center gap-3">
              <span className="font-label text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
                {BUCKET_LABEL[bucket]}
              </span>
              <span className="h-4 overflow-hidden rounded-sm bg-surface-container-low">
                <span
                  className={`block h-full ${
                    bucket === MAX_MISTAKES ? 'bg-ds-error/45' : 'bg-primary-container'
                  }`}
                  style={{ width: `${Math.round((count / peak) * 100)}%` }}
                />
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-on-surface">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 font-headline text-lg font-bold text-on-surface">Recent puzzles</h2>
          <ul className="divide-y divide-outline-variant">
            {history.map((game) => (
              <li key={game.date} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link
                  href={`${ROUTE_CONSTANTS.CLUSTERS}/${game.date}`}
                  className="text-on-surface underline-offset-4 hover:underline"
                >
                  #{game.puzzleNumber} · {formatDisplayDate(game.date)}
                </Link>
                <span className="flex items-center gap-2 text-on-surface-variant">
                  {game.purpleFirst && (
                    <span
                      className="rounded-full px-2 py-0.5 font-label text-[9px] uppercase tracking-[0.12em]"
                      style={{ backgroundColor: 'var(--cl-purple)', color: 'var(--cl-ink)' }}
                    >
                      Purple first
                    </span>
                  )}
                  {game.status === 'won' ? (
                    <span className="tabular-nums">
                      {game.mistakes === 0 ? 'Perfect' : `${game.mistakes} off`}
                    </span>
                  ) : (
                    <span className="text-ds-error">Lost</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAnonymous && (
        <ChunkyCard variant="surface-container-high">
          <ChunkyCardContent className="flex flex-col items-center gap-2 py-5 text-center">
            <p className="text-sm text-on-surface-variant">
              These stats live on this device only. Add an account to keep them.
            </p>
            <Link href={`/auth?redirect=${encodeURIComponent(ROUTE_CONSTANTS.CLUSTERS)}`}>
              <ChunkyButton variant="secondary">Create an account</ChunkyButton>
            </Link>
          </ChunkyCardContent>
        </ChunkyCard>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container px-3 py-4 text-center">
      <p className="font-headline text-2xl font-extrabold tabular-nums text-on-surface">{value}</p>
      <p className="font-label text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
        {label}
      </p>
    </div>
  )
}

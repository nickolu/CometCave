'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { ArchiveDay, ArchiveResponse } from '@/app/clusters/models/clusters'
import { ROUTE_CONSTANTS } from '@/app/route-constants'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<ArchiveDay['status'], string> = {
  won: 'solved',
  lost: 'lost',
  in_progress: 'in progress',
  unplayed: 'not played',
}

function monthKey(date: string): string {
  return date.slice(0, 7)
}

function monthTitle(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function ClustersCalendar() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<ArchiveResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false

    async function load() {
      try {
        const token = await user!.getIdToken()
        const res = await fetch('/api/v1/clusters/archive', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Could not load past puzzles.')
        const body = (await res.json()) as ArchiveResponse
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 py-16 text-center">
        <h1 className="font-headline text-xl font-bold text-on-surface">Something went wrong.</h1>
        <p className="text-sm text-on-surface-variant">{error}</p>
      </div>
    )
  }

  if (!data) {
    return <p className="py-16 text-center text-sm text-on-surface-variant">Loading past puzzles…</p>
  }

  // Newest month first — the regular is here for a day they missed recently.
  const months = [...new Set(data.days.map((d) => monthKey(d.date)))].reverse()

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">Past puzzles</h1>
          <p className="text-xs text-on-surface-variant">
            {data.days.length} available · a day can only be played once
          </p>
        </div>
        <Link href={ROUTE_CONSTANTS.CLUSTERS}>
          <ChunkyButton variant="ghost" size="sm">
            Today
          </ChunkyButton>
        </Link>
      </header>

      {months.map((key) => {
        const days = data.days.filter((d) => monthKey(d.date) === key)
        return (
          <section key={key}>
            <h2 className="mb-2 font-label text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
              {monthTitle(key)}
            </h2>
            <ul className="grid grid-cols-7 gap-1.5">
              {days.map((day) => (
                <li key={day.date}>
                  <Link
                    href={`${ROUTE_CONSTANTS.CLUSTERS}/${day.date}`}
                    aria-label={`Puzzle ${day.puzzleNumber}, ${day.date}, ${STATUS_LABEL[day.status]}`}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center rounded-sm border text-xs font-bold tabular-nums',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary',
                      day.status === 'won' &&
                        'border-transparent bg-primary-container text-on-primary-container',
                      day.status === 'lost' && 'border-ds-error/50 bg-ds-error/15 text-on-surface',
                      day.status === 'in_progress' &&
                        'border-ds-tertiary/60 bg-ds-tertiary/10 text-on-surface',
                      day.status === 'unplayed' &&
                        'border-outline-variant bg-surface-container text-on-surface-variant hover:border-outline'
                    )}
                  >
                    <span>{Number(day.date.slice(8, 10))}</span>
                    {/* Never show the outcome of a day still worth playing. */}
                    {day.status === 'won' && day.mistakes !== null && (
                      <span className="text-[9px] font-normal opacity-75">
                        {day.mistakes === 0 ? '★' : day.mistakes}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
        <li>★ perfect</li>
        <li>number = mistakes</li>
        <li>outlined = not played</li>
      </ul>
    </div>
  )
}

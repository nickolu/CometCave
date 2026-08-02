'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'

import { TriviaFooter } from '../components/TriviaFooter'

interface PodiumEntry {
  uid: string
  displayName: string
  score: number
  rank: 1 | 2 | 3
}

interface WeekWinner {
  weekKey: string
  podium: PodiumEntry[]
}

const RANK_STYLES = {
  1: { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', icon: '🥇' },
  2: { color: 'text-gray-300', bg: 'bg-gray-300/10 border-gray-300/20', icon: '🥈' },
  3: { color: 'text-amber-600', bg: 'bg-amber-600/10 border-amber-600/20', icon: '🥉' },
} as const

function weekKeyToDateRange(weekKey: string): string {
  // Parse "2026-W19" → date range like "May 5 – May 11, 2026"
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return weekKey

  const year = parseInt(match[1])
  const week = parseInt(match[2])

  // ISO week date to calendar date
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const jan1Day = jan1.getUTCDay() || 7
  const mondayOfWeek1 = new Date(jan1)
  mondayOfWeek1.setUTCDate(jan1.getUTCDate() + (1 - jan1Day))

  const monday = new Date(mondayOfWeek1)
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7)

  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

  const yearStr = monday.getUTCFullYear()
  return `${fmt(monday)} – ${fmt(sunday)}, ${yearStr}`
}

export default function WinnersPage() {
  const { user } = useAuth()
  const [winners, setWinners] = useState<WeekWinner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/trivia/weekly-winners', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setWinners(data.winners ?? [])
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const currentUid = user?.uid

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="w-full flex items-center justify-between">
        <Link
          href="/trivia"
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors text-sm underline-offset-4 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="font-headline text-headline-lg text-ds-tertiary">Past Winners</h1>
        <div className="w-16" />
      </div>

      {loading && (
        <p className="text-on-surface/50 text-sm">Loading...</p>
      )}

      {!loading && winners.length === 0 && (
        <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-6 pb-6 text-center">
            <p className="text-on-surface/50">No weekly winners yet. Keep playing!</p>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {winners.map((week) => (
        <ChunkyCard key={week.weekKey} variant="surface-container-high" className="w-full">
          <ChunkyCardContent className="pt-4 pb-4">
            <h3 className="text-on-surface/70 text-xs font-semibold uppercase tracking-wide mb-3">
              {weekKeyToDateRange(week.weekKey)}
            </h3>
            <div className="flex flex-col gap-2">
              {week.podium.map((entry) => {
                const style = RANK_STYLES[entry.rank]
                const isCurrentUser = currentUid === entry.uid

                return (
                  <div
                    key={entry.uid}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border ${style.bg} ${isCurrentUser ? 'ring-1 ring-yellow-400/40' : ''}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{style.icon}</span>
                      <span className={`text-sm font-semibold ${isCurrentUser ? 'text-yellow-400' : 'text-on-surface'}`}>
                        {isCurrentUser ? 'You!' : entry.displayName}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${style.color}`}>
                      {entry.score.toLocaleString()} pts
                    </span>
                  </div>
                )
              })}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      ))}

      <TriviaFooter />
    </div>
  )
}

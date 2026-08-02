'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'

interface PodiumEntry {
  uid: string
  displayName: string
  score: number
  rank: 1 | 2 | 3
}

interface WinnerData {
  weekKey: string | null
  podium: PodiumEntry[]
}

const STORAGE_KEY_PREFIX = 'trivia:lastSeenWinnerWeek'

function getStorageKey(uid?: string): string {
  return uid ? `${STORAGE_KEY_PREFIX}:${uid}` : `${STORAGE_KEY_PREFIX}:anon`
}

const RANK_STYLES = {
  1: { label: '1st', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', icon: '🥇' },
  2: { label: '2nd', color: 'text-gray-300', bg: 'bg-gray-300/10 border-gray-300/20', icon: '🥈' },
  3: { label: '3rd', color: 'text-amber-600', bg: 'bg-amber-600/10 border-amber-600/20', icon: '🥉' },
} as const

export function WeeklyWinnerBanner() {
  const { user } = useAuth()
  const [data, setData] = useState<WinnerData | null>(null)
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/trivia/weekly-winner', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`weekly-winner fetch failed: ${res.status}`)
        return res.json()
      })
      .then((d: WinnerData) => {
        setData(d)
        if (d.weekKey) {
          const key = getStorageKey(user?.uid)
          const seen = localStorage.getItem(key)
          setDismissed(seen === d.weekKey)
        } else {
          setDismissed(true)
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[WeeklyWinnerBanner] Failed to load winner data:', err)
        // Hide the banner rather than showing broken state
        setDismissed(true)
      })
    return () => controller.abort()
  }, [user?.uid])

  if (data === null || dismissed === null || dismissed) return null
  if (!data.weekKey || data.podium.length === 0) return null

  const currentUid = user?.uid
  const isOnPodium = currentUid && data.podium.some((p) => p.uid === currentUid)

  function handleDismiss() {
    if (data?.weekKey) {
      const key = getStorageKey(user?.uid)
      localStorage.setItem(key, data.weekKey)
    }
    setDismissed(true)
  }

  return (
    <ChunkyCard variant="surface-container-high" className="w-full border-yellow-400/20">
      <ChunkyCardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-headline text-base text-yellow-400 font-bold">
              Last Week&apos;s Champions
            </h3>
            <p className="text-on-surface/40 text-xs">{data.weekKey}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-on-surface/40 hover:text-on-surface/70 transition-colors text-sm p-1"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {data.podium.map((entry) => {
            const style = RANK_STYLES[entry.rank]
            const isCurrentUser = currentUid === entry.uid

            return (
              <div
                key={entry.uid}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${style.bg} ${isCurrentUser ? 'ring-1 ring-yellow-400/40' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{style.icon}</span>
                  <div>
                    <span className={`text-sm font-semibold ${isCurrentUser ? 'text-yellow-400' : 'text-on-surface'}`}>
                      {isCurrentUser ? 'You!' : entry.displayName}
                    </span>
                    {isCurrentUser && (
                      <p className="text-xs text-yellow-400/70">
                        You placed {style.label}!
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-bold ${style.color}`}>
                  {entry.score.toLocaleString()} pts
                </span>
              </div>
            )
          })}
        </div>

        {isOnPodium && (
          <p className="text-center text-xs text-yellow-400/60 mt-3">
            Congratulations on making the podium!
          </p>
        )}

        <Link
          href="/trivia/winners"
          className="block text-center text-xs text-on-surface/40 hover:text-ds-tertiary mt-3 underline-offset-4 hover:underline transition-colors"
        >
          See all past winners
        </Link>
      </ChunkyCardContent>
    </ChunkyCard>
  )
}

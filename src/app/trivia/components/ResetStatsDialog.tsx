'use client'

import { useEffect, useState } from 'react'

import { clearTodayResult } from '@/app/trivia/lib/todayLocalStorage'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'

export interface ResetScopes {
  daily: boolean
  infinite: boolean
}

interface Props {
  onClose: () => void
  onResetComplete?: (scopes: ResetScopes) => void
}

export function ResetStatsDialog({ onClose, onResetComplete }: Props) {
  const { user } = useAuth()
  const [daily, setDaily] = useState(false)
  const [infinite, setInfinite] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, pending])

  const canSubmit = (daily || infinite) && !pending && !!user

  const handleSubmit = async () => {
    if (!canSubmit || !user) return
    setPending(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/v1/trivia/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ daily, infinite }),
      })
      if (!res.ok) {
        let detail = `${res.status}`
        try {
          const body = (await res.json()) as { error?: string; partialFailure?: { message?: string } }
          if (body?.error) detail = body.error
          else if (body?.partialFailure?.message) detail = body.partialFailure.message
        } catch {
          // fall through with status code
        }
        setError(`Couldn't reset (${detail}). Try again.`)
        setPending(false)
        return
      }
      if (daily) clearTodayResult(getTodayPST())
      onResetComplete?.({ daily, infinite })
      onClose()
    } catch (err) {
      setError(
        `Couldn't reset (${err instanceof Error ? err.message : 'network error'}). Try again.`
      )
      setPending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-stats-title"
      className="fixed inset-0 bg-surface-dim/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={() => {
        if (!pending) onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-ds-lg border border-outline-variant bg-surface-container p-6 shadow-hero"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reset-stats-title" className="text-lg font-bold text-ds-tertiary mb-3">
          Begin again?
        </h2>
        <p className="text-on-surface/80 text-sm mb-4">
          Pick what to dissolve. Streaks, runs, and leaderboard rank will scatter back into
          the cave dust. Future games count toward fresh totals.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 -m-2 hover:bg-surface-variant/20 transition-colors">
            <input
              type="checkbox"
              checked={daily}
              onChange={(e) => setDaily(e.target.checked)}
              disabled={pending}
              className="mt-1 accent-ds-tertiary"
            />
            <span>
              <span className="block text-on-surface text-sm font-semibold">Daily trivia</span>
              <span className="block text-on-surface/60 text-xs">
                Streaks, history, and leaderboard entries.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-md p-2 -m-2 hover:bg-surface-variant/20 transition-colors">
            <input
              type="checkbox"
              checked={infinite}
              onChange={(e) => setInfinite(e.target.checked)}
              disabled={pending}
              className="mt-1 accent-ds-tertiary"
            />
            <span>
              <span className="block text-on-surface text-sm font-semibold">Infinite trivia</span>
              <span className="block text-on-surface/60 text-xs">
                Best runs, accuracy, and category medals.
              </span>
            </span>
          </label>
        </div>

        {error && <p className="text-ds-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <ChunkyButton variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </ChunkyButton>
          <ChunkyButton variant="exit" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? 'Dissolving…' : 'Reset'}
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

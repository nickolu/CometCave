'use client'

import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { useAuth } from '@/hooks/useAuth'

import { FlagQuestion } from './FlagQuestion'

interface FlagResult {
  bonusLifeGranted: boolean
}

interface Props {
  questionId: string
  runId?: string | null
  // Fired after the player rates, completes a flag, or otherwise
  // signals they're done with this question. The host decides whether
  // that means "next question" or "view run summary".
  onComplete: () => void
  // Optional flag callback so the host can react to bonus-life rewards
  // before progression happens.
  onFlagged?: (result: FlagResult) => void
}

// Forces the player to rate (or flag) before moving on. The vote
// itself doubles as the advance click — single tap, no separate Next
// button. Best-effort against the rate API; we always advance even if
// the network request fails so a flaky connection doesn't trap the
// player on a question.
export function RateGate({ questionId, runId, onComplete, onFlagged }: Props) {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState<'up' | 'down' | null>(null)

  const handleVote = async (vote: 'up' | 'down') => {
    if (submitting) return
    setSubmitting(vote)
    if (user) {
      try {
        const token = await user.getIdToken()
        await fetch(`/api/v1/trivia/questions/${questionId}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ vote }),
        })
      } catch {
        // Best-effort — advance anyway. The rating UI in the run
        // summary lets them retry if they care.
      }
    }
    onComplete()
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <p className="text-on-surface/60 text-xs uppercase tracking-widest">
        How was this question?
      </p>
      <div className="flex w-full gap-2">
        <ChunkyButton
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={submitting !== null}
          onClick={() => handleVote('up')}
          aria-label="Good question — continue"
        >
          <span className="text-xl">👍</span>
          <span>Good</span>
        </ChunkyButton>
        <ChunkyButton
          variant="secondary"
          size="lg"
          className="flex-1"
          disabled={submitting !== null}
          onClick={() => handleVote('down')}
          aria-label="Bad question — continue"
        >
          <span className="text-xl">👎</span>
          <span>Bad</span>
        </ChunkyButton>
      </div>
      <button
        type="button"
        onClick={onComplete}
        disabled={submitting !== null}
        className="mt-1 px-4 py-1.5 rounded-md text-xs text-on-surface/50 bg-surface-variant/20 border border-outline-variant/30 hover:text-on-surface/80 hover:bg-surface-variant/30 transition-colors disabled:opacity-50"
      >
        Skip rating and go to next question
      </button>
      <div className="flex items-center gap-1 text-on-surface/40 text-xs">
        <FlagQuestion
          questionId={questionId}
          runId={runId}
          onFlagged={(result) => {
            onFlagged?.(result)
            onComplete()
          }}
        />
        <span>report a problem</span>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'

interface RunData {
  runId: string
  longestStreak: number
  score: number
  questionsAnswered: number
  trailblazes: number
  mode: 'scored' | 'practice'
  categoryLabel: string
}

export function RunSharePage({ run }: { run: RunData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePlayThisRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/trivia/infinite/runs/${run.runId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to start replay')
      }
      const data = await res.json()
      window.location.href = `/trivia/infinite?replayRunId=${encodeURIComponent(data.replayRunId)}&replaySourceRunId=${encodeURIComponent(run.runId)}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-10 px-4">
      <div className="text-center">
        <h1 className="font-headline text-headline-lg text-ds-tertiary drop-shadow-[0_4px_0_var(--surface-container-lowest)] mb-2">
          CometCave Trivia
        </h1>
        <p className="text-on-surface/50 text-sm">A traveler completed this run — can you beat them?</p>
      </div>

      <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-6">
          {run.categoryLabel && (
            <div className="flex justify-center mb-3">
              <Pill tone="info" size="sm">{run.categoryLabel}</Pill>
            </div>
          )}
          <div className="text-center mb-4">
            <div className="text-6xl font-bold text-ds-tertiary">
              🔥 {run.longestStreak}
            </div>
            <div className="text-on-surface/40 text-sm mt-1">Longest Streak</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{run.score.toLocaleString()}</div>
              <div className="text-on-surface/50 text-xs">Score</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{run.questionsAnswered}</div>
              <div className="text-on-surface/50 text-xs">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-ds-tertiary">{run.trailblazes}</div>
              <div className="text-on-surface/50 text-xs">First Answers</div>
            </div>
          </div>

          {run.mode === 'practice' && (
            <div className="flex justify-center mt-3">
              <Pill tone="info" size="sm">Practice Run</Pill>
            </div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {error && (
        <p className="text-error text-sm text-center">{error}</p>
      )}

      <ChunkyButton
        variant="primary"
        size="hero"
        className="w-full"
        onClick={handlePlayThisRun}
        disabled={loading}
      >
        {loading ? 'Starting…' : `Play this run (${run.questionsAnswered} questions)`}
      </ChunkyButton>

      <ChunkyButton
        variant="secondary"
        className="w-full"
        onClick={() => window.location.href = '/trivia'}
      >
        Play a New Run
      </ChunkyButton>

      <p className="text-on-surface/30 text-xs text-center">
        CometCave — an endless trivia adventure
      </p>
    </div>
  )
}

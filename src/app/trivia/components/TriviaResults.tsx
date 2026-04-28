'use client'

import { useEffect, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'
import { formatDisplayDate } from '@/lib/dates'
import { getDailyCategory } from '@/lib/trivia/categories'

import { SignInCard } from './SignInCTA'



const MAX_SCORE = 3150

function getScoreRating(percentage: number) {
  if (percentage === 100) return 'Perfect!'
  if (percentage >= 80) return 'Amazing!'
  if (percentage >= 60) return 'Great!'
  if (percentage >= 40) return 'Good'
  return 'Keep trying!'
}

function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${seconds}s`
}

function getShareText(
  result: TriviaGameResult,
  options: { streak?: number; playerName?: string | null } = {}
): string {
  const date = new Date(result.date + 'T12:00:00')
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const category = getDailyCategory(result.date)

  const squares = result.answers
    .map((a) => (a.correct ? '🟩' : '🟥'))
    .join('')

  const pct = Math.round((result.score / MAX_SCORE) * 100)
  const lines = [
    `🧠 CometCave Daily Trivia — ${dateStr}`,
    `Theme: ${category.icon} ${category.name}`,
    squares,
    `Score: ${result.score.toLocaleString()} / ${MAX_SCORE.toLocaleString()} (${pct}%)`,
  ]
  if (options.streak && options.streak >= 2) {
    lines.push(`🔥 ${options.streak}-day streak`)
  }
  if (options.playerName) {
    lines.push(`— played by ${options.playerName}`)
  }
  lines.push('https://cometcave.com/trivia')
  return lines.join('\n')
}

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
      const midnight = new Date(pstNow)
      midnight.setDate(midnight.getDate() + 1)
      midnight.setHours(0, 0, 0, 0)

      const diff = midnight.getTime() - pstNow.getTime()
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return timeLeft
}

interface TriviaResultsProps {
  result: TriviaGameResult
  onBack: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
  // Optional: pass questions data for difficulty display
  questionDifficulties?: Array<{ difficulty: string; source: string }>
}

export function TriviaResults({ result, onBack, onViewStats, onViewLeaderboard }: TriviaResultsProps) {
  const [copied, setCopied] = useState(false)
  const { user } = useAuth()
  const { stats, displayName } = useTriviaUser()
  const currentStreak = stats.currentStreak
  const countdown = useCountdown()

  const scorePercent = Math.round((result.score / MAX_SCORE) * 100)
  const correctPercent = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0

  const handleShare = async () => {
    const playerName = user ? displayName || user.email || null : null
    const text = getShareText(result, {
      streak: user ? currentStreak : undefined,
      playerName,
    })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 max-w-lg mx-auto py-6">
      {/* Header */}
      <div className="text-center">
        <h2 aria-live="polite" className="font-headline text-headline-lg text-ds-tertiary drop-shadow-[0_4px_0_var(--surface-container-lowest)] mb-1">
          {getScoreRating(correctPercent)}
        </h2>
        <p className="text-on-surface/50 text-sm">{formatDisplayDate(result.date)}</p>
      </div>

      {/* Score card */}
      <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-ds-tertiary">
              {result.score.toLocaleString()}
            </div>
            <div className="text-on-surface/40 text-sm">
              / {MAX_SCORE.toLocaleString()} ({scorePercent}%)
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">
                {result.correct}/{result.total}
              </div>
              <div className="text-on-surface/50 text-xs">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{correctPercent}%</div>
              <div className="text-on-surface/50 text-xs">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-ds-tertiary">{currentStreak}</div>
              <div className="text-on-surface/50 text-xs">Streak</div>
            </div>
          </div>

          {/* Wordle-style squares */}
          <div className="flex gap-1.5 justify-center mb-4">
            {result.answers.map((a, i) => (
              <div
                key={i}
                className={`w-9 h-9 rounded flex items-center justify-center text-lg ${
                  a.correct
                    ? 'bg-primary-container/40 border border-primary-container/50'
                    : 'bg-ds-error/40 border border-ds-error/50'
                }`}
              >
                {a.correct ? '🟩' : '🟥'}
              </div>
            ))}
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {currentStreak > 0 && (
        <Pill tone={currentStreak >= stats.bestStreak ? 'hot' : 'info'} icon="local_fire_department">
          {currentStreak} day streak
        </Pill>
      )}

      {/* Per-question breakdown */}
      <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-4">
          <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Question Breakdown
          </h3>
          <div className="flex flex-col gap-2">
            {result.answers.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded bg-surface-dim/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-on-surface/50 text-sm font-mono w-4">
                    {i + 1}
                  </span>
                  <span className={`text-lg ${a.correct ? 'text-ds-primary' : 'text-ds-error'}`}>
                    {a.correct ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-on-surface/40 text-xs">
                    {formatTime(a.timeMs)}
                  </span>
                  <span
                    className={`font-bold text-sm min-w-[4rem] text-right ${
                      a.correct ? 'text-ds-tertiary' : 'text-on-surface/30'
                    }`}
                  >
                    +{a.points}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Share button */}
      <ChunkyButton
        variant="primary"
        size="hero"
        className="w-full"
        onClick={handleShare}
      >
        {copied ? 'Copied!' : 'Share Score'}
      </ChunkyButton>

      {!user && (
        <SignInCard
          title="🔒 Your score wasn't saved"
          description="Sign in to track your streak, save your stats, and compete on the leaderboard."
        />
      )}

      {/* Countdown to next reset */}
      <div className="text-center text-on-surface/40 text-sm">
        Next trivia in <span className="text-on-surface/60 font-mono">{countdown}</span>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-3 gap-2 w-full">
        <ChunkyButton variant="secondary" size="sm" onClick={onBack}>
          Back
        </ChunkyButton>
        {onViewStats && (
          <ChunkyButton variant="secondary" size="sm" onClick={onViewStats}>
            Stats
          </ChunkyButton>
        )}
        {onViewLeaderboard && (
          <ChunkyButton variant="secondary" size="sm" onClick={onViewLeaderboard}>
            Board
          </ChunkyButton>
        )}
      </div>
    </div>
  )
}

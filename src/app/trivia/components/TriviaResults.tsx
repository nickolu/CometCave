'use client'

import { useEffect, useState } from 'react'

import { useAuth } from '@/app/trivia/hooks/useAuth'
import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { formatDisplayDate, getDailyCategory } from '@/app/trivia/lib/triviaUtils'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
  const { userData: firestoreUser } = useTriviaUser()
  const currentStreak = firestoreUser.stats.currentStreak
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const countdown = useCountdown()

  useEffect(() => {
    if (!user || scoreSubmitted) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/v1/trivia/submit-score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: result.date,
            score: result.score,
            correct: result.correct,
            total: result.total,
          }),
        })
        if (!cancelled && res.ok) setScoreSubmitted(true)
      } catch (err) {
        console.error('Failed to submit score:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, scoreSubmitted, result])
  const scorePercent = Math.round((result.score / MAX_SCORE) * 100)
  const correctPercent = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0

  const handleShare = async () => {
    const playerName = user ? user.displayName ?? user.email ?? null : null
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
        <h2 className="text-3xl font-bold text-space-gold mb-1">
          {getScoreRating(correctPercent)}
        </h2>
        <p className="text-cream-white/50 text-sm">{formatDisplayDate(result.date)}</p>
      </div>

      {/* Score card */}
      <Card className="w-full bg-space-dark/80 border-space-grey">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-space-gold">
              {result.score.toLocaleString()}
            </div>
            <div className="text-cream-white/40 text-sm">
              / {MAX_SCORE.toLocaleString()} ({scorePercent}%)
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-cream-white">
                {result.correct}/{result.total}
              </div>
              <div className="text-cream-white/50 text-xs">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-cream-white">{correctPercent}%</div>
              <div className="text-cream-white/50 text-xs">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-space-gold">{currentStreak}</div>
              <div className="text-cream-white/50 text-xs">Streak</div>
            </div>
          </div>

          {/* Wordle-style squares */}
          <div className="flex gap-1.5 justify-center mb-4">
            {result.answers.map((a, i) => (
              <div
                key={i}
                className={`w-9 h-9 rounded flex items-center justify-center text-lg ${
                  a.correct
                    ? 'bg-green-600/40 border border-green-500/50'
                    : 'bg-red-600/40 border border-red-500/50'
                }`}
              >
                {a.correct ? '🟩' : '🟥'}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-question breakdown */}
      <Card className="w-full bg-space-dark/80 border-space-grey">
        <CardContent className="pt-4">
          <h3 className="text-cream-white/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Question Breakdown
          </h3>
          <div className="flex flex-col gap-2">
            {result.answers.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded bg-space-black/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-cream-white/50 text-sm font-mono w-4">
                    {i + 1}
                  </span>
                  <span className={`text-lg ${a.correct ? 'text-green-400' : 'text-red-400'}`}>
                    {a.correct ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-cream-white/40 text-xs">
                    {formatTime(a.timeMs)}
                  </span>
                  <span
                    className={`font-bold text-sm min-w-[4rem] text-right ${
                      a.correct ? 'text-space-gold' : 'text-cream-white/30'
                    }`}
                  >
                    +{a.points}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Share button */}
      <Button
        variant="space"
        size="lg"
        className="w-full py-4 text-lg"
        onClick={handleShare}
      >
        {copied ? 'Copied!' : 'Share Score'}
      </Button>

      {scoreSubmitted && (
        <div className="text-center text-green-400/70 text-sm">
          Score submitted to leaderboard
        </div>
      )}

      {!user && (
        <SignInCard
          title="🔒 Your score wasn't saved"
          description="Sign in to track your streak, save your stats, and compete on the leaderboard."
        />
      )}

      {/* Countdown to next reset */}
      <div className="text-center text-cream-white/40 text-sm">
        Next trivia in <span className="text-cream-white/60 font-mono">{countdown}</span>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-3 gap-2 w-full">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        {onViewStats && (
          <Button variant="outline" onClick={onViewStats}>
            Stats
          </Button>
        )}
        {onViewLeaderboard && (
          <Button variant="outline" onClick={onViewLeaderboard}>
            Board
          </Button>
        )}
      </div>
    </div>
  )
}

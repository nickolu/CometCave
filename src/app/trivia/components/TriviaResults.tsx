'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTriviaStore } from '../hooks/useTriviaStore'
import { formatDisplayDate, getDailyCategory, getTodayPST } from '../lib/triviaUtils'
import type { TriviaGameResult } from '../models/trivia'

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

function getShareText(result: TriviaGameResult): string {
  const date = new Date(result.date + 'T12:00:00')
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const category = getDailyCategory(result.date)

  const squares = result.answers
    .map((a) => (a.correct ? '🟩' : '🟥'))
    .join('')

  const pct = Math.round((result.score / MAX_SCORE) * 100)

  return `🧠 CometCave Daily Trivia — ${dateStr}\nTheme: ${category.icon} ${category.name}\n${squares}\nScore: ${result.score.toLocaleString()} / ${MAX_SCORE.toLocaleString()} (${pct}%)\nhttps://cometcave.com/trivia`
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

// Difficulty badge styling
const diffBadge: Record<string, string> = {
  easy: 'bg-green-600/30 text-green-400 border border-green-600/50',
  medium: 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50',
  hard: 'bg-red-600/30 text-red-400 border border-red-600/50',
}

// Scoring config to show difficulty in breakdown
const SCORING_CONFIG: Record<string, { maxPoints: number }> = {
  easy: { maxPoints: 300 },
  medium: { maxPoints: 450 },
  hard: { maxPoints: 600 },
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
  const { userData } = useTriviaStore()
  const countdown = useCountdown()
  const scorePercent = Math.round((result.score / MAX_SCORE) * 100)
  const correctPercent = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0

  const handleShare = async () => {
    const text = getShareText(result)
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
              <div className="text-xl font-bold text-space-gold">
                {userData.stats.currentStreak}
              </div>
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

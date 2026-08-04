'use client'

import { useRouter } from 'next/navigation'

import { useMemo } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import { formatDisplayDate } from '@/lib/dates'

import { ResetNoticeButton } from './ResetNoticeButton'
import { SignInCard } from './SignInCTA'

const MAX_SCORE_PER_GAME = 1530

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-ds-primary'
  if (accuracy >= 60) return 'text-yellow-400'
  return 'text-ds-error'
}

export function TriviaStats() {
  const router = useRouter()
  const onBack = () => router.push('/trivia')
  const { user } = useAuth()
  const { stats, history } = useTriviaUser()
  // Treat anonymous Firebase users as "not signed in" for the empty-state CTA.
  const isNamedUser = !!user && !user.isAnonymous

  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
      : 0

  const avgScore = stats.gamesPlayed > 0
    ? Math.round(stats.totalScore / stats.gamesPlayed)
    : 0

  // history already comes back sorted date desc (most recent first)
  const recentHistory = history.slice(0, 14)

  // Highest single-game score
  const bestScore = history.reduce((max, h) => Math.max(max, h.score), 0)

  // Score trend: last 7 vs previous 7 games
  const scoreTrend = useMemo(() => {
    if (history.length < 2) return null
    const recent = history.slice(0, 7)
    const previous = history.slice(7, 14)
    if (previous.length === 0) return null
    const recentAvg = recent.reduce((s, g) => s + g.score, 0) / recent.length
    const previousAvg = previous.reduce((s, g) => s + g.score, 0) / previous.length
    const diff = recentAvg - previousAvg
    const pctChange = previousAvg > 0 ? Math.round((diff / previousAvg) * 100) : 0
    return { recentAvg: Math.round(recentAvg), previousAvg: Math.round(previousAvg), diff: Math.round(diff), pctChange }
  }, [history])

  // Day-of-week activity
  const dayOfWeekStats = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const counts = new Array(7).fill(0)
    for (const game of history) {
      const d = new Date(game.date + 'T12:00:00')
      counts[d.getDay()]++
    }
    const max = Math.max(...counts, 1)
    return days.map((label, i) => ({ label, count: counts[i], pct: Math.round((counts[i] / max) * 100) }))
  }, [history])

  // Speed stats — computed from answer timeMs data
  const speedStats = useMemo(() => {
    const allAnswers = history.flatMap((g) => g.answers ?? [])
    const withTime = allAnswers.filter((a) => (a.timeMs ?? 0) > 0)
    if (withTime.length === 0) return null

    const totalMs = withTime.reduce((s, a) => s + a.timeMs, 0)
    const avgMs = totalMs / withTime.length

    const correctAnswers = withTime.filter((a) => a.correct)
    const incorrectAnswers = withTime.filter((a) => !a.correct)

    const fastestCorrectMs = correctAnswers.length > 0
      ? Math.min(...correctAnswers.map((a) => a.timeMs))
      : null

    const avgCorrectMs = correctAnswers.length > 0
      ? correctAnswers.reduce((s, a) => s + a.timeMs, 0) / correctAnswers.length
      : null

    const avgIncorrectMs = incorrectAnswers.length > 0
      ? incorrectAnswers.reduce((s, a) => s + a.timeMs, 0) / incorrectAnswers.length
      : null

    const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`

    return {
      avg: fmt(avgMs),
      fastestCorrect: fastestCorrectMs !== null ? fmt(fastestCorrectMs) : null,
      avgCorrect: avgCorrectMs !== null ? fmt(avgCorrectMs) : null,
      avgIncorrect: avgIncorrectMs !== null ? fmt(avgIncorrectMs) : null,
    }
  }, [history])

  // Score consistency — median and coefficient of variation
  const consistencyStats = useMemo(() => {
    if (history.length < 5) return null
    const scores = [...history.map((g) => g.score)].sort((a, b) => a - b)
    const mid = Math.floor(scores.length / 2)
    const median = scores.length % 2 === 0
      ? Math.round((scores[mid - 1] + scores[mid]) / 2)
      : scores[mid]

    const mean = scores.reduce((s, v) => s + v, 0) / scores.length
    const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 0
    const consistency = Math.max(0, Math.round((1 - cv) * 100))

    return { median, consistency, avg: Math.round(mean) }
  }, [history])

  // Completion rate — games played vs days since first game
  const completionStats = useMemo(() => {
    if (history.length < 7) return null
    // history is sorted desc; oldest is last
    const oldest = history[history.length - 1]
    if (!oldest) return null
    const firstDate = new Date(oldest.date + 'T12:00:00')
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const diffMs = today.getTime() - firstDate.getTime()
    const daysAvailable = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
    const rate = Math.min(100, Math.round((history.length / daysAvailable) * 100))
    return { gamesPlayed: history.length, daysAvailable, rate }
  }, [history])

  const longestAbsence = useMemo(() => {
    if (history.length < 2) return null
    const dates = [...history].reverse().map(g => new Date(g.date + 'T12:00:00').getTime())
    let maxGap = 0
    for (let i = 1; i < dates.length; i++) {
      const gap = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24))
      if (gap > maxGap) maxGap = gap
    }
    return maxGap > 1 ? maxGap : null
  }, [history])

  const sparklineData = useMemo(() => {
    if (history.length < 3) return null
    const recent = [...history].reverse().slice(-14)
    const scores = recent.map(g => g.score)
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    if (max === min) return null
    return { scores, min, max }
  }, [history])

  // Category performance
  const categoryStats = useMemo(() => {
    const cats = new Map<string, { name: string; icon: string; correct: number; total: number }>()
    for (const game of history) {
      if (!game.category) continue
      const key = game.category.name
      const existing = cats.get(key) ?? { name: game.category.name, icon: game.category.icon, correct: 0, total: 0 }
      existing.correct += game.correct
      existing.total += game.total
      cats.set(key, existing)
    }
    return Array.from(cats.values())
      .filter((c) => c.total >= 8) // At least one full game
      .map((c) => ({ ...c, accuracy: Math.round((c.correct / c.total) * 100) }))
      .sort((a, b) => b.accuracy - a.accuracy)
  }, [history])

  if (stats.gamesPlayed === 0) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
        <h2 className="text-3xl font-bold text-ds-tertiary inline-flex items-center gap-2">
          My Stats
          <ResetNoticeButton />
        </h2>
        {isNamedUser ? (
          <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
            <ChunkyCardContent className="pt-6 text-center">
              <p className="text-on-surface/70 text-lg mb-2">No games played yet</p>
              <p className="text-on-surface/50 text-sm">
                Play your first daily trivia to start building your stats!
              </p>
            </ChunkyCardContent>
          </ChunkyCard>
        ) : (
          <SignInCard
            title="📊 Your stats will appear here"
            description="Sign in to start tracking your scores, streaks, and history."
          />
        )}
        <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
          Back to Trivia
        </ChunkyButton>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-ds-tertiary mb-1 inline-flex items-center gap-2">
          My Stats
          <ResetNoticeButton />
        </h2>
        <p className="text-on-surface/50 text-sm">Your trivia journey so far</p>
      </div>

      {/* Top-level stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-ds-tertiary">
              {stats.gamesPlayed}
            </div>
            <div className="text-on-surface/50 text-xs mt-1">Games Played</div>
          </ChunkyCardContent>
        </ChunkyCard>

        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className={`text-3xl font-bold ${getAccuracyColor(accuracy)}`}>
              {accuracy}%
            </div>
            <div className="text-on-surface/50 text-xs mt-1">Accuracy</div>
          </ChunkyCardContent>
        </ChunkyCard>

        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-on-surface">
              {stats.totalScore.toLocaleString()}
            </div>
            <div className="text-on-surface/50 text-xs mt-1">Total Score</div>
          </ChunkyCardContent>
        </ChunkyCard>

        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-on-surface">
              {avgScore.toLocaleString()}
            </div>
            <div className="text-on-surface/50 text-xs mt-1">Avg / Game</div>
          </ChunkyCardContent>
        </ChunkyCard>

        <ChunkyCard variant="surface-variant" className="col-span-2 bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-ds-tertiary">
              {history.length > 0 ? bestScore.toLocaleString() : '—'}
            </div>
            <div className="text-on-surface/50 text-xs mt-1">Best Score</div>
          </ChunkyCardContent>
        </ChunkyCard>
      </div>

      {/* Streaks */}
      <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-5 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl">🔥</span>
                <span className="text-3xl font-bold text-ds-tertiary">
                  {stats.currentStreak}
                </span>
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Current Streak</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-on-surface-variant">
                {stats.bestStreak}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Best Streak</div>
            </div>
          </div>
          <p className="text-on-surface/30 text-[10px] text-center mt-2">
            Streaks count same-day plays only. Retroactive games count toward other stats.
          </p>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Personal Records */}
      <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-5 pb-5">
          <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Personal Records
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">
                {history.length > 0
                  ? `${Math.max(...history.map(h => h.total > 0 ? Math.round((h.correct / h.total) * 100) : 0))}%`
                  : '—'}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Best accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">
                {history.length > 0 ? bestScore.toLocaleString() : '—'}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Best score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-on-surface">
                {history.length > 0
                  ? history.reduce((sum, h) => sum + h.total, 0).toLocaleString()
                  : '—'}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Questions attempted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-primary">
                {history.length > 0
                  ? history.reduce((sum, h) => sum + h.correct, 0).toLocaleString()
                  : '—'}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Questions correct</div>
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Additional totals */}
      <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-5 pb-5">
          <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Totals
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-on-surface/60 text-sm">Best single game</span>
              <span className="text-ds-tertiary font-bold">
                {bestScore.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface/60 text-sm">Questions answered</span>
              <span className="text-on-surface font-bold">
                {stats.totalQuestions.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface/60 text-sm">Correct answers</span>
              <span className="text-ds-primary font-bold">
                {stats.totalCorrect.toLocaleString()}
              </span>
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Your Pace — speed stats */}
      {speedStats && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Your Pace
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-ds-tertiary">{speedStats.avg}</div>
                <div className="text-on-surface/50 text-xs mt-1">Avg answer time</div>
              </div>
              {speedStats.fastestCorrect && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-ds-tertiary">{speedStats.fastestCorrect}</div>
                  <div className="text-on-surface/50 text-xs mt-1">Fastest correct</div>
                </div>
              )}
              {speedStats.avgCorrect && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-ds-primary">{speedStats.avgCorrect}</div>
                  <div className="text-on-surface/50 text-xs mt-1">Avg time (correct)</div>
                </div>
              )}
              {speedStats.avgIncorrect && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-ds-error">{speedStats.avgIncorrect}</div>
                  <div className="text-on-surface/50 text-xs mt-1">Avg time (incorrect)</div>
                </div>
              )}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Your Rhythm — score consistency */}
      {consistencyStats && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Your Rhythm
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-ds-tertiary">{consistencyStats.median.toLocaleString()}</div>
                <div className="text-on-surface/50 text-xs mt-1">Median score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-on-surface">{consistencyStats.avg.toLocaleString()}</div>
                <div className="text-on-surface/50 text-xs mt-1">Average score</div>
              </div>
              <div className="col-span-2 text-center mt-1">
                <div className="text-2xl font-bold text-ds-tertiary">{consistencyStats.consistency}% consistent</div>
                <div className="text-on-surface/50 text-xs mt-1">Higher means steadier performance</div>
              </div>
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Your Orbit — completion rate */}
      {completionStats && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Your Orbit
            </h3>
            <div className="mb-2">
              <div className="text-on-surface/70 text-sm">
                {completionStats.gamesPlayed} of {completionStats.daysAvailable} days —{' '}
                <span className="text-ds-tertiary font-bold">{completionStats.rate}%</span>
              </div>
            </div>
            <div className="w-full h-2 bg-outline-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-ds-tertiary rounded-full transition-all"
                style={{ width: `${completionStats.rate}%` }}
              />
            </div>
            <div className="text-on-surface/40 text-xs mt-2">Days played since your first game</div>
            {longestAbsence && (
              <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid var(--outline-variant)' }}>
                <span className="text-on-surface/60 text-sm">Longest absence</span>
                <span className="text-on-surface font-bold">{longestAbsence} days</span>
              </div>
            )}
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Score trend */}
      {scoreTrend && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Score Trend
            </h3>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="text-2xl font-bold text-on-surface/50">{scoreTrend.previousAvg.toLocaleString()}</div>
                <div className="text-on-surface/40 text-xs">Previous 7 avg</div>
              </div>
              <div className="text-center px-4">
                <div className={`text-2xl font-bold ${scoreTrend.diff > 0 ? 'text-ds-primary' : scoreTrend.diff < 0 ? 'text-ds-error' : 'text-on-surface/50'}`}>
                  {scoreTrend.diff > 0 ? '+' : ''}{scoreTrend.pctChange}%
                </div>
                <div className="text-on-surface/40 text-xs">
                  {scoreTrend.diff > 0 ? 'Improving' : scoreTrend.diff < 0 ? 'Declining' : 'Steady'}
                </div>
              </div>
              <div className="text-center flex-1">
                <div className="text-2xl font-bold text-ds-tertiary">{scoreTrend.recentAvg.toLocaleString()}</div>
                <div className="text-on-surface/40 text-xs">Last 7 avg</div>
              </div>
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {sparklineData && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Score Arc
            </h3>
            <div className="w-full" style={{ height: 48 }}>
              <svg
                viewBox={`0 0 ${(sparklineData.scores.length - 1) * 20} 40`}
                className="w-full h-full"
                preserveAspectRatio="none"
                aria-label={`Score trend over last ${sparklineData.scores.length} games`}
                role="img"
              >
                <polyline
                  fill="none"
                  stroke="var(--ds-tertiary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={sparklineData.scores
                    .map((s, i) => {
                      const x = i * 20
                      const y = 40 - ((s - sparklineData.min) / (sparklineData.max - sparklineData.min)) * 36 - 2
                      return `${x},${y}`
                    })
                    .join(' ')}
                />
              </svg>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-on-surface/30 text-[10px]">{sparklineData.scores.length} games ago</span>
              <span className="text-on-surface/30 text-[10px]">Latest</span>
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Day-of-week activity */}
      {history.length >= 7 && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Play Activity by Day
            </h3>
            <div className="flex items-end justify-between gap-1 h-20">
              {dayOfWeekStats.map((day) => (
                <div key={day.label} className="flex flex-col items-center flex-1 gap-1">
                  <div className="w-full flex justify-center">
                    <div
                      className="w-5 rounded-t bg-ds-tertiary/60 transition-all"
                      style={{ height: `${Math.max(day.pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-on-surface/40">{day.label}</span>
                  <span className="text-[10px] text-on-surface/60 font-medium">{day.count}</span>
                </div>
              ))}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Category performance */}
      {categoryStats.length > 0 && (
        <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Category Performance
            </h3>
            <div className="flex flex-col gap-2">
              {categoryStats.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-dim/40">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-on-surface text-sm">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-1.5 bg-outline-variant rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cat.accuracy >= 80 ? 'bg-ds-primary' : cat.accuracy >= 60 ? 'bg-yellow-400' : 'bg-ds-error'}`}
                        style={{ width: `${cat.accuracy}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold min-w-[3rem] text-right ${getAccuracyColor(cat.accuracy)}`}>
                      {cat.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Recent history */}
      <ChunkyCard variant="surface-variant" className="bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-5 pb-5">
          <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Recent Games
          </h3>
          <div className="flex flex-col gap-2">
            {recentHistory.map((game) => {
              const gameAccuracy =
                game.total > 0 ? Math.round((game.correct / game.total) * 100) : 0
              const scorePercent = Math.round((game.score / MAX_SCORE_PER_GAME) * 100)

              return (
                <div
                  key={game.date}
                  className="flex items-center justify-between py-2 px-3 rounded bg-surface-dim/40"
                >
                  <div className="flex items-center gap-2">
                    {game.category && (
                      <span className="text-lg" title={game.category.name}>
                        {game.category.icon}
                      </span>
                    )}
                    <div className="flex flex-col">
                      <span className="text-on-surface text-sm font-medium">
                        {formatDisplayDate(game.date)}
                        {game.isRetroactive && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-surface-variant/50 text-on-surface/40 uppercase tracking-wide">
                            Retroactive
                          </span>
                        )}
                      </span>
                      <span className="text-on-surface/40 text-xs">
                        {game.correct}/{game.total} correct
                        {game.category && ` · ${game.category.name}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Visual bar */}
                    <div className="w-16 h-2 bg-outline-variant rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ds-tertiary transition-all"
                        style={{ width: `${scorePercent}%` }}
                      />
                    </div>
                    <span
                      className={`font-bold text-sm min-w-[4rem] text-right ${getAccuracyColor(gameAccuracy)}`}
                    >
                      {game.score.toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Navigation */}
      <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
        Back to Trivia
      </ChunkyButton>
    </div>
  )
}

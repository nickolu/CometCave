'use client'
import { useCallback, useEffect, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'

import { SignInCard } from './SignInCTA'

interface RunHistoryEntry {
  runId: string
  mode: 'scored' | 'practice'
  score: number
  longestStreak: number
  questionsAnswered: number
  skipsUsed: number
  endedAt: number | null
}

interface CategoryStats {
  answered: number
  correct: number
  totalTimeMs: number
}

interface DifficultyStats {
  answered: number
  correct: number
}

interface AggregateStats {
  totalAnswered: number
  totalCorrect: number
  totalScore: number
  runsPlayed: number
  bestRun: { score: number; longestStreak: number } | null
  bestStreak: number
  trailblazerCount: number
  totalTimeMs: number
  byCategory: Record<string, CategoryStats>
  byDifficulty: {
    easy: DifficultyStats
    medium: DifficultyStats
    hard: DifficultyStats
  }
  likesGiven?: number
  dislikesGiven?: number
  reportsFiled?: number
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-ds-primary'
  if (accuracy >= 60) return 'text-yellow-400'
  return 'text-ds-error'
}

function AccuracyRing({ accuracy, size = 48 }: { accuracy: number; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (accuracy / 100) * circumference
  const color =
    accuracy >= 80 ? 'stroke-ds-primary' : accuracy >= 60 ? 'stroke-yellow-400' : 'stroke-ds-error'

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={3}
        className="stroke-surface-container-highest"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={color}
      />
    </svg>
  )
}

export function InfiniteStats({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<RunHistoryEntry[]>([])
  const [runsLoading, setRunsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/v1/trivia/stats/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setStats(await res.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    async function loadRuns() {
      if (!user) {
        setRunsLoading(false)
        return
      }
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/v1/trivia/infinite/runs?limit=20', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setRuns(data.runs ?? [])
        }
      } catch {
        // silent
      } finally {
        setRunsLoading(false)
      }
    }
    loadRuns()
  }, [user])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-lg mx-auto">
        <div className="text-on-surface/60 text-lg">Loading stats...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
        <h2 className="text-3xl font-bold text-ds-tertiary">Infinite Stats</h2>
        <SignInCard
          title="Your constellation awaits"
          description="Sign in to track your infinite trivia journey — accuracy, streaks, and category mastery."
        />
        <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
          Back
        </ChunkyButton>
      </div>
    )
  }

  if (!stats || stats.runsPlayed === 0) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
        <h2 className="text-3xl font-bold text-ds-tertiary">Infinite Stats</h2>
        <ChunkyCard
          variant="surface-variant"
          className="w-full bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-6 text-center">
            <p className="text-on-surface/70 text-lg mb-2">The stars haven&apos;t aligned yet</p>
            <p className="text-on-surface/50 text-sm">
              Complete your first infinite run to begin mapping your constellation.
            </p>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyButton
          variant="primary"
          onClick={() => (window.location.href = '/trivia/infinite')}
          className="w-full"
        >
          Start Infinite Trivia
        </ChunkyButton>
        <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
          Back
        </ChunkyButton>
      </div>
    )
  }

  const accuracy =
    stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0
  const avgTimeMs =
    stats.totalAnswered > 0 ? Math.round(stats.totalTimeMs / stats.totalAnswered) : 0
  const categories = Object.entries(stats.byCategory).sort((a, b) => b[1].answered - a[1].answered)

  const avgScorePerRun = stats.runsPlayed > 0
    ? Math.round((stats.totalScore ?? 0) / stats.runsPlayed)
    : 0

  const MIN_CATEGORY_VOLUME = 5
  const qualifiedCategories = categories.filter(([, data]) => data.answered >= MIN_CATEGORY_VOLUME)
  const bestCategory = qualifiedCategories.length > 0
    ? qualifiedCategories.reduce((best, curr) =>
        (curr[1].correct / curr[1].answered) > (best[1].correct / best[1].answered) ? curr : best
      )
    : null
  const worstCategory = qualifiedCategories.length > 0
    ? qualifiedCategories.reduce((worst, curr) =>
        (curr[1].correct / curr[1].answered) < (worst[1].correct / worst[1].answered) ? curr : worst
      )
    : null
  const categoriesExplored = categories.length
  const categoriesWithTime = categories.filter(([, data]) => data.answered >= MIN_CATEGORY_VOLUME && data.totalTimeMs > 0)
  const fastestCategory = categoriesWithTime.length > 0
    ? categoriesWithTime.reduce((fast, curr) =>
        (curr[1].totalTimeMs / curr[1].answered) < (fast[1].totalTimeMs / fast[1].answered) ? curr : fast
      )
    : null
  const slowestCategory = categoriesWithTime.length > 0
    ? categoriesWithTime.reduce((slow, curr) =>
        (curr[1].totalTimeMs / curr[1].answered) > (slow[1].totalTimeMs / slow[1].answered) ? curr : slow
      )
    : null

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-ds-tertiary mb-1">Infinite Stats</h2>
        <p className="text-on-surface/50 text-sm">Your endless trivia journey</p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-3">
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className={`text-3xl font-bold ${getAccuracyColor(accuracy)}`}>{accuracy}%</div>
            <div className="text-on-surface/50 text-xs mt-1">Accuracy</div>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-on-surface">{stats.totalAnswered}</div>
            <div className="text-on-surface/50 text-xs mt-1">Questions</div>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-ds-tertiary">{stats.runsPlayed}</div>
            <div className="text-on-surface/50 text-xs mt-1">Runs Played</div>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-on-surface">
              {Math.round(avgTimeMs / 1000)}s
            </div>
            <div className="text-on-surface/50 text-xs mt-1">Avg Answer</div>
          </ChunkyCardContent>
        </ChunkyCard>
      </div>

      {/* Journey */}
      <ChunkyCard
        variant="surface-variant"
        className="bg-surface-container/80 border-outline-variant"
      >
        <ChunkyCardContent className="pt-5 pb-5">
          <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Journey
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">
                {stats.runsPlayed > 0 ? Math.round(stats.totalAnswered / stats.runsPlayed) : 0}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Avg Q/Run</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">
                {stats.runsPlayed > 0 ? Math.round(stats.totalCorrect / stats.runsPlayed) : 0}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Avg Correct/Run</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">
                {Math.round(stats.totalTimeMs / 1000 / 60)}m
              </div>
              <div className="text-on-surface/50 text-xs mt-1">Time Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">{avgScorePerRun.toLocaleString()}</div>
              <div className="text-on-surface/50 text-xs mt-1">Avg Score/Run</div>
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Best run */}
      {stats.bestRun && (
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Best Run
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-ds-tertiary">
                  🔥 {stats.bestRun.longestStreak}
                </div>
                <div className="text-on-surface/50 text-xs mt-1">Longest Streak</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-on-surface">
                  {stats.bestRun.score.toLocaleString()}
                </div>
                <div className="text-on-surface/50 text-xs mt-1">Score</div>
              </div>
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Streaks + first answers */}
      <ChunkyCard
        variant="surface-variant"
        className="bg-surface-container/80 border-outline-variant"
      >
        <ChunkyCardContent className="pt-5 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-ds-tertiary">{stats.bestStreak}</div>
              <div className="text-on-surface/50 text-xs mt-1">Best Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-on-surface">
                {stats.trailblazerCount}
              </div>
              <div className="text-on-surface/50 text-xs mt-1">First answers</div>
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Category constellation (grid of accuracy rings) */}
      {categories.length > 0 && (
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Category Constellation
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {categories.map(([cat, data]) => {
                const catAccuracy =
                  data.answered > 0 ? Math.round((data.correct / data.answered) * 100) : 0
                return (
                  <div key={cat} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <AccuracyRing accuracy={catAccuracy} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-on-surface">{catAccuracy}%</span>
                      </div>
                    </div>
                    <span className="text-on-surface/60 text-xs text-center leading-tight">
                      {cat}
                    </span>
                    <span className="text-on-surface/30 text-[10px]">
                      {(data.totalTimeMs / data.answered / 1000).toFixed(1)}s avg
                    </span>
                    <span className="text-on-surface/30 text-[10px]">{data.answered} Q</span>
                  </div>
                )
              })}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Category Insights */}
      {(bestCategory || categoriesExplored > 0) && (
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Category Insights
            </h3>
            <div className="flex flex-col gap-3">
              {bestCategory && (
                <div className="flex items-center justify-between">
                  <div className="text-on-surface/60 text-sm">Strongest</div>
                  <div className="text-right">
                    <span className="text-ds-primary font-semibold text-sm">{bestCategory[0]}</span>
                    <span className="text-on-surface/40 text-xs ml-2">
                      {Math.round((bestCategory[1].correct / bestCategory[1].answered) * 100)}%
                    </span>
                  </div>
                </div>
              )}
              {worstCategory && bestCategory && worstCategory[0] !== bestCategory[0] && (
                <div className="flex items-center justify-between">
                  <div className="text-on-surface/60 text-sm">Weakest</div>
                  <div className="text-right">
                    <span className="text-ds-error font-semibold text-sm">{worstCategory[0]}</span>
                    <span className="text-on-surface/40 text-xs ml-2">
                      {Math.round((worstCategory[1].correct / worstCategory[1].answered) * 100)}%
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-on-surface/60 text-sm">Categories Explored</div>
                <div className="text-on-surface font-semibold text-sm">{categoriesExplored}</div>
              </div>
              {categories.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-on-surface/60 text-sm">Favorite</div>
                  <div className="text-right">
                    <span className="text-ds-tertiary font-semibold text-sm">{categories[0][0]}</span>
                    <span className="text-on-surface/40 text-xs ml-2">{categories[0][1].answered} Q</span>
                  </div>
                </div>
              )}
              {fastestCategory && (
                <div className="flex items-center justify-between">
                  <div className="text-on-surface/60 text-sm">Fastest</div>
                  <div className="text-right">
                    <span className="text-on-surface font-semibold text-sm">{fastestCategory[0]}</span>
                    <span className="text-on-surface/40 text-xs ml-2">
                      {(fastestCategory[1].totalTimeMs / fastestCategory[1].answered / 1000).toFixed(1)}s avg
                    </span>
                  </div>
                </div>
              )}
              {slowestCategory && fastestCategory && slowestCategory[0] !== fastestCategory[0] && (
                <div className="flex items-center justify-between">
                  <div className="text-on-surface/60 text-sm">Slowest</div>
                  <div className="text-right">
                    <span className="text-on-surface font-semibold text-sm">{slowestCategory[0]}</span>
                    <span className="text-on-surface/40 text-xs ml-2">
                      {(slowestCategory[1].totalTimeMs / slowestCategory[1].answered / 1000).toFixed(1)}s avg
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Per-difficulty breakdown */}
      <ChunkyCard
        variant="surface-variant"
        className="bg-surface-container/80 border-outline-variant"
      >
        <ChunkyCardContent className="pt-5 pb-5">
          <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            By Difficulty
          </h3>
          {(['easy', 'medium', 'hard'] as const).map((diff) => {
            const d = stats.byDifficulty[diff]
            const pct = d.answered > 0 ? Math.round((d.correct / d.answered) * 100) : 0
            const diffColors = {
              easy: 'bg-green-500',
              medium: 'bg-yellow-500',
              hard: 'bg-red-500',
            }
            return (
              <div key={diff} className="flex items-center gap-3 mb-2">
                <span className="text-on-surface/60 text-sm w-16 capitalize">{diff}</span>
                <div className="flex-1 h-3 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className={`h-full ${diffColors[diff]} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-on-surface/60 text-xs w-12 text-right">
                  {pct}% ({d.answered})
                </span>
              </div>
            )
          })}
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Your Voice */}
      {((stats.likesGiven ?? 0) > 0 || (stats.dislikesGiven ?? 0) > 0 || (stats.reportsFiled ?? 0) > 0) && (
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Your Voice
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-ds-primary">{stats.likesGiven ?? 0}</div>
                <div className="text-on-surface/50 text-xs mt-1">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-on-surface">{stats.dislikesGiven ?? 0}</div>
                <div className="text-on-surface/50 text-xs mt-1">Dislikes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-on-surface">{stats.reportsFiled ?? 0}</div>
                <div className="text-on-surface/50 text-xs mt-1">Reports</div>
              </div>
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Recent Runs */}
      {runs.length > 0 && (
        <ChunkyCard
          variant="surface-variant"
          className="bg-surface-container/80 border-outline-variant"
        >
          <ChunkyCardContent className="pt-5 pb-5">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Recent Runs
            </h3>
            <div className="flex flex-col gap-2">
              {runs.map((run) => {
                const dateStr = run.endedAt
                  ? new Date(run.endedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''
                return (
                  <div
                    key={run.runId}
                    className="flex items-center justify-between py-2 px-3 rounded bg-surface-dim/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-on-surface/40 text-xs w-12">{dateStr}</div>
                      <div className="text-on-surface font-medium text-sm">
                        {run.score.toLocaleString()} pts
                      </div>
                      {run.mode === 'practice' && (
                        <span className="text-on-surface/30 text-xs">(practice)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-on-surface/50">
                      <span>{run.longestStreak} streak</span>
                      <span>{run.questionsAnswered} Qs</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {runsLoading && (
              <div className="text-center text-on-surface/50 py-4 text-sm">Loading...</div>
            )}
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
        Back
      </ChunkyButton>
    </div>
  )
}

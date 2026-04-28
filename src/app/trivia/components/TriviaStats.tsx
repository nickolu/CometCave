'use client'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import { formatDisplayDate } from '@/lib/dates'

import { ResetNoticeButton } from './ResetNoticeButton'
import { SignInCard } from './SignInCTA'

const MAX_SCORE_PER_GAME = 3150

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-ds-primary'
  if (accuracy >= 60) return 'text-yellow-400'
  return 'text-ds-error'
}

export function TriviaStats({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { stats, history } = useTriviaUser()

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

  if (stats.gamesPlayed === 0) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
        <h2 className="text-3xl font-bold text-ds-tertiary inline-flex items-center gap-2">
          My Stats
          <ResetNoticeButton />
        </h2>
        {user ? (
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
                  <div className="flex flex-col">
                    <span className="text-on-surface text-sm font-medium">
                      {formatDisplayDate(game.date)}
                    </span>
                    <span className="text-on-surface/40 text-xs">
                      {game.correct}/{game.total} correct
                    </span>
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

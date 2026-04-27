'use client'

import { useAuth } from '@/app/trivia/hooks/useAuth'
import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { formatDisplayDate } from '@/app/trivia/lib/triviaUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { SignInCard } from './SignInCTA'

const MAX_SCORE_PER_GAME = 3150

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-green-400'
  if (accuracy >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

export function TriviaStats({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { userData: firestoreUser } = useTriviaUser()
  const stats = firestoreUser.stats
  const history = firestoreUser.history

  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
      : 0

  const avgScore = stats.gamesPlayed > 0
    ? Math.round(stats.totalScore / stats.gamesPlayed)
    : 0

  // Last 14 days, most recent first
  const recentHistory = [...history].reverse().slice(0, 14)

  // Highest single-game score
  const bestScore = history.reduce((max, h) => Math.max(max, h.score), 0)

  if (stats.gamesPlayed === 0) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
        <h2 className="text-3xl font-bold text-space-gold">My Stats</h2>
        {user ? (
          <Card className="w-full bg-space-dark/80 border-space-grey">
            <CardContent className="pt-6 text-center">
              <p className="text-cream-white/70 text-lg mb-2">No games played yet</p>
              <p className="text-cream-white/50 text-sm">
                Play your first daily trivia to start building your stats!
              </p>
            </CardContent>
          </Card>
        ) : (
          <SignInCard
            title="📊 Your stats will appear here"
            description="Sign in to start tracking your scores, streaks, and history."
          />
        )}
        <Button variant="outline" onClick={onBack} className="w-full">
          Back to Trivia
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-space-gold mb-1">My Stats</h2>
        <p className="text-cream-white/50 text-sm">Your trivia journey so far</p>
      </div>

      {/* Top-level stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-space-gold">
              {stats.gamesPlayed}
            </div>
            <div className="text-cream-white/50 text-xs mt-1">Games Played</div>
          </CardContent>
        </Card>

        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-5 pb-5 text-center">
            <div className={`text-3xl font-bold ${getAccuracyColor(accuracy)}`}>
              {accuracy}%
            </div>
            <div className="text-cream-white/50 text-xs mt-1">Accuracy</div>
          </CardContent>
        </Card>

        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-cream-white">
              {stats.totalScore.toLocaleString()}
            </div>
            <div className="text-cream-white/50 text-xs mt-1">Total Score</div>
          </CardContent>
        </Card>

        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-5 pb-5 text-center">
            <div className="text-3xl font-bold text-cream-white">
              {avgScore.toLocaleString()}
            </div>
            <div className="text-cream-white/50 text-xs mt-1">Avg / Game</div>
          </CardContent>
        </Card>
      </div>

      {/* Streaks */}
      <Card className="bg-space-dark/80 border-space-grey">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl">🔥</span>
                <span className="text-3xl font-bold text-space-gold">
                  {stats.currentStreak}
                </span>
              </div>
              <div className="text-cream-white/50 text-xs mt-1">Current Streak</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-space-purple-light">
                {stats.bestStreak}
              </div>
              <div className="text-cream-white/50 text-xs mt-1">Best Streak</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional totals */}
      <Card className="bg-space-dark/80 border-space-grey">
        <CardContent className="pt-5 pb-5">
          <h3 className="text-cream-white/70 text-sm font-semibold mb-3 uppercase tracking-wide">
            Totals
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-cream-white/60 text-sm">Best single game</span>
              <span className="text-space-gold font-bold">
                {bestScore.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cream-white/60 text-sm">Questions answered</span>
              <span className="text-cream-white font-bold">
                {stats.totalQuestions.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cream-white/60 text-sm">Correct answers</span>
              <span className="text-green-400 font-bold">
                {stats.totalCorrect.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent history */}
      <Card className="bg-space-dark/80 border-space-grey">
        <CardContent className="pt-5 pb-5">
          <h3 className="text-cream-white/70 text-sm font-semibold mb-3 uppercase tracking-wide">
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
                  className="flex items-center justify-between py-2 px-3 rounded bg-space-black/40"
                >
                  <div className="flex flex-col">
                    <span className="text-cream-white text-sm font-medium">
                      {formatDisplayDate(game.date)}
                    </span>
                    <span className="text-cream-white/40 text-xs">
                      {game.correct}/{game.total} correct
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Visual bar */}
                    <div className="w-16 h-2 bg-space-grey rounded-full overflow-hidden">
                      <div
                        className="h-full bg-space-gold transition-all"
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
        </CardContent>
      </Card>

      {/* Navigation */}
      <Button variant="outline" onClick={onBack} className="w-full">
        Back to Trivia
      </Button>
    </div>
  )
}

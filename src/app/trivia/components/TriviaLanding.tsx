'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTriviaStore } from '../hooks/useTriviaStore'
import { formatDisplayDate, getTodayPST } from '../lib/triviaUtils'

export function TriviaLanding({
  onStartGame,
  onViewStats,
  onViewLeaderboard,
}: {
  onStartGame?: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
}) {
  const { userData, canPlayToday } = useTriviaStore()
  const todayStr = getTodayPST()
  const alreadyPlayed = !canPlayToday()

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-space-gold mb-2">Daily Trivia</h1>
        <p className="text-cream-white/70 text-lg">{formatDisplayDate(todayStr)}</p>
      </div>

      <Card className="w-full bg-space-dark/80 border-space-grey">
        <CardHeader>
          <CardTitle className="text-cream-white text-center">
            {alreadyPlayed ? "You've already played today!" : 'Ready to test your knowledge?'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button
            variant="space"
            size="lg"
            className="w-full text-lg py-6"
            disabled={alreadyPlayed}
            onClick={onStartGame}
          >
            {alreadyPlayed ? 'Come Back Tomorrow' : "Start Today's Trivia"}
          </Button>

          {alreadyPlayed && userData.history.length > 0 && (
            <div className="text-center text-cream-white/60 text-sm">
              Today&apos;s score:{' '}
              <span className="text-space-gold font-semibold">
                {userData.history[userData.history.length - 1].score} pts
              </span>
              {' · '}
              {userData.history[userData.history.length - 1].correct}/
              {userData.history[userData.history.length - 1].total} correct
            </div>
          )}
        </CardContent>
      </Card>

      {/* Streak & Stats */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-space-gold">
              {userData.stats.currentStreak}
            </div>
            <div className="text-cream-white/60 text-sm">Current Streak</div>
          </CardContent>
        </Card>
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-space-purple-light">
              {userData.stats.bestStreak}
            </div>
            <div className="text-cream-white/60 text-sm">Best Streak</div>
          </CardContent>
        </Card>
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-cream-white">
              {userData.stats.gamesPlayed}
            </div>
            <div className="text-cream-white/60 text-sm">Games Played</div>
          </CardContent>
        </Card>
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-cream-white">
              {userData.stats.totalQuestions > 0
                ? Math.round((userData.stats.totalCorrect / userData.stats.totalQuestions) * 100)
                : 0}
              %
            </div>
            <div className="text-cream-white/60 text-sm">Accuracy</div>
          </CardContent>
        </Card>
      </div>

      {/* Links */}
      <div className="flex gap-3 text-sm">
        <button
          onClick={onViewStats}
          className="text-space-gold hover:text-space-gold/80 transition-colors underline-offset-4 hover:underline"
        >
          My Stats
        </button>
        <span className="text-cream-white/20">·</span>
        <button
          onClick={onViewLeaderboard}
          className="text-space-gold hover:text-space-gold/80 transition-colors underline-offset-4 hover:underline"
        >
          Leaderboard
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTriviaStore } from '../hooks/useTriviaStore'

type Period = 'daily' | 'weekly' | 'alltime'

interface DailyEntry {
  displayName: string
  date: string
  score: number
  correct: number
  total: number
}

interface WeeklyEntry {
  displayName: string
  totalScore: number
  gamesPlayed: number
  totalCorrect: number
  totalQuestions: number
}

interface AllTimeEntry {
  displayName: string
  weeklyWins: number
  totalScore: number
}

export function TriviaLeaderboard({ onBack }: { onBack: () => void }) {
  const { userData, setDisplayName } = useTriviaStore()
  const [period, setPeriod] = useState<Period>('daily')
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNameDialog, setShowNameDialog] = useState(!userData.displayName && !userData.nameSkipped)
  const [nameInput, setNameInput] = useState(userData.displayName ?? '')

  const currentName = userData.displayName?.toLowerCase().trim() ?? ''

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/trivia/leaderboard?period=${period}`)
        if (!res.ok) throw new Error('Failed to load leaderboard')
        const json = await res.json()
        setData(json)
      } catch {
        setError('Failed to load leaderboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed.length > 0 && trimmed.length <= 20) {
      setDisplayName(trimmed)
      setShowNameDialog(false)
    }
  }

  const renderEntries = () => {
    if (!data || !data.entries) return null

    if (data.entries.length === 0) {
      return (
        <div className="text-center text-cream-white/50 py-8">
          No scores yet. Be the first!
        </div>
      )
    }

    if (period === 'daily') {
      return data.entries.map((entry: DailyEntry, i: number) => {
        const isCurrentUser = entry.displayName?.toLowerCase().trim() === currentName
        return (
          <LeaderboardRow
            key={`${entry.displayName}-${i}`}
            rank={i + 1}
            name={entry.displayName ?? 'Unknown'}
            primary={(entry.score ?? 0).toLocaleString()}
            secondary={`${entry.correct ?? 0}/${entry.total ?? 0} correct`}
            isCurrentUser={isCurrentUser}
          />
        )
      })
    }

    if (period === 'weekly') {
      return data.entries.map((entry: WeeklyEntry, i: number) => {
        const isCurrentUser = entry.displayName?.toLowerCase().trim() === currentName
        const totalQ = entry.totalQuestions ?? 0
        const accuracy = totalQ > 0
          ? Math.round(((entry.totalCorrect ?? 0) / totalQ) * 100)
          : 0
        return (
          <LeaderboardRow
            key={`${entry.displayName}-${i}`}
            rank={i + 1}
            name={entry.displayName ?? 'Unknown'}
            primary={(entry.totalScore ?? 0).toLocaleString()}
            secondary={`${entry.gamesPlayed ?? 0} games · ${accuracy}%`}
            isCurrentUser={isCurrentUser}
          />
        )
      })
    }

    if (period === 'alltime') {
      return data.entries.map((entry: AllTimeEntry, i: number) => {
        const isCurrentUser = entry.displayName?.toLowerCase().trim() === currentName
        const wins = entry.weeklyWins ?? 0
        return (
          <LeaderboardRow
            key={`${entry.displayName}-${i}`}
            rank={i + 1}
            name={entry.displayName ?? 'Unknown'}
            primary={`${wins} ${wins === 1 ? 'win' : 'wins'}`}
            secondary={`${(entry.totalScore ?? 0).toLocaleString()} pts`}
            isCurrentUser={isCurrentUser}
          />
        )
      })
    }

    return null
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto py-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-space-gold mb-1">Leaderboard</h2>
        {userData.displayName ? (
          <p className="text-cream-white/50 text-sm">
            Playing as{' '}
            <button
              onClick={() => setShowNameDialog(true)}
              className="text-space-gold hover:underline"
            >
              {userData.displayName}
            </button>
          </p>
        ) : (
          <p className="text-cream-white/50 text-sm">
            <button
              onClick={() => setShowNameDialog(true)}
              className="text-space-gold hover:underline"
            >
              Set your display name
            </button>{' '}
            to appear on the leaderboard
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {(['daily', 'weekly', 'alltime'] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'space' : 'outline'}
            onClick={() => setPeriod(p)}
            className="capitalize"
          >
            {p === 'alltime' ? 'All-Time' : p}
          </Button>
        ))}
      </div>

      {/* Content */}
      <Card className="bg-space-dark/80 border-space-grey">
        <CardContent className="pt-4 pb-4">
          {loading ? (
            <div className="text-center text-cream-white/50 py-8">Loading...</div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">{error}</div>
          ) : (
            <div className="flex flex-col gap-1.5">{renderEntries()}</div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onBack} className="w-full">
        Back to Trivia
      </Button>

      {/* Name dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md bg-space-dark border-space-grey">
            <CardContent className="pt-6 flex flex-col gap-4">
              <h3 className="text-xl font-bold text-space-gold text-center">
                {userData.displayName ? 'Change Display Name' : 'Set Display Name'}
              </h3>
              <p className="text-cream-white/60 text-sm text-center">
                This name will appear on the leaderboard (1-20 characters).
              </p>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.slice(0, 20))}
                placeholder="Your display name"
                className="bg-space-black/50 border-space-grey text-cream-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                }}
                autoFocus
              />
              <div className="flex gap-2">
                {userData.displayName && (
                  <Button
                    variant="outline"
                    onClick={() => setShowNameDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="space"
                  onClick={handleSaveName}
                  disabled={nameInput.trim().length === 0}
                  className="flex-1"
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function LeaderboardRow({
  rank,
  name,
  primary,
  secondary,
  isCurrentUser,
}: {
  rank: number
  name: string
  primary: string
  secondary: string
  isCurrentUser: boolean
}) {
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-3 rounded ${
        isCurrentUser
          ? 'bg-space-gold/20 border border-space-gold/40'
          : 'bg-space-black/40'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center justify-center w-8">
          {rankEmoji ? (
            <span className="text-xl">{rankEmoji}</span>
          ) : (
            <span className="text-cream-white/50 text-sm font-mono">#{rank}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-medium truncate ${isCurrentUser ? 'text-space-gold' : 'text-cream-white'}`}>
            {name}
            {isCurrentUser && <span className="text-xs ml-2 text-space-gold/70">(you)</span>}
          </div>
          <div className="text-cream-white/40 text-xs">{secondary}</div>
        </div>
      </div>
      <div className={`font-bold text-right ${isCurrentUser ? 'text-space-gold' : 'text-cream-white'}`}>
        {primary}
      </div>
    </div>
  )
}

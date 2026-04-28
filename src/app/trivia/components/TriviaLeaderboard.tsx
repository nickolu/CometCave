'use client'

import { useEffect, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'
import { getDailyCategory } from '@/lib/trivia/categories'

import { SignInBanner } from './SignInCTA'

type Period = 'daily' | 'weekly' | 'alltime'

interface LeaderboardEntry {
  uid: string
  displayName: string
  score: number
  correct?: number
  total?: number
  totalScore?: number
  gamesPlayed?: number
  totalCorrect?: number
  totalQuestions?: number
}

interface LeaderboardResponse {
  period: Period
  entries: LeaderboardEntry[]
  notice?: string
}

export function TriviaLeaderboard({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { displayName: triviaDisplayName } = useTriviaUser()
  const [period, setPeriod] = useState<Period>('daily')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const currentUid = user?.uid ?? null
  const authName = user ? triviaDisplayName || user.email || null : null

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

  const handleShareLeaderboard = async () => {
    if (!data?.entries || data.entries.length === 0) return

    const today = getTodayPST()
    const category = getDailyCategory(today)
    const date = new Date(today + 'T12:00:00')
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const medals = ['🥇', '🥈', '🥉']

    const lines = data.entries.slice(0, 5).map((entry, i) => {
      const prefix = i < 3 ? medals[i] : `${i + 1}.`
      return `${prefix} ${entry.displayName || 'Unknown'} — ${(entry.score ?? 0).toLocaleString()} pts`
    })

    const shareText = [
      `🏆 CometCave Daily Trivia — ${dateStr}`,
      `Theme: ${category.icon} ${category.name}`,
      '',
      ...lines,
      '',
      '🔗 Play today\'s trivia: https://cometcave.com/trivia',
    ].join('\n')

    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
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
      return data.entries.map((entry, i) => (
        <LeaderboardRow
          key={entry.uid || `${entry.displayName}-${i}`}
          rank={i + 1}
          name={entry.displayName || 'Unknown'}
          primary={(entry.score ?? 0).toLocaleString()}
          secondary={`${entry.correct ?? 0}/${entry.total ?? 0} correct`}
          isCurrentUser={!!currentUid && entry.uid === currentUid}
        />
      ))
    }

    if (period === 'weekly') {
      return data.entries.map((entry, i) => {
        const totalQ = entry.totalQuestions ?? 0
        const accuracy =
          totalQ > 0 ? Math.round(((entry.totalCorrect ?? 0) / totalQ) * 100) : 0
        return (
          <LeaderboardRow
            key={entry.uid || `${entry.displayName}-${i}`}
            rank={i + 1}
            name={entry.displayName || 'Unknown'}
            primary={(entry.totalScore ?? 0).toLocaleString()}
            secondary={`${entry.gamesPlayed ?? 0} games · ${accuracy}%`}
            isCurrentUser={!!currentUid && entry.uid === currentUid}
          />
        )
      })
    }

    if (period === 'alltime') {
      return data.entries.map((entry, i) => (
        <LeaderboardRow
          key={entry.uid || `${entry.displayName}-${i}`}
          rank={i + 1}
          name={entry.displayName || 'Unknown'}
          primary={(entry.totalScore ?? 0).toLocaleString()}
          secondary={`${entry.gamesPlayed ?? 0} ${(entry.gamesPlayed ?? 0) === 1 ? 'game' : 'games'}`}
          isCurrentUser={!!currentUid && entry.uid === currentUid}
        />
      ))
    }

    return null
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto py-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-space-gold mb-1">Leaderboard</h2>
        {authName ? (
          <p className="text-cream-white/50 text-sm">
            Playing as <span className="text-space-gold">{authName}</span>
          </p>
        ) : null}
      </div>

      {!authName && (
        <SignInBanner message="Log in to see your rank and compete" cta="Sign in" />
      )}

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

      {/* Share leaderboard button — daily tab only */}
      {period === 'daily' && (data?.entries?.length ?? 0) > 0 && (
        <Button
          variant="outline"
          onClick={handleShareLeaderboard}
          className="w-full"
        >
          {copied ? '✅ Copied!' : '📋 Share Leaderboard'}
        </Button>
      )}

      <Button variant="outline" onClick={onBack} className="w-full">
        Back to Trivia
      </Button>
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

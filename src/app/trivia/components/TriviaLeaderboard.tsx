'use client'

import { useEffect, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'
import { getDailyCategory } from '@/lib/trivia/categories'

import { ResetNoticeButton } from './ResetNoticeButton'
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
        <div className="text-center text-on-surface/50 py-8 px-4">
          {data.notice ?? 'No scores yet. Be the first!'}
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
        <h2 className="text-3xl font-bold text-ds-tertiary mb-1 inline-flex items-center gap-2">
          Leaderboard
          <ResetNoticeButton />
        </h2>
        {authName ? (
          <p className="text-on-surface/50 text-sm">
            Playing as <span className="text-ds-tertiary">{authName}</span>
          </p>
        ) : null}
      </div>

      {!authName && (
        <SignInBanner message="Log in to see your rank and compete" cta="Sign in" />
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {(['daily', 'weekly', 'alltime'] as Period[]).map((p) => (
          <ChunkyButton
            key={p}
            variant={period === p ? 'primary' : 'secondary'}
            onClick={() => setPeriod(p)}
            className="capitalize"
          >
            {p === 'alltime' ? 'All-Time' : p}
          </ChunkyButton>
        ))}
      </div>

      {/* Content */}
      <ChunkyCard variant="surface-container-high" className="bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-4 pb-4">
          {loading ? (
            <div className="text-center text-on-surface/50 py-8">Loading...</div>
          ) : error ? (
            <div className="text-center text-ds-error py-8">{error}</div>
          ) : (
            <div className="flex flex-col gap-1.5">{renderEntries()}</div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Share leaderboard button — daily tab only */}
      {period === 'daily' && (data?.entries?.length ?? 0) > 0 && (
        <ChunkyButton
          variant="secondary"
          onClick={handleShareLeaderboard}
          className="w-full"
        >
          {copied ? '✅ Copied!' : '📋 Share Leaderboard'}
        </ChunkyButton>
      )}

      <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
        Back to Trivia
      </ChunkyButton>
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
          ? 'bg-ds-tertiary/20 border border-ds-tertiary/40'
          : 'bg-surface-dim/40'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center justify-center w-8">
          {rankEmoji ? (
            <Pill tone="success">{rankEmoji}</Pill>
          ) : (
            <Pill tone="neutral">#{rank}</Pill>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-medium truncate ${isCurrentUser ? 'text-ds-tertiary' : 'text-on-surface'}`}>
            {name}
            {isCurrentUser && <span className="text-xs ml-2 text-ds-tertiary/70">(you)</span>}
          </div>
          <div className="text-on-surface/40 text-xs">{secondary}</div>
        </div>
      </div>
      <div className={`font-bold text-right ${isCurrentUser ? 'text-ds-tertiary' : 'text-on-surface'}`}>
        {primary}
      </div>
    </div>
  )
}

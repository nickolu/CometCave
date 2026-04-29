'use client'

import { useEffect, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'

import { SignInBanner } from './SignInCTA'

type Sort = 'score' | 'streak'

interface InfiniteLeaderboardEntry {
  uid: string
  displayName: string
  score: number
  longestStreak: number
  questionsAnswered: number
}

interface InfiniteLeaderboardResponse {
  sort: Sort
  entries: InfiniteLeaderboardEntry[]
  notice?: string
}

export function InfiniteLeaderboard({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { displayName: triviaDisplayName } = useTriviaUser()
  const [sort, setSort] = useState<Sort>('score')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<InfiniteLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentUid = user?.uid ?? null
  const authName = user ? triviaDisplayName || user.email || null : null

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/trivia/infinite/leaderboard?sort=${sort}`)
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
  }, [sort])

  const renderEntries = () => {
    if (!data || !data.entries) return null

    if (data.entries.length === 0) {
      return (
        <div className="text-center text-on-surface/50 py-8 px-4">
          {data.notice ?? 'No runs yet. Be the first!'}
        </div>
      )
    }

    return data.entries.map((entry, i) => {
      const primary = sort === 'score'
        ? `${entry.score.toLocaleString()} pts`
        : `${entry.longestStreak} streak`
      const secondary = sort === 'score'
        ? `${entry.longestStreak} streak · ${entry.questionsAnswered} Qs`
        : `${entry.score.toLocaleString()} pts · ${entry.questionsAnswered} Qs`

      return (
        <LeaderboardRow
          key={`${entry.uid}-${i}`}
          rank={i + 1}
          name={entry.displayName || 'Unknown'}
          primary={primary}
          secondary={secondary}
          isCurrentUser={!!currentUid && entry.uid === currentUid}
        />
      )
    })
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto py-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-ds-tertiary mb-1">
          Infinite Leaderboard
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

      {/* Sort tabs */}
      <div className="grid grid-cols-2 gap-2">
        {(['score', 'streak'] as Sort[]).map((s) => (
          <ChunkyButton
            key={s}
            variant={sort === s ? 'primary' : 'secondary'}
            onClick={() => setSort(s)}
          >
            {s === 'score' ? 'Top Score' : 'Top Streak'}
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

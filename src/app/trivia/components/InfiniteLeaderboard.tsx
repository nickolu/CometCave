'use client'

import { useEffect, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'
import { CATEGORY_META } from '@/lib/trivia/categories'
import type { MedalTier } from '@/lib/trivia/medals'

import { SignInBanner } from './SignInCTA'

type Sort = 'score' | 'streak' | 'category'

interface OverallEntry {
  uid: string
  displayName: string
  score: number
  longestStreak: number
  questionsAnswered: number
}

interface CategoryEntry {
  uid: string
  displayName: string
  correctCount: number
  tier: MedalTier
  label: string | null
}

interface OverallResponse {
  sort: 'score' | 'streak'
  entries: OverallEntry[]
  notice?: string
}

interface CategoryResponse {
  sort: 'category'
  categoryId: number
  entries: CategoryEntry[]
  notice?: string
}

type LeaderboardResponse = OverallResponse | CategoryResponse

const TIER_EMOJI: Record<MedalTier, string> = {
  none: '',
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '🏅',
  diamond: '💎',
}

const FIRST_CATEGORY_ID = Number(Object.keys(CATEGORY_META)[0])

export function InfiniteLeaderboard({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { displayName: triviaDisplayName } = useTriviaUser()
  const [sort, setSort] = useState<Sort>('score')
  const [categoryId, setCategoryId] = useState<number>(FIRST_CATEGORY_ID)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentUid = user?.uid ?? null
  const authName = user ? triviaDisplayName || user.email || null : null

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const url = sort === 'category'
          ? `/api/v1/trivia/infinite/leaderboard?sort=category&categoryId=${categoryId}`
          : `/api/v1/trivia/infinite/leaderboard?sort=${sort}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load leaderboard')
        const json = (await res.json()) as LeaderboardResponse
        setData(json)
      } catch {
        setError('Failed to load leaderboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sort, categoryId])

  const renderEntries = () => {
    if (!data) return null

    if (data.entries.length === 0) {
      return (
        <div className="text-center text-on-surface/50 py-8 px-4">
          {data.notice ?? 'No runs yet. Be the first!'}
        </div>
      )
    }

    if (data.sort === 'category') {
      return data.entries.map((entry, i) => {
        const tierEmoji = entry.tier !== 'none' ? TIER_EMOJI[entry.tier] : ''
        const primary = `${entry.correctCount.toLocaleString()} correct`
        const secondary = entry.label ? `${tierEmoji} ${entry.label}`.trim() : 'No medal yet'
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

    return data.entries.map((entry, i) => {
      const primary = data.sort === 'score'
        ? `${entry.score.toLocaleString()} pts`
        : `${entry.longestStreak} streak`
      const secondary = data.sort === 'score'
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
      <div className="grid grid-cols-3 gap-2">
        {(['score', 'streak', 'category'] as Sort[]).map((s) => (
          <ChunkyButton
            key={s}
            variant={sort === s ? 'primary' : 'secondary'}
            onClick={() => setSort(s)}
          >
            {s === 'score' ? 'Top Score' : s === 'streak' ? 'Top Streak' : 'By Category'}
          </ChunkyButton>
        ))}
      </div>

      {/* Category picker — only visible when "By Category" is selected */}
      {sort === 'category' && (
        <select
          aria-label="Pick a category"
          className="bg-surface-container-high text-on-surface border border-outline-variant rounded-ds-md py-2 px-3 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
        >
          {Object.entries(CATEGORY_META).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.icon} {meta.name}
            </option>
          ))}
        </select>
      )}

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

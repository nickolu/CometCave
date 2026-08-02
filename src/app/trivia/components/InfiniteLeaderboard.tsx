'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'
import { CATEGORY_META, getCategoryIdByName } from '@/lib/trivia/categories'
import type { MedalTier } from '@/lib/trivia/medals'

import { SignInBanner } from './SignInCTA'
import { TriviaFooter } from './TriviaFooter'

type Sort = 'score' | 'streak' | 'allCategories' | 'custom'

interface OverallEntry {
  uid: string
  displayName: string
  score: number
  longestStreak: number
  questionsAnswered: number
  categoryFilters: number[]
  customCategory: string | null
}

interface CategoryEntry {
  uid: string
  displayName: string
  correctCount: number
  tier: MedalTier
  label: string | null
}

interface CategorySection {
  categoryId: number
  categoryName: string
  icon: string
  entries: CategoryEntry[]
}

interface OverallResponse {
  sort: 'score' | 'streak'
  entries: OverallEntry[]
  notice?: string
}

interface AllCategoriesResponse {
  sort: 'allCategories'
  sections: CategorySection[]
  notice?: string
}

interface CustomResponse {
  sort: 'custom'
  customSort: 'score' | 'streak'
  entries: OverallEntry[]
  notice?: string
}

type LeaderboardResponse = OverallResponse | AllCategoriesResponse | CustomResponse

const TIER_EMOJI: Record<MedalTier, string> = {
  none: '',
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '🏅',
  diamond: '💎',
}

function formatCategory(categoryFilters: number[], customCategory: string | null): string {
  if (customCategory) return customCategory
  if (categoryFilters.length === 0) return 'All Categories'
  if (categoryFilters.length === 1) return CATEGORY_META[categoryFilters[0]]?.name ?? 'Unknown'
  return 'Mixed'
}

export function InfiniteLeaderboard({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { displayName: triviaDisplayName } = useTriviaUser()
  const [sort, setSort] = useState<Sort>('score')
  const [customSort, setCustomSort] = useState<'score' | 'streak'>('score')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentUid = user?.uid ?? null
  const authName = user ? triviaDisplayName || user.email || null : null

  // Fetch user's per-category accuracy for the "By Category" view
  const [userCategoryStats, setUserCategoryStats] = useState<
    Record<string, { answered: number; correct: number }> | null
  >(null)

  const fetchUserStats = useCallback(async (signal?: AbortSignal) => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/v1/trivia/stats/me', {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })
      if (res.ok) {
        const stats = await res.json()
        setUserCategoryStats(stats.byCategory ?? null)
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      // silent — accuracy is a nice-to-have
    }
  }, [user])

  useEffect(() => {
    if (sort === 'allCategories' && user && !userCategoryStats) {
      const controller = new AbortController()
      fetchUserStats(controller.signal)
      return () => controller.abort()
    }
  }, [sort, user, userCategoryStats, fetchUserStats])

  // Map category strings (e.g. "Entertainment: Books") → category IDs → accuracy
  const accuracyByCategoryId = useMemo(() => {
    if (!userCategoryStats) return new Map<number, number>()
    const map = new Map<number, { answered: number; correct: number }>()
    for (const [cat, stats] of Object.entries(userCategoryStats)) {
      const id = getCategoryIdByName(cat)
      if (id === null || stats.answered === 0) continue
      const existing = map.get(id)
      if (existing) {
        existing.answered += stats.answered
        existing.correct += stats.correct
      } else {
        map.set(id, { answered: stats.answered, correct: stats.correct })
      }
    }
    const result = new Map<number, number>()
    for (const [id, s] of map) {
      result.set(id, Math.round((s.correct / s.answered) * 100))
    }
    return result
  }, [userCategoryStats])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const url = sort === 'custom'
          ? `/api/v1/trivia/infinite/leaderboard?sort=${sort}&customSort=${customSort}`
          : `/api/v1/trivia/infinite/leaderboard?sort=${sort}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error('Failed to load leaderboard')
        const json = (await res.json()) as LeaderboardResponse
        setData(json)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setError('Failed to load leaderboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [sort, customSort])

  const renderContent = () => {
    if (!data) return null

    if (data.sort === 'allCategories') {
      if (data.sections.length === 0) {
        return (
          <div className="text-center text-on-surface/50 py-8 px-4">
            {data.notice ?? 'No medals earned yet. Be the first!'}
          </div>
        )
      }
      return (
        <div className="flex flex-col gap-4">
          {data.sections.map((section) => (
            <div key={section.categoryId} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{section.icon}</span>
                  <span className="text-on-surface text-sm font-semibold">{section.categoryName}</span>
                </div>
                {accuracyByCategoryId.has(section.categoryId) && (
                  <span className="text-on-surface/40 text-xs">
                    You: {accuracyByCategoryId.get(section.categoryId)}% correct
                  </span>
                )}
              </div>
              {section.entries.map((entry, i) => {
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
              })}
            </div>
          ))}
        </div>
      )
    }

    if (data.sort === 'custom') {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {(['score', 'streak'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setCustomSort(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  customSort === s
                    ? 'bg-ds-tertiary text-on-tertiary border-ds-tertiary'
                    : 'bg-transparent text-on-surface/60 border-outline-variant hover:border-outline'
                }`}
              >
                {s === 'score' ? 'Score' : 'Streak'}
              </button>
            ))}
          </div>
          {data.entries.length === 0 ? (
            <div className="text-center text-on-surface/50 py-8 px-4">
              {data.notice ?? 'No custom runs yet. Be the first!'}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {data.entries.map((entry, i) => {
                const primary = customSort === 'score'
                  ? `${entry.score.toLocaleString()} pts`
                  : `${entry.longestStreak} streak`
                const secondary = entry.customCategory
                  ? customSort === 'score'
                    ? `${entry.longestStreak} streak · ${entry.questionsAnswered} Qs · ${entry.customCategory}`
                    : `${entry.score.toLocaleString()} pts · ${entry.questionsAnswered} Qs · ${entry.customCategory}`
                  : customSort === 'score'
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
              })}
            </div>
          )}
        </div>
      )
    }

    if (data.entries.length === 0) {
      return (
        <div className="text-center text-on-surface/50 py-8 px-4">
          {data.notice ?? 'No runs yet. Be the first!'}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-1.5">
        {data.entries.map((entry, i) => {
          const primary = data.sort === 'score'
            ? `${entry.score.toLocaleString()} pts`
            : `${entry.longestStreak} streak`
          const category = formatCategory(entry.categoryFilters, entry.customCategory)
          const secondary = data.sort === 'score'
            ? `${entry.longestStreak} streak · ${entry.questionsAnswered} Qs · ${category}`
            : `${entry.score.toLocaleString()} pts · ${entry.questionsAnswered} Qs · ${category}`

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
        })}
      </div>
    )
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
      <div className="grid grid-cols-4 gap-2">
        {(['score', 'streak', 'allCategories', 'custom'] as Sort[]).map((s) => (
          <ChunkyButton
            key={s}
            variant={sort === s ? 'primary' : 'secondary'}
            onClick={() => setSort(s)}
          >
            {s === 'score' ? 'Top Score' : s === 'streak' ? 'Top Streak' : s === 'allCategories' ? 'By Category' : 'Custom'}
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
            renderContent()
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      <ChunkyButton variant="secondary" onClick={onBack} className="w-full">
        Back to Trivia
      </ChunkyButton>

      <TriviaFooter current="infinite-leaderboard" />
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

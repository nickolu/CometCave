'use client'

import { useEffect, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader, ChunkyCardTitle } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import type { QuestionStats } from '@/lib/trivia/questionStats'
import type { QuestionBrowseRow, SortOption } from '@/lib/trivia/questionQueries'

import { SpoilerCard } from './SpoilerCard'

interface QuestionLibraryProps {
  onBack: () => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_shown', label: 'Most Shown' },
  { value: 'liked', label: 'Most Liked' },
  { value: 'disliked', label: 'Most Disliked' },
  { value: 'accuracy_asc', label: 'Hardest' },
  { value: 'accuracy_desc', label: 'Easiest' },
]

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  hard: 'bg-red-500/20 text-red-300 border-red-500/30',
}

interface BrowseResponse {
  questions: QuestionBrowseRow[]
  nextCursor: string | null
}

export function QuestionLibrary({ onBack }: QuestionLibraryProps) {
  const { user } = useAuth()

  // Stats state
  const [stats, setStats] = useState<QuestionStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Browser state
  const [questions, setQuestions] = useState<QuestionBrowseRow[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Filter/sort state
  const [sort, setSort] = useState<SortOption>('newest')
  const [category, setCategory] = useState<string>('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')

  // Load stats (no auth needed)
  useEffect(() => {
    async function loadStats() {
      setStatsLoading(true)
      setStatsError(null)
      try {
        const res = await fetch('/api/v1/trivia/questions/stats')
        if (!res.ok) throw new Error('Failed to load stats')
        const json = await res.json()
        setStats(json)
      } catch {
        setStatsError('Failed to load stats.')
      } finally {
        setStatsLoading(false)
      }
    }
    void loadStats()
  }, [])

  // Load questions (requires auth token)
  async function loadQuestions(replace: boolean) {
    setBrowseLoading(true)
    setBrowseError(null)
    try {
      let token: string | null = null
      if (user) {
        token = await user.getIdToken()
      }

      const params = new URLSearchParams()
      params.set('sort', sort)
      params.set('limit', '20')
      if (category) params.set('category', category)
      if (difficulty) params.set('difficulty', difficulty)
      if (!replace && nextCursor) params.set('cursor', nextCursor)

      const res = await fetch(`/api/v1/trivia/questions?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to load questions')
      const json: BrowseResponse = await res.json()

      setQuestions((prev) => (replace ? json.questions : [...prev, ...json.questions]))
      setNextCursor(json.nextCursor)
      setHasLoaded(true)
    } catch {
      setBrowseError('Failed to load questions.')
    } finally {
      setBrowseLoading(false)
    }
  }

  // Reload when filters/sort change
  useEffect(() => {
    void loadQuestions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category, difficulty])

  const categoryOptions = stats?.byCategory.map((c) => c.category) ?? []

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ChunkyButton variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </ChunkyButton>
        <h1 className="font-headline text-headline-md text-ds-tertiary">Question Library</h1>
      </div>

      {/* Stats Dashboard */}
      <ChunkyCard variant="surface-container-high" cornerGlow="tertiary">
        <ChunkyCardHeader>
          <ChunkyCardTitle className="text-on-surface">Stats Dashboard</ChunkyCardTitle>
        </ChunkyCardHeader>
        <ChunkyCardContent>
          {statsLoading && (
            <p className="text-on-surface/50 text-sm">Loading stats…</p>
          )}
          {statsError && (
            <p className="text-ds-error text-sm">{statsError}</p>
          )}
          {stats && (
            <div className="flex flex-col gap-4">
              {/* Top-level stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCell label="Total Questions" value={stats.totalQuestions.toLocaleString()} />
                <StatCell label="Total Answered" value={stats.totalAnswered.toLocaleString()} />
                <StatCell label="Avg Accuracy" value={`${stats.avgAccuracyPct}%`} />
                <StatCell label="Added This Week" value={stats.questionsAddedThisWeek.toLocaleString()} />
              </div>

              {/* Difficulty breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTY_OPTIONS.map((diff) => {
                  const d = stats.byDifficulty[diff]
                  return (
                    <div
                      key={diff}
                      className={`rounded-lg px-3 py-2 border text-center ${DIFFICULTY_COLORS[diff]}`}
                    >
                      <div className="text-xs uppercase tracking-widest mb-1 opacity-70">
                        {diff}
                      </div>
                      <div className="font-bold text-lg">{d.count}</div>
                      <div className="text-xs opacity-60">{d.avgAccuracy}% acc</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Question Browser */}
      <ChunkyCard variant="surface-container-high">
        <ChunkyCardHeader>
          <ChunkyCardTitle className="text-on-surface">Browse Questions</ChunkyCardTitle>
        </ChunkyCardHeader>
        <ChunkyCardContent>
          <div className="flex flex-col gap-4">
            {/* Sort + Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Sort dropdown */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-on-surface/50 uppercase tracking-widest whitespace-nowrap">
                  Sort
                </label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="rounded-md bg-surface-variant/30 border border-outline-variant/40 text-on-surface text-sm px-2 py-1 focus:outline-none focus:border-ds-tertiary/60"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              {categoryOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-on-surface/50 uppercase tracking-widest whitespace-nowrap">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-md bg-surface-variant/30 border border-outline-variant/40 text-on-surface text-sm px-2 py-1 focus:outline-none focus:border-ds-tertiary/60"
                  >
                    <option value="">All</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Difficulty chips */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDifficulty('')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    difficulty === ''
                      ? 'bg-ds-tertiary/20 text-ds-tertiary border-ds-tertiary/40'
                      : 'bg-transparent text-on-surface/50 border-outline-variant/30 hover:border-outline-variant/60'
                  }`}
                >
                  All
                </button>
                {DIFFICULTY_OPTIONS.map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff === difficulty ? '' : diff)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                      difficulty === diff
                        ? DIFFICULTY_COLORS[diff]
                        : 'bg-transparent text-on-surface/50 border-outline-variant/30 hover:border-outline-variant/60'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions list */}
            {browseLoading && !hasLoaded && (
              <p className="text-on-surface/50 text-sm">Loading questions…</p>
            )}
            {browseError && (
              <p className="text-ds-error text-sm">{browseError}</p>
            )}

            {!user && hasLoaded && (
              <p className="text-on-surface/50 text-sm italic">
                Sign in to see personalized spoiler protection.
              </p>
            )}

            {hasLoaded && questions.length === 0 && !browseLoading && (
              <p className="text-on-surface/50 text-sm">No questions found with these filters.</p>
            )}

            <div className="flex flex-col gap-3">
              {questions.map((q) => (
                <SpoilerCard
                  key={q.id}
                  questionId={q.id}
                  questionText={q.question}
                  userHasSeen={q.userHasSeen}
                >
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Category badge */}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-variant/40 text-on-surface/60 border border-outline-variant/30">
                      {q.category}
                    </span>
                    {/* Difficulty badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border capitalize ${DIFFICULTY_COLORS[q.difficulty]}`}
                    >
                      {q.difficulty}
                    </span>
                    {/* Stats */}
                    <div className="ml-auto flex gap-3 text-xs text-on-surface/50">
                      <span title="Times shown">👁 {q.timesShown}</span>
                      <span title="Accuracy">{q.accuracyPct}%</span>
                      <span title="Likes">👍 {q.likeCount}</span>
                      <span title="Dislikes">👎 {q.dislikeCount}</span>
                    </div>
                  </div>
                </SpoilerCard>
              ))}
            </div>

            {/* Load More */}
            {nextCursor && !browseLoading && (
              <ChunkyButton
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => void loadQuestions(false)}
              >
                Load More
              </ChunkyButton>
            )}
            {browseLoading && hasLoaded && (
              <p className="text-on-surface/50 text-sm text-center">Loading…</p>
            )}
          </div>
        </ChunkyCardContent>
      </ChunkyCard>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-variant/20 px-3 py-3 text-center border border-outline-variant/20">
      <div className="text-xl font-bold text-ds-tertiary">{value}</div>
      <div className="text-xs text-on-surface/50 mt-0.5">{label}</div>
    </div>
  )
}

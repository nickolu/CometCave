'use client'

import { type SelectHTMLAttributes, useEffect, useMemo, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader, ChunkyCardTitle } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import { CATEGORY_META, getCategoryIdByName } from '@/lib/trivia/categories'
import type { QuestionBrowseRow, SortOption } from '@/lib/trivia/questionQueries'
import type { QuestionStats } from '@/lib/trivia/questionStats'

import { SignInCard } from './SignInCTA'
import { SpoilerCard } from './SpoilerCard'
import { TriviaFooter } from './TriviaFooter'

type LibraryTab = 'all' | 'mine'

// Tile grid is the entry; selecting a tile drills into the existing
// browse experience filtered to that category. Custom is a single
// bucket for free-form topics that don't map to CATEGORY_META.
type SelectedView =
  | { kind: 'tiles' }
  | { kind: 'known'; id: number }
  | { kind: 'custom' }

interface QuestionLibraryProps {
  onBack: () => void
}

const CUSTOM_ICON = '✨'

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
  const isNamedUser = !!user && !user.isAnonymous

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
  const [tab, setTab] = useState<LibraryTab>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')

  // Tile grid drives the active filter. selectedCustomLabel is only
  // meaningful when view.kind === 'custom'.
  const [view, setView] = useState<SelectedView>({ kind: 'tiles' })
  const [selectedCustomLabel, setSelectedCustomLabel] = useState<string>('')

  // Anonymous and unauthed users can't view "mine" — the API would 403,
  // and per product spec we sell sign-up here instead of fetching.
  const mineLocked = tab === 'mine' && !isNamedUser

  // Group stats by canonical category id. Multiple stored category
  // strings can map to the same id (e.g. "Books" and "Entertainment:
  // Books"); we keep them all so the API filter can hit either. Anything
  // that doesn't resolve to a CATEGORY_META id is treated as a custom
  // free-form topic.
  const grouped = useMemo(() => {
    const known = new Map<
      number,
      { count: number; storedNames: string[]; primaryName: string }
    >()
    const customLabels: { label: string; count: number }[] = []
    let customTotal = 0
    for (const entry of stats?.byCategory ?? []) {
      const id = getCategoryIdByName(entry.category)
      if (id !== null) {
        const existing = known.get(id)
        if (existing) {
          existing.count += entry.count
          existing.storedNames.push(entry.category)
        } else {
          // stats.byCategory is sorted by count desc, so the first stored
          // name we see for an id is the most populous variant.
          known.set(id, {
            count: entry.count,
            storedNames: [entry.category],
            primaryName: entry.category,
          })
        }
      } else {
        customLabels.push({ label: entry.category, count: entry.count })
        customTotal += entry.count
      }
    }
    return { known, customLabels, customTotal }
  }, [stats])

  // Default the custom-view dropdown to the most populous custom label
  // when the user enters that view. Cleared when they leave.
  useEffect(() => {
    if (view.kind !== 'custom') return
    if (selectedCustomLabel) return
    const first = grouped.customLabels[0]?.label
    if (first) setSelectedCustomLabel(first)
  }, [view, grouped.customLabels, selectedCustomLabel])

  // The category string passed to the API is the actual stored name on
  // the question doc — known categories use the most populous stored
  // variant; custom categories use the user's selected label verbatim.
  const activeCategory: string = (() => {
    if (view.kind === 'known') {
      return grouped.known.get(view.id)?.primaryName ?? ''
    }
    if (view.kind === 'custom') {
      return selectedCustomLabel
    }
    return ''
  })()

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
      if (activeCategory) params.set('category', activeCategory)
      if (difficulty) params.set('difficulty', difficulty)
      if (tab === 'mine') params.set('mine', '1')
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

  // Reload when filters/sort/tab change. Skip the fetch when the tab is
  // locked behind sign-in — we render a CTA instead. The tile-grid view
  // doesn't need a list fetch either; the grid is built from stats.
  useEffect(() => {
    if (view.kind === 'tiles') {
      setQuestions([])
      setNextCursor(null)
      setHasLoaded(false)
      return
    }
    if (mineLocked) {
      setQuestions([])
      setNextCursor(null)
      setHasLoaded(false)
      return
    }
    // Custom view with no resolved label hasn't picked a topic yet;
    // wait for the default-selection effect to populate it.
    if (view.kind === 'custom' && !activeCategory) return
    void loadQuestions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sort, activeCategory, difficulty, mineLocked, view.kind])

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

      {/* Question Browser — tile grid first, drills into a filtered
          list once the player picks a category. */}
      <ChunkyCard variant="surface-container-high">
        <ChunkyCardHeader>
          <ChunkyCardTitle className="text-on-surface">Browse Questions</ChunkyCardTitle>
        </ChunkyCardHeader>
        <ChunkyCardContent>
          {view.kind === 'tiles' ? (
            <div className="flex flex-col gap-3">
              <p className="text-on-surface/70 text-sm">
                {statsLoading
                  ? 'Tallying the cave…'
                  : 'Pick a category to browse its questions.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {statsLoading ? (
                  // Skeleton tiles render the icon/name layout with a
                  // shimmering count line so the grid doesn't appear
                  // populated with "0" placeholders during load.
                  Object.entries(CATEGORY_META).map(([idStr, meta]) => (
                    <div
                      key={idStr}
                      aria-hidden="true"
                      className="flex flex-col items-center justify-between gap-2 p-3 rounded-ds-md text-xs font-medium min-h-[110px] bg-surface-container/60"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span aria-hidden="true" className="text-2xl opacity-50">{meta.icon}</span>
                        <span className="text-center leading-tight text-on-surface/40">{meta.name}</span>
                      </div>
                      <span className="block h-3 w-16 rounded bg-surface-variant/40 animate-pulse" />
                    </div>
                  ))
                ) : (
                  <>
                    {Object.entries(CATEGORY_META).map(([idStr, meta]) => {
                      const id = Number(idStr)
                      const count = grouped.known.get(id)?.count ?? 0
                      const disabled = count === 0
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setView({ kind: 'known', id })}
                          className={`flex flex-col items-center justify-between gap-2 p-3 rounded-ds-md text-xs font-medium transition-colors min-h-[110px] ${
                            disabled
                              ? 'bg-surface-container/40 text-on-surface/30 cursor-not-allowed'
                              : 'bg-surface-container text-on-surface/80 hover:bg-surface-container-highest'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span aria-hidden="true" className="text-2xl">{meta.icon}</span>
                            <span className="text-center leading-tight">{meta.name}</span>
                          </div>
                          <span className="text-[11px] text-on-surface/60">
                            {count.toLocaleString()} {count === 1 ? 'question' : 'questions'}
                          </span>
                        </button>
                      )
                    })}
                    {/* Custom tile aggregates every free-form topic. The
                        inner view lets the player pick which one. */}
                    <button
                      type="button"
                      disabled={grouped.customTotal === 0}
                      onClick={() => setView({ kind: 'custom' })}
                      className={`flex flex-col items-center justify-between gap-2 p-3 rounded-ds-md text-xs font-medium transition-colors min-h-[110px] ${
                        grouped.customTotal === 0
                          ? 'bg-surface-container/40 text-on-surface/30 cursor-not-allowed'
                          : 'bg-surface-container text-on-surface/80 hover:bg-surface-container-highest'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span aria-hidden="true" className="text-2xl">{CUSTOM_ICON}</span>
                        <span className="text-center leading-tight">Custom Topics</span>
                      </div>
                      <span className="text-[11px] text-on-surface/60">
                        {grouped.customTotal.toLocaleString()}{' '}
                        {grouped.customTotal === 1 ? 'question' : 'questions'}
                      </span>
                    </button>
                  </>
                )}
              </div>
              {statsError && (
                <p className="text-ds-error text-sm">{statsError}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Sub-header: back to tiles + the chosen category. */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setView({ kind: 'tiles' })}
                  className="text-xs text-on-surface/70 hover:text-on-surface flex items-center gap-1"
                >
                  ← All categories
                </button>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">
                    {view.kind === 'known' ? CATEGORY_META[view.id]?.icon : CUSTOM_ICON}
                  </span>
                  <span className="text-on-surface font-medium text-sm">
                    {view.kind === 'known'
                      ? CATEGORY_META[view.id]?.name
                      : 'Custom Topics'}
                  </span>
                </div>
              </div>

              {/* Custom view: dropdown to pick which custom label. */}
              {view.kind === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-on-surface/50 uppercase tracking-widest whitespace-nowrap">
                    Topic
                  </label>
                  <DarkSelect
                    value={selectedCustomLabel}
                    onChange={(e) => setSelectedCustomLabel(e.target.value)}
                    className="max-w-full"
                  >
                    {grouped.customLabels.map(({ label, count }) => (
                      <option key={label} value={label}>
                        {label} ({count})
                      </option>
                    ))}
                  </DarkSelect>
                </div>
              )}

              {/* Tab toggle: All vs Mine */}
              <div className="flex gap-1 p-1 rounded-md bg-surface-variant/20 border border-outline-variant/20 self-start">
                {(
                  [
                    { value: 'all' as const, label: 'All questions' },
                    { value: 'mine' as const, label: 'Generated by me' },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTab(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${
                      tab === opt.value
                        ? 'bg-ds-tertiary/25 text-ds-tertiary'
                        : 'text-on-surface/60 hover:text-on-surface'
                    }`}
                    aria-pressed={tab === opt.value}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sort + Difficulty */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-on-surface/50 uppercase tracking-widest whitespace-nowrap">
                    Sort
                  </label>
                  <DarkSelect
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </DarkSelect>
                </div>

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

              {/* Mine tab: gate behind a real account */}
              {mineLocked ? (
                <SignInCard
                  title="✨ See questions you generated"
                  description={
                    user?.isAnonymous
                      ? 'Create an account to track every question your play has added to the cave.'
                      : 'Sign in to see questions your play has added to the cave.'
                  }
                />
              ) : (
                <>
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
                    <p className="text-on-surface/50 text-sm">
                      {tab === 'mine'
                        ? "You haven't generated any questions yet. Play infinite mode — each question the cave generates for you shows up here."
                        : 'No questions found with these filters.'}
                    </p>
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
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-variant/40 text-on-surface/60 border border-outline-variant/30">
                            {q.category}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border capitalize ${DIFFICULTY_COLORS[q.difficulty]}`}
                          >
                            {q.difficulty}
                          </span>
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
                </>
              )}
            </div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      <TriviaFooter current="library" />
    </div>
  )
}

// Native <select> defers to the browser's light theme on macOS, which
// makes our white-on-dark UI flash a white pill. appearance-none strips
// the native control, [color-scheme:dark] tells Chrome/Firefox to render
// the dropdown popover in dark mode, and a manual chevron stands in for
// the native arrow.
function DarkSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <span className="relative inline-flex">
      <select
        {...rest}
        className={`appearance-none [color-scheme:dark] rounded-md bg-surface-container-highest border border-outline-variant/40 text-on-surface text-sm pl-2 pr-7 py-1 focus:outline-none focus:border-ds-tertiary/60 ${className}`}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface/50 text-[10px]"
      >
        ▾
      </span>
    </span>
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

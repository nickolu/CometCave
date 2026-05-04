'use client'

import { useCallback, useEffect, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import type { QuestionBrowseRow } from '@/lib/trivia/questionQueries'

import { SpoilerCard } from './SpoilerCard'

type SortTab = 'liked' | 'disliked' | 'trending'

interface QuestionExplorerProps {
  onBack: () => void
}

const TAB_LABELS: { key: SortTab; label: string }[] = [
  { key: 'liked', label: 'Most Liked' },
  { key: 'disliked', label: 'Most Disliked' },
  { key: 'trending', label: 'Trending' },
]

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  hard: 'bg-red-500/20 text-red-700 dark:text-red-400',
}

export function QuestionExplorer({ onBack }: QuestionExplorerProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<SortTab>('liked')
  const [questions, setQuestions] = useState<QuestionBrowseRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuestions = useCallback(
    async (sort: SortTab, cursor?: string) => {
      const isLoadMore = !!cursor
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }

      try {
        const headers: Record<string, string> = {}
        if (user) {
          const token = await user.getIdToken()
          headers['Authorization'] = `Bearer ${token}`
        }

        const params = new URLSearchParams({ sort, limit: '20' })
        if (cursor) params.set('cursor', cursor)

        const res = await fetch(`/api/v1/trivia/questions?${params.toString()}`, { headers })
        if (!res.ok) {
          throw new Error(`Failed to fetch questions: ${res.status}`)
        }

        const data = (await res.json()) as {
          questions: QuestionBrowseRow[]
          nextCursor: string | null
          hasMore: boolean
        }

        if (isLoadMore) {
          setQuestions((prev) => [...prev, ...data.questions])
        } else {
          setQuestions(data.questions)
        }
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user]
  )

  useEffect(() => {
    setQuestions([])
    setNextCursor(null)
    setHasMore(false)
    fetchQuestions(activeTab)
  }, [activeTab, fetchQuestions])

  const handleTabChange = (tab: SortTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return
    fetchQuestions(activeTab, nextCursor)
  }

  const handleReveal = async (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, userHasSeen: true } : q))
    )
    if (!user) return
    try {
      const token = await user.getIdToken()
      await fetch(`/api/v1/trivia/questions/${questionId}/reveal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('Failed to record reveal:', err)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      {/* Header */}
      <div className="w-full flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors underline-offset-4 hover:underline text-sm"
        >
          ← Back
        </button>
        <h1 className="font-headline text-headline-md text-ds-tertiary flex-1 text-center pr-12">
          Explore Questions
        </h1>
      </div>

      {/* Tab buttons */}
      <div className="w-full flex gap-2">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={[
              'flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-ds-primary text-on-primary'
                : 'bg-surface-container-highest text-on-surface hover:bg-surface-variant',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="w-full flex justify-center py-12">
          <span className="text-on-surface/50 text-sm">Loading questions…</span>
        </div>
      ) : error ? (
        <div className="w-full flex flex-col items-center gap-4 py-12">
          <span className="text-red-500 text-sm">{error}</span>
          <ChunkyButton variant="secondary" size="sm" onClick={() => fetchQuestions(activeTab)}>
            Try again
          </ChunkyButton>
        </div>
      ) : questions.length === 0 ? (
        <div className="w-full flex justify-center py-12">
          <span className="text-on-surface/50 text-sm">No questions found.</span>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4">
          {questions.map((q) => (
            <SpoilerCard
              key={q.id}
              questionId={q.id}
              questionText={q.question}
              userHasSeen={q.userHasSeen}
              onReveal={handleReveal}
            >
              {/* Badges and stats shown inside the card */}
              <div className="flex flex-wrap gap-2 mt-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant font-medium">
                  {q.category}
                </span>
                <span
                  className={[
                    'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                    DIFFICULTY_COLORS[q.difficulty] ?? 'bg-surface-variant text-on-surface-variant',
                  ].join(' ')}
                >
                  {q.difficulty}
                </span>
              </div>
              <ChunkyCard variant="surface-variant">
                <ChunkyCardContent className="pt-4 pb-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-on-surface/70">
                    <span>
                      Likes:{' '}
                      <span className="font-semibold text-on-surface">{q.likeCount}</span>
                    </span>
                    <span>
                      Dislikes:{' '}
                      <span className="font-semibold text-on-surface">{q.dislikeCount}</span>
                    </span>
                    <span>
                      Shown:{' '}
                      <span className="font-semibold text-on-surface">{q.timesShown}</span>
                    </span>
                    <span>
                      Accuracy:{' '}
                      <span className="font-semibold text-on-surface">{q.accuracyPct}%</span>
                    </span>
                  </div>
                </ChunkyCardContent>
              </ChunkyCard>
            </SpoilerCard>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-2">
              <ChunkyButton
                variant="secondary"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </ChunkyButton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

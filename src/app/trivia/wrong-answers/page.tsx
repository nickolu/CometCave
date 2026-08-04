'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import type { GalleryEntry } from '@/lib/trivia/wrongAnswers'

import { TriviaFooter } from '../components/TriviaFooter'

export default function WrongAnswersGalleryPage() {
  const [entries, setEntries] = useState<GalleryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/trivia/wrong-answers', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setEntries(data.entries ?? [])
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="w-full flex items-center justify-between">
        <Link
          href="/trivia"
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors text-sm underline-offset-4 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="font-headline text-headline-lg text-ds-tertiary">Wrong Answers</h1>
        <div className="w-16" />
      </div>

      <p className="text-on-surface/50 text-sm text-center">
        The most popular wrong answers players have submitted — a hall of fame for the confidently incorrect.
      </p>

      {loading && (
        <p className="text-on-surface/50 text-sm">Loading...</p>
      )}

      {!loading && entries.length === 0 && (
        <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-6 pb-6 text-center">
            <p className="text-on-surface/50">
              The cave has no wrong answers yet — play some trivia!
            </p>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {entries.map((entry) => (
        <ChunkyCard key={entry.questionId} variant="surface-container-high" className="w-full">
          <ChunkyCardContent className="pt-4 pb-4 flex flex-col gap-3">
            <p className="text-on-surface text-sm leading-snug">{entry.question}</p>

            <p className="text-xs text-on-surface/50 uppercase tracking-wide font-semibold">
              Correct answer:{' '}
              <span
                className="normal-case font-bold tracking-normal"
                style={{ color: 'var(--cc-mint)' }}
              >
                {entry.correctAnswer}
              </span>
            </p>

            {entry.topAnswers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {entry.topAnswers.map((ans) => (
                  <span
                    key={ans.text}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-ds-error/10 border border-ds-error/20 text-on-surface/80"
                  >
                    {ans.text}
                    {ans.count > 1 && (
                      <span className="text-on-surface/40 font-semibold">×{ans.count}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </ChunkyCardContent>
        </ChunkyCard>
      ))}

      <TriviaFooter current="wrong-answers" />
    </div>
  )
}

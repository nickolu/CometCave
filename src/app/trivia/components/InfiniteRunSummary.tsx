'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'
import { SignInCard } from './SignInCTA'
import { QuestionRating } from './QuestionRating'
import { FlagQuestion } from './FlagQuestion'
import type { InfiniteRunState, InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'

interface Props {
  state: InfiniteRunState
  onPlayAgain: () => void
  onBack: () => void
  mode?: InfiniteMode
}

function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${seconds}s`
}

function getRunRating(longestStreak: number): string {
  if (longestStreak >= 20) return 'Legendary!'
  if (longestStreak >= 10) return 'Amazing!'
  if (longestStreak >= 5) return 'Great Run!'
  if (longestStreak >= 2) return 'Good Try!'
  return 'Keep Exploring!'
}

const ANSWERS_PAGE_SIZE = 20

type AnswerEntry = InfiniteRunState['answers'][number]

export function InfiniteRunSummary({ state, onPlayAgain, onBack, mode = 'scored' }: Props) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [showAllAnswers, setShowAllAnswers] = useState(false)
  const [detailFor, setDetailFor] = useState<AnswerEntry | null>(null)

  const handleShare = async () => {
    const lines = [
      '🧠 CometCave Infinite Trivia',
      `🔥 Longest Streak: ${state.longestStreak}`,
      `💎 Score: ${state.score.toLocaleString()}`,
      `📊 ${state.questionsAnswered} questions answered`,
      state.trailblazes > 0 ? `⭐ ${state.trailblazes} trailblazer${state.trailblazes === 1 ? '' : 's'}` : null,
      'https://cometcave.com/trivia',
    ].filter(Boolean).join('\n')

    try {
      await navigator.clipboard.writeText(lines)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silent fail
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 max-w-lg mx-auto py-6">
      <div className="text-center">
        <h2 className="font-headline text-headline-lg text-ds-tertiary drop-shadow-[0_4px_0_var(--surface-container-lowest)] mb-1">
          {getRunRating(state.longestStreak)}
        </h2>
        {mode === 'practice' ? (
          <div className="flex flex-col items-center gap-1">
            <Pill tone="info" size="sm">Practice Run</Pill>
            <p className="text-on-surface/50 text-xs mt-1">Practice runs don&apos;t count toward stats.</p>
          </div>
        ) : (
          <p className="text-on-surface/50 text-sm">Run Complete</p>
        )}
      </div>

      {/* Hero: Longest Streak */}
      <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="text-6xl font-bold text-ds-tertiary">
              🔥 {state.longestStreak}
            </div>
            <div className="text-on-surface/40 text-sm mt-1">Longest Streak</div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{state.score.toLocaleString()}</div>
              <div className="text-on-surface/50 text-xs">Total Score</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{state.questionsAnswered}</div>
              <div className="text-on-surface/50 text-xs">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-ds-tertiary">{state.trailblazes}</div>
              <div className="text-on-surface/50 text-xs">Trailblazers</div>
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      {state.longestStreak >= 5 && (
        <Pill tone="hot" icon="local_fire_department">
          {state.longestStreak} streak!
        </Pill>
      )}

      {/* Per-question breakdown */}
      {state.answers.length > 0 && (
        <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-4">
            <h3 className="text-on-surface/70 text-sm font-semibold mb-3 uppercase tracking-wide">
              Answer History
            </h3>
            <div className="flex flex-col gap-2">
              {(showAllAnswers ? state.answers : state.answers.slice(0, ANSWERS_PAGE_SIZE)).map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-surface-dim/40">
                  <div className="flex items-center gap-3">
                    <span className="text-on-surface/50 text-sm font-mono w-4">{i + 1}</span>
                    <span className={`text-lg ${a.correct ? 'text-ds-primary' : 'text-ds-error'}`}>
                      {a.correct ? '✓' : '✗'}
                    </span>
                    {a.trailblazer && <span className="text-xs">⭐</span>}
                    {a.questionText && (
                      <button
                        type="button"
                        onClick={() => setDetailFor(a)}
                        className="text-on-surface/30 hover:text-on-surface/60 text-xs transition-colors"
                        aria-label="View question details"
                        title="View question"
                      >
                        ℹ️
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-on-surface/40 text-xs">{formatTime(a.timeMs)}</span>
                    <span className={`font-bold text-sm min-w-[4rem] text-right ${a.correct ? 'text-ds-tertiary' : 'text-on-surface/30'}`}>
                      +{a.points}
                    </span>
                    <QuestionRating questionId={a.questionId} />
                    <FlagQuestion questionId={a.questionId} />
                  </div>
                </div>
              ))}
            </div>
            {state.answers.length > ANSWERS_PAGE_SIZE && !showAllAnswers && (
              <button
                className="mt-3 w-full text-on-surface/50 text-sm hover:text-on-surface/80 transition-colors py-1"
                onClick={() => setShowAllAnswers(true)}
              >
                Show all {state.answers.length} answers
              </button>
            )}
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <ChunkyButton variant="primary" size="hero" className="w-full" onClick={onPlayAgain}>
          Play Again
        </ChunkyButton>
        <ChunkyButton variant="secondary" className="w-full" onClick={handleShare}>
          {copied ? 'Copied!' : 'Share Run'}
        </ChunkyButton>
      </div>

      {(!user || user.isAnonymous) && (
        <SignInCard
          title={user?.isAnonymous ? '✨ Lock in your progress' : "🔒 Your run wasn't saved"}
          description={
            user?.isAnonymous
              ? 'Create an account to keep your runs across devices, build your constellation, and compete on the leaderboard.'
              : 'Sign in to save your runs, build your constellation, and compete on the leaderboard.'
          }
        />
      )}

      <ChunkyButton variant="ghost" size="sm" onClick={onBack}>
        Back to Trivia
      </ChunkyButton>

      {detailFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-4"
          onClick={() => setDetailFor(null)}
        >
          <div
            className="bg-surface-container-high rounded-ds-lg p-5 max-w-md w-full shadow-hero flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={detailFor.correct ? 'success' : 'hot'} size="sm">
                  {detailFor.correct ? 'Correct' : 'Wrong'}
                </Pill>
                <Pill tone="neutral" size="sm">{detailFor.difficulty.toUpperCase()}</Pill>
                {detailFor.trailblazer && <Pill tone="warning" size="sm">⭐ Trailblazer</Pill>}
              </div>
              <button
                onClick={() => setDetailFor(null)}
                className="text-on-surface/40 hover:text-on-surface text-xl leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-on-surface/60 text-xs uppercase tracking-wide">{detailFor.category}</p>
            <p className="text-on-surface text-base leading-snug">{detailFor.questionText}</p>
            <div className="text-sm flex flex-col gap-1">
              <div className="text-on-surface/70">
                Your answer:{' '}
                <span className={`font-medium ${detailFor.correct ? 'text-ds-primary' : 'text-ds-error'}`}>
                  {detailFor.userAnswer || '—'}
                </span>
              </div>
              {!detailFor.correct && (
                <div className="text-on-surface/70">
                  Correct answer: <span className="text-on-surface font-medium">{detailFor.correctAnswer}</span>
                </div>
              )}
            </div>
            {detailFor.explanation && (
              <div className="text-on-surface/60 text-sm border-t border-outline-variant pt-3">
                {detailFor.explanation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

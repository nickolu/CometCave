'use client'
import { useState } from 'react'

import type { InfiniteQuestion } from '@/app/trivia/hooks/useInfiniteRun'
import type { AnswerResult } from '@/app/trivia/lib/infiniteScoring'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader } from '@/components/ui/chunky-card'
import { Input } from '@/components/ui/input'

interface Props {
  question: InfiniteQuestion
  onSubmit: (answer: string) => void
  isSubmitting: boolean
  answerResult: (AnswerResult & { trailblazer: boolean; correctAnswer: string; explanation: string | null; timesShown?: number; timesCorrect?: number }) | null
  questionsAnswered: number
  skipsRemaining?: number
  onSkip?: () => void
}

function getSocialSignal(timesShown: number): string {
  if (timesShown === 0) return 'You are the first to find this question.'
  if (timesShown === 1) return '1 other person has answered this.'
  return `${timesShown} other people have answered this.`
}

export function InfiniteQuestionCard({
  question,
  onSubmit,
  isSubmitting,
  answerResult,
  questionsAnswered,
  skipsRemaining,
  onSkip,
}: Props) {
  const [textAnswer, setTextAnswer] = useState('')
  const isAnswered = answerResult !== null

  const diffBadgeColor = {
    easy: 'bg-green-600/30 text-green-400 border-green-600/50',
    medium: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50',
    hard: 'bg-red-600/30 text-red-400 border-red-600/50',
  }[question.difficulty]

  const handleSubmit = () => {
    if (textAnswer.trim() && !isSubmitting && !isAnswered) {
      onSubmit(textAnswer.trim())
    }
  }

  return (
    <ChunkyCard variant="surface-variant" shadow="hero">
      <ChunkyCardHeader className="pb-2 pt-3 sm:pt-6 px-4 sm:px-6">
        <div className="flex justify-between items-center">
          <span className="text-on-surface/50 text-xs sm:text-sm">
            Question {questionsAnswered + 1}
          </span>
          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full border ${diffBadgeColor}`}>
            {question.difficulty.toUpperCase()}
          </span>
        </div>
        {/* Social signal */}
        <p className="text-on-surface/30 text-xs italic mt-1">
          {getSocialSignal(question.timesShown)}
        </p>
      </ChunkyCardHeader>
      <ChunkyCardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <p className="text-on-surface/60 text-xs uppercase tracking-wide mb-1">{question.category}</p>
        <p aria-live="polite" className="text-on-surface text-base sm:text-lg mb-3 sm:mb-4 leading-snug">
          {question.question}
        </p>

        {/* Free-text input */}
        <div className="flex flex-col gap-8">
          <Input
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="!bg-surface-container-high border-outline-variant text-on-surface placeholder:text-on-surface/40"
            disabled={isAnswered || isSubmitting}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {!isAnswered && (
            <div className="flex gap-2">
              <ChunkyButton
                variant="primary"
                className="flex-1"
                disabled={isSubmitting || !textAnswer.trim()}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Checking...' : 'Submit Answer'}
              </ChunkyButton>
              {/* Skip when the player still has skips banked; otherwise
                  Dunno lets them concede the question without typing a
                  throwaway answer. Submits an empty string, which the
                  answer route already treats as incorrect (timeout
                  path), so the run continues with 0 pts on this Q. */}
              {!isSubmitting && skipsRemaining != null && (
                skipsRemaining > 0 && onSkip ? (
                  <ChunkyButton
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                  >
                    Skip
                  </ChunkyButton>
                ) : (
                  <ChunkyButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onSubmit('')}
                  >
                    Dunno
                  </ChunkyButton>
                )
              )}
            </div>
          )}
        </div>

        {/* Answer feedback */}
        {isAnswered && answerResult && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              answerResult.correct
                ? 'bg-primary-container/20 border border-primary-container/40'
                : 'bg-ds-error/20 border border-ds-error/40'
            }`}
          >
            <div className="font-bold mb-1">
              {answerResult.correct ? (
                <span className="text-ds-primary">
                  Correct! +{answerResult.points} pts
                  {answerResult.trailblazer && (
                    <span className="ml-2 text-on-surface/70">First to answer this question</span>
                  )}
                </span>
              ) : (
                <span className="text-ds-error">Incorrect — 0 pts</span>
              )}
            </div>
            {!answerResult.correct && (
              <div className="text-on-surface/70 text-sm">
                Answer: <span className="text-on-surface font-medium">{answerResult.correctAnswer}</span>
              </div>
            )}
            {answerResult.explanation && (
              <div className="text-on-surface/50 text-sm mt-1">
                {answerResult.explanation}
              </div>
            )}
            {/* Community accuracy — exclude the current player from the count */}
            {(() => {
              const rawShown = answerResult.timesShown ?? 0
              const rawCorrect = answerResult.timesCorrect ?? 0
              // Subtract current player from the totals
              const othersShown = Math.max(0, rawShown - 1)
              const othersCorrect = Math.max(0, rawCorrect - (answerResult.correct ? 1 : 0))

              if (othersShown === 0) return null // No other players — don't show anything

              if (othersShown >= 5) {
                const pct = Math.round((othersCorrect / othersShown) * 100)
                const color = pct > 70 ? 'text-ds-primary' : pct > 40 ? 'text-yellow-400' : 'text-ds-error'
                return (
                  <div className={`text-sm mt-2 ${color}`}>
                    {pct}% of other players got this right
                  </div>
                )
              }

              return (
                <div className="text-on-surface/40 text-sm mt-2">
                  {othersCorrect} of {othersShown} other {othersShown === 1 ? 'person' : 'people'} answered this correctly
                </div>
              )
            })()}
          </div>
        )}
      </ChunkyCardContent>
    </ChunkyCard>
  )
}

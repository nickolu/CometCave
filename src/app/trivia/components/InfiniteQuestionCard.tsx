'use client'
import { useState } from 'react'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader } from '@/components/ui/chunky-card'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Input } from '@/components/ui/input'
import type { InfiniteQuestion } from '@/app/trivia/hooks/useInfiniteRun'
import type { AnswerResult } from '@/app/trivia/lib/infiniteScoring'

interface Props {
  question: InfiniteQuestion
  onSubmit: (answer: string) => void
  isSubmitting: boolean
  answerResult: (AnswerResult & { trailblazer: boolean }) | null
  questionsAnswered: number
}

function getSocialSignal(timesShown: number): string {
  if (timesShown === 0) return 'You are the first traveler to find this question.'
  if (timesShown === 1) return '1 other traveler has answered this.'
  return `${timesShown} other travelers have answered this.`
}

export function InfiniteQuestionCard({
  question,
  onSubmit,
  isSubmitting,
  answerResult,
  questionsAnswered,
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
        <div className="flex flex-col gap-2">
          <Input
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="bg-surface-dim/50 border-outline-variant text-on-surface"
            disabled={isAnswered || isSubmitting}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            autoFocus
          />
          {!isAnswered && (
            <ChunkyButton
              variant="primary"
              disabled={isSubmitting || !textAnswer.trim()}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Checking...' : 'Submit Answer'}
            </ChunkyButton>
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
                    <span className="ml-2 text-ds-tertiary">⭐ Trailblazer!</span>
                  )}
                </span>
              ) : (
                <span className="text-ds-error">Incorrect — 0 pts</span>
              )}
            </div>
          </div>
        )}
      </ChunkyCardContent>
    </ChunkyCard>
  )
}

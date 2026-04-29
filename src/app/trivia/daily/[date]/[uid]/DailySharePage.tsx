'use client'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'

interface DailyResult {
  date: string
  score: number
  correct: number
  total: number
  grid: string
  category: { id: number; name: string; icon: string } | null
  nickname: string
}

export function DailySharePage({ result }: { result: DailyResult }) {
  const displayDate = new Date(result.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const accuracy = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-10 px-4">
      <div className="text-center">
        <h1 className="font-headline text-headline-lg text-ds-tertiary drop-shadow-[0_4px_0_var(--surface-container-lowest)] mb-2">
          CometCave Daily Trivia
        </h1>
        <p className="text-on-surface/50 text-sm">{displayDate}</p>
        {result.nickname && (
          <p className="text-on-surface/60 text-sm mt-1">
            Played by <span className="text-ds-tertiary font-medium">{result.nickname}</span>
          </p>
        )}
      </div>

      {result.category && (
        <div className="flex items-center gap-2 text-lg">
          <span className="text-2xl">{result.category.icon}</span>
          <span className="text-on-surface/70 font-medium">{result.category.name}</span>
        </div>
      )}

      <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
        <ChunkyCardContent className="pt-6">
          {result.grid && (
            <div className="text-center mb-4">
              <div className="text-3xl tracking-wider">{result.grid}</div>
            </div>
          )}

          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-ds-tertiary">
              {result.correct}/{result.total}
            </div>
            <div className="text-on-surface/40 text-sm mt-1">Correct Answers</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{result.score.toLocaleString()}</div>
              <div className="text-on-surface/50 text-xs">Score</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-on-surface">{accuracy}%</div>
              <div className="text-on-surface/50 text-xs">Accuracy</div>
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      <ChunkyButton
        variant="primary"
        size="hero"
        className="w-full"
        onClick={() => window.location.href = '/trivia'}
      >
        Play Today&apos;s Trivia
      </ChunkyButton>

      <p className="text-on-surface/30 text-xs text-center">
        CometCave — daily trivia adventure
      </p>
    </div>
  )
}

'use client'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import { SignInCard } from './SignInCTA'

interface Props {
  onBack: () => void
  score?: number
  questionsAnswered?: number
}

export function InfiniteExhaustedScreen({ onBack, score, questionsAnswered }: Props) {
  const { user } = useAuth()

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="text-center">
        <div className="text-6xl mb-4">✨</div>
        <h2 className="font-headline text-headline-lg text-ds-tertiary drop-shadow-[0_4px_0_var(--surface-container-lowest)] mb-2">
          You&apos;re all caught up
        </h2>
        <p className="text-on-surface/60 text-lg leading-relaxed max-w-sm mx-auto">
          You&apos;ve answered every question we have right now. New ones are on the way — check back soon.
        </p>
      </div>

      {(score !== undefined || questionsAnswered !== undefined) && (
        <ChunkyCard variant="surface-variant" className="w-full bg-surface-container/80 border-outline-variant">
          <ChunkyCardContent className="pt-6 text-center">
            <p className="text-on-surface/50 text-sm mb-2">This run</p>
            <div className="grid grid-cols-2 gap-3">
              {score !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-ds-tertiary">{score.toLocaleString()}</div>
                  <div className="text-on-surface/50 text-xs">Score</div>
                </div>
              )}
              {questionsAnswered !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-on-surface">{questionsAnswered}</div>
                  <div className="text-on-surface/50 text-xs">Questions</div>
                </div>
              )}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>
      )}

      {(!user || user.isAnonymous) && (
        <SignInCard
          title="🔔 Want to know when new questions arrive?"
          description="Sign in and we'll let you know when more questions are ready."
        />
      )}

      <ChunkyButton variant="secondary" size="lg" className="w-full" onClick={onBack}>
        Back to Trivia
      </ChunkyButton>
    </div>
  )
}

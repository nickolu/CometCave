'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { useAuth } from '@/hooks/useAuth'
import { SignInCard } from './SignInCTA'
import type { InfiniteRunState } from '@/app/trivia/hooks/useInfiniteRun'

interface Props {
  state: InfiniteRunState
  onPlayAgain: () => void
  onBack: () => void
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

export function InfiniteRunSummary({ state, onPlayAgain, onBack }: Props) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

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
        <p className="text-on-surface/50 text-sm">Run Complete</p>
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
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {state.answers.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-surface-dim/40">
                  <div className="flex items-center gap-3">
                    <span className="text-on-surface/50 text-sm font-mono w-4">{i + 1}</span>
                    <span className={`text-lg ${a.correct ? 'text-ds-primary' : 'text-ds-error'}`}>
                      {a.correct ? '✓' : '✗'}
                    </span>
                    {a.trailblazer && <span className="text-xs">⭐</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-on-surface/40 text-xs">{formatTime(a.timeMs)}</span>
                    <span className={`font-bold text-sm min-w-[4rem] text-right ${a.correct ? 'text-ds-tertiary' : 'text-on-surface/30'}`}>
                      +{a.points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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

      {!user && (
        <SignInCard
          title="🔒 Your run wasn't saved"
          description="Sign in to save your runs, build your constellation, and compete on the leaderboard."
        />
      )}

      <ChunkyButton variant="ghost" size="sm" onClick={onBack}>
        Back to Trivia
      </ChunkyButton>
    </div>
  )
}

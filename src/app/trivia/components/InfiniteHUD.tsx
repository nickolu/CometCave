'use client'
import { useEffect, useRef, useState } from 'react'

import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'
import { LIVES_MAX, computeStreakMultiplier } from '@/app/trivia/lib/infiniteScoring'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Pill, ScoreChip } from '@/components/ui/pill'

export interface CategoryProgress {
  name: string
  icon?: string
  correctCount: number
  nextThreshold: number | null
}

interface InfiniteHUDProps {
  livesRemaining: number
  currentStreak: number
  score: number
  timeRemaining: number
  timeLimit: number
  onFlee: () => void
  isPlaying: boolean
  mode?: InfiniteMode
  categoryName?: string
  categoryProgress?: CategoryProgress | null
  skipsRemaining?: number
}

// Renders a number that briefly pulses + floats a "+1" badge when it
// increases. Used by the HUD's per-category progress line so each correct
// answer feels like it landed.
function TickUpCount({ value }: { value: number }) {
  const prev = useRef(value)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (value > prev.current) {
      // Transient animation flag triggered by a prop change; the cascade
      // is bounded (one extra render to clear pulse after the timeout).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPulse(true)
      const id = window.setTimeout(() => setPulse(false), 700)
      prev.current = value
      return () => window.clearTimeout(id)
    }
    prev.current = value
  }, [value])

  return (
    <span className="relative inline-block">
      <span
        className={`inline-block transition-transform duration-300 ${
          pulse ? 'scale-125 text-ds-tertiary' : 'scale-100'
        }`}
      >
        {value}
      </span>
      {pulse && (
        <span
          aria-hidden="true"
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-ds-tertiary text-[10px] font-bold animate-bounce"
        >
          +1
        </span>
      )}
    </span>
  )
}

export function InfiniteHUD({
  livesRemaining,
  currentStreak,
  score,
  timeRemaining,
  timeLimit,
  onFlee,
  isPlaying,
  mode = 'scored',
  categoryName,
  categoryProgress,
  skipsRemaining,
}: InfiniteHUDProps) {
  const [showFleeConfirm, setShowFleeConfirm] = useState(false)
  const mult = computeStreakMultiplier(currentStreak)

  const timerPercent = (timeRemaining / timeLimit) * 100
  const timerColor =
    timerPercent > 60
      ? 'bg-green-500'
      : timerPercent > 30
        ? 'bg-yellow-500'
        : 'bg-red-500'

  const handleFlee = () => {
    if (isPlaying) setShowFleeConfirm(true)
    else onFlee()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <ChunkyButton
          variant="exit"
          size="sm"
          onClick={handleFlee}
          iconStart={
            <span className="material-symbols-outlined text-[18px]">close</span>
          }
        >
          <span className="hidden sm:inline">Exit Game</span>
        </ChunkyButton>

        {/* Lives or Practice indicator */}
        {mode === 'practice' ? (
          <Pill tone="info" size="sm">Practice</Pill>
        ) : (
          <div className="flex items-center gap-0.5" aria-label={`${livesRemaining} lives remaining`}>
            {Array.from({ length: LIVES_MAX }, (_, i) => (
              <span
                key={i}
                className={`text-sm transition-opacity ${i < livesRemaining ? 'opacity-100' : 'opacity-20'}`}
              >
                {i < livesRemaining ? '❤️' : '🖤'}
              </span>
            ))}
          </div>
        )}

        {/* Skips remaining */}
        {skipsRemaining != null && skipsRemaining > 0 && (
          <Pill tone="neutral" size="sm">⏭️ {skipsRemaining}</Pill>
        )}

        {/* Streak + multiplier */}
        <div className="flex items-center gap-1.5">
          {currentStreak > 0 && (
            <Pill tone="hot" size="sm">
              🔥 {currentStreak}
            </Pill>
          )}
          {mult > 1 && (
            <Pill tone="info" size="sm">
              ×{mult}
            </Pill>
          )}
        </div>

        <ScoreChip score={score} />
      </div>

      {/* Timer bar */}
      <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${timerColor} transition-all duration-100 ease-linear`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {/* Timer pill + category progress */}
      <div className="flex justify-center items-center gap-2 flex-wrap">
        <Pill tone="neutral" size="sm">{Math.ceil(timeRemaining)}s</Pill>
        {categoryProgress ? (
          <Pill tone="neutral" size="sm">
            <span className="flex items-center gap-1">
              {categoryProgress.icon && <span aria-hidden="true">{categoryProgress.icon}</span>}
              <span>{categoryProgress.name}</span>
              <span className="opacity-60">·</span>
              <TickUpCount value={categoryProgress.correctCount} />
              {categoryProgress.nextThreshold != null && (
                <span className="opacity-60">/ {categoryProgress.nextThreshold}</span>
              )}
            </span>
          </Pill>
        ) : (
          categoryName && <Pill tone="neutral" size="sm">{categoryName}</Pill>
        )}
      </div>

      {/* Flee confirmation */}
      {showFleeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm">
          <div className="bg-surface-container-high rounded-ds-lg p-8 max-w-sm mx-4 shadow-hero text-center flex flex-col gap-4">
            <p className="text-on-surface text-body-lg">End your run? Your score will be saved.</p>
            <div className="flex gap-3 justify-center">
              <ChunkyButton
                variant="secondary"
                size="sm"
                onClick={() => setShowFleeConfirm(false)}
              >
                Stay
              </ChunkyButton>
              <ChunkyButton
                variant="exit"
                size="sm"
                onClick={() => {
                  setShowFleeConfirm(false)
                  onFlee()
                }}
              >
                End Run
              </ChunkyButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

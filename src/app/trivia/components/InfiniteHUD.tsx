'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Pill, ScoreChip } from '@/components/ui/pill'
import { computeStreakMultiplier } from '@/app/trivia/lib/infiniteScoring'

interface InfiniteHUDProps {
  livesRemaining: number
  currentStreak: number
  score: number
  timeRemaining: number
  timeLimit: number
  onFlee: () => void
  isPlaying: boolean
}

export function InfiniteHUD({
  livesRemaining,
  currentStreak,
  score,
  timeRemaining,
  timeLimit,
  onFlee,
  isPlaying,
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
          <span className="hidden sm:inline">Flee</span>
        </ChunkyButton>

        {/* Lives */}
        <div className="flex items-center gap-1" aria-label={`${livesRemaining} lives remaining`}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className={`text-lg transition-opacity ${i < livesRemaining ? 'opacity-100' : 'opacity-20'}`}
            >
              {i < livesRemaining ? '❤️' : '🖤'}
            </span>
          ))}
        </div>

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

      {/* Timer pill */}
      <div className="flex justify-center">
        <Pill tone="neutral" size="sm">{Math.ceil(timeRemaining)}s</Pill>
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

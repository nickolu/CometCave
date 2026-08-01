'use client'

import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { Pill, ScoreChip } from '@/components/ui/pill'
import { type ProgressSegmentResult, ProgressSegments } from '@/components/ui/progress-segments'

export interface TriviaHUDProps {
  currentQuestion: number
  totalQuestions: number
  score: number
  timeRemaining: number
  timeLimit: number
  onFlee: () => void
  isPlaying: boolean
  segmentResults?: Array<ProgressSegmentResult | undefined>
}

export function TriviaHUD({
  currentQuestion,
  totalQuestions,
  score,
  timeRemaining,
  timeLimit,
  onFlee,
  isPlaying,
  segmentResults,
}: TriviaHUDProps) {
  const [showFleeConfirm, setShowFleeConfirm] = useState(false)

  const timerPercent = (timeRemaining / timeLimit) * 100
  const timerColor =
    timerPercent > 60
      ? 'bg-green-500'
      : timerPercent > 30
        ? 'bg-yellow-500'
        : 'bg-red-500'

  const handleFlee = () => {
    if (isPlaying) {
      setShowFleeConfirm(true)
    } else {
      onFlee()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar: Flee + timer pill + score */}
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

        <Pill tone="neutral" size="sm">
          {Math.ceil(timeRemaining)}s
        </Pill>

        <ScoreChip score={score} />
      </div>

      {/* Timer bar */}
      <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${timerColor} transition-all duration-100 ease-linear`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {/* Chamber Depth progress */}
      <ProgressSegments
        total={totalQuestions}
        current={currentQuestion + 1}
        label="Chamber Depth"
        segmentResults={segmentResults}
      />

      {/* Flee confirmation dialog */}
      {showFleeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="End game confirmation"
            className="bg-surface-container-high rounded-ds-lg p-8 max-w-sm mx-4 shadow-hero text-center flex flex-col gap-4"
          >
            <p className="text-on-surface text-body-lg">
              End this round? Your unfinished progress will be lost.
            </p>
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
                Exit Game
              </ChunkyButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

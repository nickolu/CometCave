'use client'
import { useEffect, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

interface Props {
  // 'loading' = still waiting on the question. 'awaiting-ready' = question is
  // here, but we held it back because the wait crossed the gate threshold.
  phase: 'loading' | 'awaiting-ready'
  onReady?: () => void
}

const RESEARCH_LINES = [
  'Combing the cosmos for a question worth your time…',
  'Pulling threads from the archive…',
  'Cross-referencing things only the cave remembers…',
  'Asking around. Quietly. So nobody panics…',
]

const ESCALATE_AFTER_MS = 900

export function InfiniteLoadingState({ phase, onReady }: Props) {
  // Timer-driven escalation while we're still loading. Once the timer fires
  // the brief spinner gives way to the full research treatment.
  const [timerEscalated, setTimerEscalated] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)

  // 'awaiting-ready' is always escalated — the question is here and we're
  // showing the Ready CTA. While loading, escalation is timer-driven.
  const escalated = phase === 'awaiting-ready' || timerEscalated

  useEffect(() => {
    if (phase !== 'loading' || timerEscalated) return
    const t = window.setTimeout(() => setTimerEscalated(true), ESCALATE_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [phase, timerEscalated])

  // Rotate the researchy copy while the player waits, so a long wait doesn't
  // feel like a dead screen. Stops once the question lands.
  useEffect(() => {
    if (!escalated || phase !== 'loading') return
    const id = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % RESEARCH_LINES.length)
    }, 2400)
    return () => window.clearInterval(id)
  }, [escalated, phase])

  if (!escalated) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-10 max-w-lg mx-auto"
        aria-live="polite"
      >
        <CosmicSpinner small />
        <p className="text-on-surface/50 text-sm">Up next…</p>
      </div>
    )
  }

  const isReady = phase === 'awaiting-ready'

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 py-10 sm:py-14 px-4 max-w-lg mx-auto text-center"
      aria-live="polite"
      aria-busy={!isReady}
    >
      <CosmicSpinner />

      <div className="flex flex-col gap-2 min-h-[3.5rem]">
        <p className="text-on-surface text-base sm:text-lg leading-snug font-medium">
          {isReady ? 'Found something good.' : RESEARCH_LINES[lineIndex]}
        </p>
        <p className="text-on-surface/50 text-xs sm:text-sm">
          {isReady
            ? 'Click when you’re ready — the timer waits for you.'
            : 'The cave is researching.'}
        </p>
      </div>

      {isReady && onReady && (
        <ChunkyButton variant="primary" size="lg" className="w-full sm:w-auto sm:min-w-[14rem]" onClick={onReady}>
          Ready
        </ChunkyButton>
      )}
    </div>
  )
}

// Three concentric rings drifting at different speeds with a small spark at
// the center. Pure CSS — respects prefers-reduced-motion via the
// motion-reduce: utilities.
function CosmicSpinner({ small = false }: { small?: boolean }) {
  const size = small ? 'h-10 w-10' : 'h-24 w-24 sm:h-28 sm:w-28'
  return (
    <div className={`relative ${size}`} aria-hidden="true">
      <span
        className="absolute inset-0 rounded-full border-2 border-ds-primary/40 motion-safe:animate-[spin_3s_linear_infinite]"
        style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent' }}
      />
      <span
        className="absolute inset-1.5 rounded-full border-2 border-ds-secondary/35 motion-safe:animate-[spin_4.5s_linear_infinite_reverse]"
        style={{ borderRightColor: 'transparent', borderBottomColor: 'transparent' }}
      />
      <span
        className="absolute inset-3 rounded-full border-2 border-ds-tertiary/30 motion-safe:animate-[spin_6s_linear_infinite]"
        style={{ borderTopColor: 'transparent' }}
      />
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ds-primary motion-safe:animate-pulse shadow-glow-primary ${
          small ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'
        }`}
      />
    </div>
  )
}

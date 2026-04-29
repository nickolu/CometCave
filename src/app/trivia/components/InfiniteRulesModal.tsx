'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'

interface Props {
  defaultMode: InfiniteMode
  onContinue: (mode: InfiniteMode, dismissForever: boolean) => void
  onCancel: () => void
}

export function InfiniteRulesModal({ defaultMode, onContinue, onCancel }: Props) {
  const [dismissForever, setDismissForever] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container-high rounded-ds-lg p-6 max-w-md w-full shadow-hero flex flex-col gap-4">
        <div>
          <h2 className="text-on-surface text-xl font-bold mb-1">Infinite Trivia</h2>
          <p className="text-on-surface/60 text-sm">
            An endless run powered by fresh AI-generated questions. Here&apos;s how it works:
          </p>
        </div>

        <ul className="text-on-surface/80 text-sm flex flex-col gap-2">
          <li className="flex gap-2">
            <span aria-hidden="true">❤️</span>
            <span><strong className="text-on-surface">3 lives.</strong> A wrong answer costs one. Zero lives ends the run.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">🔥</span>
            <span><strong className="text-on-surface">Streak multiplier.</strong> ×1.5 at 5 correct → ×2 at 10 → ×3 at 20.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">🩹</span>
            <span><strong className="text-on-surface">Bonus life.</strong> Every 10-streak refunds a life (cap of 3).</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">⭐</span>
            <span><strong className="text-on-surface">Trailblazer.</strong> First to answer a fresh question? +50 bonus.</span>
          </li>
        </ul>

        <p className="text-on-surface/50 text-xs">
          Practice mode plays the same questions with no lives and no scoring — a low-pressure way to explore.
        </p>

        <label className="flex items-center gap-2 text-on-surface/70 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dismissForever}
            onChange={(e) => setDismissForever(e.target.checked)}
            className="accent-ds-primary"
          />
          Don&apos;t show this again
        </label>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <ChunkyButton variant="ghost" size="sm" onClick={onCancel}>
            Back
          </ChunkyButton>
          <ChunkyButton
            variant="secondary"
            size="sm"
            onClick={() => onContinue('practice', dismissForever)}
          >
            Practice Mode
          </ChunkyButton>
          <ChunkyButton
            variant="primary"
            size="sm"
            onClick={() => onContinue(defaultMode === 'practice' ? 'practice' : 'scored', dismissForever)}
          >
            Continue
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

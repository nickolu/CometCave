'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'
import { CATEGORY_META } from '@/lib/trivia/categories'

interface Props {
  defaultMode: InfiniteMode
  onContinue: (mode: InfiniteMode, dismissForever: boolean, categoryId?: number) => void
  onCancel: () => void
}

export function InfiniteRulesModal({ defaultMode, onContinue, onCancel }: Props) {
  const [dismissForever, setDismissForever] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined)

  const categoryEntries = Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id: Number(id),
    ...meta,
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container-high rounded-ds-lg p-6 max-w-md w-full shadow-hero flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
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
        </ul>

        <p className="text-on-surface/50 text-xs">
          Practice mode plays the same questions with no lives and no scoring — a low-pressure way to explore.
        </p>

        {/* Category selector */}
        <div className="flex flex-col gap-2">
          <p className="text-on-surface/70 text-sm font-medium">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {/* "All" chip */}
            <button
              type="button"
              onClick={() => setSelectedCategoryId(undefined)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategoryId === undefined
                  ? 'bg-ds-primary text-on-primary'
                  : 'bg-surface-container text-on-surface/70 hover:bg-surface-container-highest'
              }`}
            >
              <span aria-hidden="true">🌐</span>
              All
            </button>
            {categoryEntries.map(({ id, name, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCategoryId(id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategoryId === id
                    ? 'bg-ds-primary text-on-primary'
                    : 'bg-surface-container text-on-surface/70 hover:bg-surface-container-highest'
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {name}
              </button>
            ))}
          </div>
        </div>

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
            onClick={() => onContinue('practice', dismissForever, selectedCategoryId)}
          >
            Practice Mode
          </ChunkyButton>
          <ChunkyButton
            variant="primary"
            size="sm"
            onClick={() => onContinue(defaultMode === 'practice' ? 'practice' : 'scored', dismissForever, selectedCategoryId)}
          >
            Continue
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

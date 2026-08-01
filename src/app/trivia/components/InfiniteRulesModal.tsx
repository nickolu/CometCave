'use client'
import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'
import { CATEGORY_META } from '@/lib/trivia/categories'

const RULES_SEEN_KEY = 'cometcave-infinite-rules-seen-v1'

interface Props {
  defaultMode: InfiniteMode
  onContinue: (mode: InfiniteMode, categoryId?: number) => void
  onCancel: () => void
}

export function InfiniteRulesModal({ defaultMode, onContinue, onCancel }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined)

  // Only hide the rules explanation if the user has seen it before
  const rulesSeen = typeof window !== 'undefined'
    ? window.localStorage.getItem(RULES_SEEN_KEY) === '1'
    : false

  const [showRulesText, setShowRulesText] = useState(!rulesSeen)

  const handleContinue = (mode: InfiniteMode) => {
    // Mark rules as seen so the explanation is collapsed next time
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RULES_SEEN_KEY, '1')
    }
    onContinue(mode, selectedCategoryId)
  }

  const categoryEntries = Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id: Number(id),
    ...meta,
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="infinite-rules-title"
        className="bg-surface-container-high rounded-ds-lg p-6 max-w-md w-full shadow-hero flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h2 id="infinite-rules-title" className="text-on-surface text-xl font-bold mb-1">Infinite Trivia</h2>
          {!showRulesText ? (
            <button
              type="button"
              onClick={() => setShowRulesText(true)}
              className="text-ds-primary text-xs hover:underline"
            >
              How to play →
            </button>
          ) : (
            <p className="text-on-surface/60 text-sm">
              An endless run powered by fresh AI-generated questions.
            </p>
          )}
        </div>

        {showRulesText && (
          <ul className="text-on-surface/80 text-sm flex flex-col gap-2">
            <li className="flex gap-2">
              <span aria-hidden="true">❤️</span>
              <span><strong className="text-on-surface">5 lives.</strong> A wrong answer costs one. Zero lives ends the run.</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">🔥</span>
              <span><strong className="text-on-surface">Streak multiplier.</strong> ×1.5 at 5 correct → ×2 at 10 → ×3 at 20.</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">🩹</span>
              <span><strong className="text-on-surface">Bonus life.</strong> Every 3-streak refunds a life (cap of 5).</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">⏭️</span>
              <span><strong className="text-on-surface">Two skips.</strong> Stuck on a question? Skip it — no life lost. Two per run.</span>
            </li>
          </ul>
        )}

        {/* Category selector — always visible */}
        <div className="flex flex-col gap-2">
          <p className="text-on-surface/70 text-sm font-medium">Category</p>
          <div className="flex flex-wrap gap-1.5">
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

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <ChunkyButton variant="ghost" size="sm" onClick={onCancel}>
            Back
          </ChunkyButton>
          <ChunkyButton
            variant="secondary"
            size="sm"
            onClick={() => handleContinue('practice')}
          >
            Practice Mode
          </ChunkyButton>
          <ChunkyButton
            variant="primary"
            size="sm"
            onClick={() => handleContinue(defaultMode === 'practice' ? 'practice' : 'scored')}
          >
            Start
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

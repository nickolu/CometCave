'use client'

import { MAX_MISTAKES } from '@/app/clusters/models/clusters'
import { cn } from '@/lib/utils'

/**
 * Four dots, spent one at a time — always beside a text equivalent. Dots
 * alone convey state by shape and color only.
 */
export function MistakeDots({ mistakes }: { mistakes: number }) {
  const left = Math.max(0, MAX_MISTAKES - mistakes)
  return (
    <p className="flex items-center gap-2.5 text-sm text-on-surface-variant">
      <span className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: MAX_MISTAKES }, (_, i) => (
          <span
            key={i}
            className={cn(
              'block h-2.5 w-2.5 rounded-full transition-colors duration-150',
              i < left ? 'bg-on-surface-variant' : 'border border-outline-variant bg-transparent'
            )}
          />
        ))}
      </span>
      <span>
        {left} {left === 1 ? 'mistake' : 'mistakes'} left
      </span>
    </p>
  )
}

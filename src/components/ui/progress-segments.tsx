import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ProgressSegmentsProps extends React.HTMLAttributes<HTMLDivElement> {
  total: number
  current: number
  label?: string
  accent?: 'primary' | 'secondary'
}

const ProgressSegments = React.forwardRef<HTMLDivElement, ProgressSegmentsProps>(
  ({ total, current, label, accent = 'primary', className, ...props }, ref) => {
    const clampedCurrent = Math.max(0, Math.min(current, total))

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={clampedCurrent}
        aria-label={label ?? `Progress: ${clampedCurrent} of ${total}`}
        className={cn(
          'flex items-center gap-1 rounded-full p-2',
          'bg-surface-container-highest',
          'border-t border-t-white/5',
          'shadow-rim-top',
          className
        )}
        {...props}
      >
        {label && (
          <span className="shrink-0 pl-2 pr-3 font-label text-xs uppercase tracking-widest text-on-surface-variant">
            {label}
          </span>
        )}
        {Array.from({ length: total }, (_, i) => {
          const index = i + 1
          const isFilled = index < clampedCurrent
          const isActive = index === clampedCurrent
          const isEmpty = index > clampedCurrent

          return (
            <div
              key={i}
              className={cn(
                'h-3 flex-1 rounded-full transition-all duration-300 relative overflow-hidden',
                isFilled && [
                  accent === 'primary'
                    ? 'bg-gradient-to-r from-primary-container to-secondary-container shadow-glow-primary'
                    : 'bg-gradient-to-r from-secondary-container to-ds-secondary shadow-glow-secondary',
                ],
                isActive && [
                  'border-2',
                  accent === 'primary'
                    ? 'border-primary-container shadow-glow-primary'
                    : 'border-secondary-container shadow-glow-secondary',
                  'bg-surface-container',
                ],
                isEmpty && 'bg-surface-container shadow-rim-inset-deep'
              )}
            >
              {isFilled && (
                <div
                  className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent motion-reduce:hidden"
                  aria-hidden
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }
)
ProgressSegments.displayName = 'ProgressSegments'

export { ProgressSegments }

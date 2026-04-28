import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const pillVariants = cva(
  [
    'inline-flex items-center gap-1.5 whitespace-nowrap',
    'font-label uppercase tracking-widest font-bold',
    'rounded-full shadow-button-sm',
    'border-t border-t-white/5',
  ].join(' '),
  {
    variants: {
      tone: {
        info: 'bg-secondary-container text-on-secondary-container',
        hot: 'bg-ds-error text-on-error',
        success: 'bg-primary-container text-on-primary-container',
        warning: 'bg-tertiary-fixed-dim text-on-tertiary-fixed',
        neutral: 'bg-surface-variant text-on-surface-variant',
      },
      size: {
        xs: 'px-2 py-0.5 text-[10px]',
        sm: 'px-3 py-1 text-xs',
      },
      pulse: {
        true: 'animate-pulse motion-reduce:animate-none',
        false: '',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'sm',
      pulse: false,
    },
  }
)

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  icon?: string
}

const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  ({ className, tone, size, pulse, icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(pillVariants({ tone, size, pulse, className }))}
      {...props}
    >
      {icon && (
        <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </span>
  )
)
Pill.displayName = 'Pill'

/* ── ScoreChip — multiplier + score combo ─────────────────────── */

export interface ScoreChipProps extends React.HTMLAttributes<HTMLDivElement> {
  multiplier?: number
  score: number
}

const ScoreChip = React.forwardRef<HTMLDivElement, ScoreChipProps>(
  ({ multiplier, score, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full',
        'bg-surface-container-high shadow-button-sm',
        'border-t border-t-white/5',
        'px-3 py-1',
        className
      )}
      {...props}
    >
      {multiplier && multiplier > 1 && (
        <span className="font-label text-xs font-bold text-ds-tertiary">
          x{multiplier}
        </span>
      )}
      <span className="material-symbols-outlined text-[18px] text-ds-tertiary" aria-hidden>
        star
      </span>
      <span className="font-headline text-sm font-bold text-on-surface">
        {score.toLocaleString()}
      </span>
    </div>
  )
)
ScoreChip.displayName = 'ScoreChip'

export { Pill, ScoreChip, pillVariants }

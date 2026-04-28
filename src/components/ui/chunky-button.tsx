import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const chunkyButtonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-label text-label-caps uppercase tracking-widest',
    'cursor-pointer select-none',
    'transition-all duration-100 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:shadow-pressed active:translate-y-[var(--press-offset-button)]',
    'motion-reduce:active:translate-y-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-primary-container text-on-primary-container',
          'shadow-button',
          'hover:shadow-glow-primary',
        ].join(' '),
        secondary: [
          'bg-secondary-container text-on-secondary-container',
          'shadow-button',
          'hover:shadow-glow-secondary',
        ].join(' '),
        ghost: [
          'bg-transparent text-on-surface',
          'shadow-none',
          'hover:bg-surface-container-high/60 hover:scale-105',
          'active:translate-y-0',
        ].join(' '),
        exit: [
          'bg-surface-container-high text-ds-error',
          'shadow-button-sm',
          'active:translate-y-[var(--press-offset-button-sm)]',
        ].join(' '),
        utility: [
          'bg-ds-secondary/20 text-ds-secondary',
          'shadow-button-sm',
          'hover:bg-ds-secondary/30',
          'active:translate-y-[var(--press-offset-button-sm)]',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-4 text-xs',
        md: 'h-10 px-6 text-sm',
        lg: 'h-12 px-8 text-sm',
        hero: 'h-14 px-10 text-base',
      },
      shape: {
        pill: 'rounded-full',
        block: 'rounded-ds-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'pill',
    },
  }
)

export interface ChunkyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chunkyButtonVariants> {
  asChild?: boolean
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
}

const ChunkyButton = React.forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  (
    { className, variant, size, shape, asChild = false, iconStart, iconEnd, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(chunkyButtonVariants({ variant, size, shape, className }))}
        ref={ref}
        {...props}
      >
        {iconStart && <span className="inline-flex shrink-0">{iconStart}</span>}
        {children}
        {iconEnd && <span className="inline-flex shrink-0">{iconEnd}</span>}
      </Comp>
    )
  }
)
ChunkyButton.displayName = 'ChunkyButton'

export { ChunkyButton, chunkyButtonVariants }

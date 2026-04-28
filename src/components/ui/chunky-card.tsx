import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const chunkyCardVariants = cva(
  [
    'relative rounded-ds-sm overflow-hidden',
    'text-on-surface',
    'border-[4px] border-surface-container-lowest',
    'border-t-[1px] border-t-white/5',
  ].join(' '),
  {
    variants: {
      variant: {
        'surface-variant': 'bg-surface-variant',
        'surface-container-high': 'bg-surface-container-high',
        'surface-container': 'bg-surface-container',
      },
      shadow: {
        card: 'shadow-card',
        hero: 'shadow-hero',
        none: 'shadow-none',
      },
      interactive: {
        true: 'hover:-translate-y-2 transition-transform duration-200 cursor-pointer',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'surface-variant',
      shadow: 'card',
      interactive: false,
    },
  }
)

export interface ChunkyCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chunkyCardVariants> {
  cornerGlow?: 'primary' | 'secondary' | 'tertiary'
}

const ChunkyCard = React.forwardRef<HTMLDivElement, ChunkyCardProps>(
  ({ className, variant, shadow, interactive, cornerGlow, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(chunkyCardVariants({ variant, shadow, interactive, className }))}
      {...props}
    >
      {cornerGlow && (
        <div
          className={cn(
            'pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-30',
            cornerGlow === 'primary' && 'bg-ds-primary',
            cornerGlow === 'secondary' && 'bg-ds-secondary',
            cornerGlow === 'tertiary' && 'bg-ds-tertiary'
          )}
          aria-hidden
        />
      )}
      {children}
    </div>
  )
)
ChunkyCard.displayName = 'ChunkyCard'

const ChunkyCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-component-py px-component-px', className)}
      {...props}
    />
  )
)
ChunkyCardHeader.displayName = 'ChunkyCardHeader'

const ChunkyCardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-headline text-headline-md', className)}
      {...props}
    />
  )
)
ChunkyCardTitle.displayName = 'ChunkyCardTitle'

const ChunkyCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-component-px pb-component-py', className)}
      {...props}
    />
  )
)
ChunkyCardContent.displayName = 'ChunkyCardContent'

export {
  ChunkyCard,
  ChunkyCardHeader,
  ChunkyCardTitle,
  ChunkyCardContent,
  chunkyCardVariants,
}

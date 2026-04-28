import Link from 'next/link'
import * as React from 'react'

import { cn } from '@/lib/utils'

const sizeStyles = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const

export interface BrandMarkProps extends React.HTMLAttributes<HTMLElement> {
  size?: 'sm' | 'md' | 'lg'
  href?: string
}

const BrandMark = React.forwardRef<HTMLElement, BrandMarkProps>(
  ({ size = 'md', href, className, ...props }, ref) => {
    const classes = cn(
      'inline-block font-headline font-bold tracking-tight',
      'text-primary-container',
      'drop-shadow-[0_2px_0_var(--surface-container-lowest)]',
      'select-none',
      sizeStyles[size],
      className
    )

    if (href) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={cn(classes, 'hover:opacity-90 transition-opacity')}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          COMET<span className="text-on-surface-variant">CAVE</span>
        </Link>
      )
    }

    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} className={classes} {...props}>
        COMET<span className="text-on-surface-variant">CAVE</span>
      </span>
    )
  }
)
BrandMark.displayName = 'BrandMark'

export { BrandMark }

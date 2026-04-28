'use client'

import { type VariantProps, cva } from 'class-variance-authority'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { cn } from '@/lib/utils'

const navPillVariants = cva(
  [
    'inline-flex items-center gap-2 whitespace-nowrap',
    'font-label text-label-caps uppercase tracking-widest',
    'transition-all duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      layout: {
        inline: 'px-3 py-2 text-xs border-b-4 border-transparent hover:scale-105',
        block: [
          'w-full px-component-px py-3 rounded-ds-sm text-sm',
          'hover:bg-surface-container-high/60',
        ].join(' '),
      },
    },
    defaultVariants: {
      layout: 'inline',
    },
  }
)

export interface NavPillProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
    VariantProps<typeof navPillVariants> {
  href: string
  icon?: string
  exact?: boolean
}

const NavPill = React.forwardRef<HTMLAnchorElement, NavPillProps>(
  ({ className, layout, href, icon, exact = false, children, ...props }, ref) => {
    const pathname = usePathname()
    const isActive = exact ? pathname === href : pathname.startsWith(href)

    const activeStyles =
      layout === 'block'
        ? 'bg-primary-container text-on-primary-container shadow-glow-primary'
        : 'border-b-primary-container text-on-surface'

    const inactiveStyles = 'text-on-surface-variant'

    return (
      <Link
        ref={ref}
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          navPillVariants({ layout, className }),
          isActive ? activeStyles : inactiveStyles
        )}
        {...props}
      >
        {icon && (
          <span
            className={cn(
              'material-symbols-outlined text-[20px] leading-none',
              isActive && 'font-variation-settings-fill'
            )}
            style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            aria-hidden
          >
            {icon}
          </span>
        )}
        {children}
      </Link>
    )
  }
)
NavPill.displayName = 'NavPill'

export { NavPill, navPillVariants }

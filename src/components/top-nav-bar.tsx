'use client'

import * as React from 'react'

import { BrandMark } from '@/components/brand-mark'
import { NavPill } from '@/components/ui/nav-pill'

import { ROUTE_CONSTANTS } from '@/app/route-constants'

const navItems = [
  { href: ROUTE_CONSTANTS.HOME, label: 'HOME', exact: true },
  { href: ROUTE_CONSTANTS.TRIVIA, label: 'TRIVIA' },
  { href: ROUTE_CONSTANTS.ORACLE, label: 'ORACLE' },
  { href: ROUTE_CONSTANTS.TAP_TAP_ADVENTURE, label: 'TAP TAP' },
  { href: ROUTE_CONSTANTS.CHAT_ROOM, label: 'CHAT' },
  { href: ROUTE_CONSTANTS.SECRET_WORD, label: 'SECRET WORD' },
  { href: ROUTE_CONSTANTS.VOTERS, label: 'VOTERS' },
] as const

export function TopNavBar() {
  return (
    <header className="sticky top-0 z-30 mt-4 mx-4">
      <div className="mx-auto max-w-7xl">
        <nav
          className={[
            'flex items-center gap-2 px-4 py-2',
            'bg-surface-container-lowest/90 backdrop-blur-md',
            'rounded-full',
            'border-4 border-surface-container-lowest',
            'shadow-button',
          ].join(' ')}
          aria-label="Main navigation"
        >
          <BrandMark href="/" size="sm" className="shrink-0 mr-2" />

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
            {navItems.map(({ href, label, exact }) => (
              <NavPill
                key={href}
                href={href}
                layout="inline"
                exact={exact}
              >
                {label}
              </NavPill>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}

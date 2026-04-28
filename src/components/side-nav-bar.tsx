'use client'

import * as React from 'react'

import { BrandMark } from '@/components/brand-mark'
import { NavPill } from '@/components/ui/nav-pill'

import { ROUTE_CONSTANTS } from '@/app/route-constants'

const gameNavItems: readonly { href: string; label: string; icon: string }[] = [
  { href: ROUTE_CONSTANTS.HOME, label: 'Home', icon: 'home' },
  { href: ROUTE_CONSTANTS.TRIVIA, label: 'Daily Trivia', icon: 'quiz' },
  { href: ROUTE_CONSTANTS.ORACLE, label: 'Oracle', icon: 'auto_awesome' },
  { href: ROUTE_CONSTANTS.TAP_TAP_ADVENTURE, label: 'Tap Tap', icon: 'swords' },
  { href: ROUTE_CONSTANTS.CHAT_ROOM, label: 'Chat Room', icon: 'chat' },
  { href: ROUTE_CONSTANTS.SECRET_WORD, label: 'Secret Word', icon: 'lock' },
  { href: ROUTE_CONSTANTS.VOTERS, label: 'Voters', icon: 'how_to_vote' },
]

export function SideNavBar() {
  return (
    <aside
      className={[
        'hidden md:flex flex-col',
        'fixed top-0 left-0 z-20',
        'h-screen w-[280px]',
        'bg-surface-container-low/95 backdrop-blur-md',
        'rounded-r-[3rem]',
        'border-r-4 border-r-surface-container-lowest',
        'border-t-0 border-b-0',
        'py-8 px-4',
        'shadow-hero',
      ].join(' ')}
      aria-label="Game navigation"
    >
      <div className="px-4 mb-8">
        <BrandMark href="/" size="sm" />
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {gameNavItems.map(({ href, label, icon }) => (
          <NavPill
            key={href}
            href={href}
            layout="block"
            icon={icon}
          >
            {label}
          </NavPill>
        ))}
      </nav>

      <div className="px-4 pt-4 border-t border-t-outline-variant/30">
        <p className="text-xs text-on-surface-variant/60 font-label uppercase tracking-widest">
          CometCave Arcade
        </p>
      </div>
    </aside>
  )
}

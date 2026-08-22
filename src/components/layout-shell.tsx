'use client'

import { usePathname } from 'next/navigation'

import { ROUTE_CONSTANTS } from '@/app/route-constants'

import type { ReactNode } from 'react'

const IMMERSIVE_ROUTES = [
  ROUTE_CONSTANTS.COMET_CARDS,
  ROUTE_CONSTANTS.MICRO_LAND,
  `${ROUTE_CONSTANTS.SPECK_WARS}/play`,
  `${ROUTE_CONSTANTS.SPECK_WARS}/skirmish`,
  ROUTE_CONSTANTS.VOICE_JOURNEY,
]

export function LayoutShell({
  children,
  nav,
  footer,
}: {
  children: ReactNode
  nav: ReactNode
  footer: ReactNode
}) {
  const pathname = usePathname()
  const isImmersive = IMMERSIVE_ROUTES.some(r => pathname.startsWith(r))

  if (isImmersive) {
    return (
      <main id="main-content" className="flex-1 z-20 relative">
        {children}
      </main>
    )
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-surface-container focus:text-on-surface focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-primary"
      >
        Skip to main content
      </a>
      {nav}
      <main id="main-content" className="flex-1 container mx-auto p-4 z-20 relative">
        {children}
      </main>
      {footer}
    </>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import { ROUTE_CONSTANTS } from '@/app/route-constants'
import type { ReactNode } from 'react'

const IMMERSIVE_ROUTES = [
  ROUTE_CONSTANTS.COMET_CARDS,
  `${ROUTE_CONSTANTS.SPECK_WARS}/play`,
  `${ROUTE_CONSTANTS.SPECK_WARS}/skirmish`,
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
    return <main className="flex-1 z-20 relative">{children}</main>
  }

  return (
    <>
      {nav}
      <main className="flex-1 container mx-auto p-4 z-20 relative">{children}</main>
      {footer}
    </>
  )
}

import * as React from 'react'

import { SideNavBar } from '@/components/side-nav-bar'

export function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideNavBar />
      <div className="md:ml-[280px]">{children}</div>
    </>
  )
}

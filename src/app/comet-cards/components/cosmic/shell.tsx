'use client'

import { AmbientBG } from './ambient-bg'

import type { ReactNode } from 'react'

export function CosmicShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="cosmic-cards relative w-full overflow-hidden"
      style={{
        minHeight: 'calc(100vh - 8rem)',
        background:
          'radial-gradient(ellipse at 15% 15%, var(--cc-bg-grad-1) 0%, var(--cc-bg-grad-2) 40%, var(--cc-bg-grad-3) 100%)',
        color: 'var(--cc-text-default)',
        borderRadius: 12,
        border: '1px solid rgba(94,234,212,0.08)',
      }}
    >
      <AmbientBG />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

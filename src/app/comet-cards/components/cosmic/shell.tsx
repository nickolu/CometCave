'use client'

import { AmbientBG } from './ambient-bg'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'

import type { ReactNode } from 'react'

export function CosmicShell({ children }: { children: ReactNode }) {
  const isLandscape = useLandscapeMobile()
  return (
    <div
      className="cosmic-cards relative w-full overflow-hidden"
      style={{
        minHeight: isLandscape ? '100vh' : 'calc(100vh - 8rem)',
        background:
          'radial-gradient(ellipse at 15% 15%, var(--cc-bg-grad-1) 0%, var(--cc-bg-grad-2) 40%, var(--cc-bg-grad-3) 100%)',
        color: 'var(--cc-text-default)',
        borderRadius: isLandscape ? 0 : 12,
        border: isLandscape ? 'none' : '1px solid rgba(94,234,212,0.08)',
      }}
    >
      <AmbientBG />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

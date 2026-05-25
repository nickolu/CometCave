'use client'

import Link from 'next/link'
import { MotionConfig } from 'framer-motion'
import { AmbientBG } from './ambient-bg'

import type { ReactNode } from 'react'

export function CosmicShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
    <div
      className="cosmic-cards relative w-full overflow-hidden"
      style={{
        height: '100dvh',
        background:
          'radial-gradient(ellipse at 15% 15%, var(--cc-bg-grad-1) 0%, var(--cc-bg-grad-2) 40%, var(--cc-bg-grad-3) 100%)',
        color: 'var(--cc-text-default)',
      }}
    >
      <AmbientBG />
      <Link
        href="/"
        aria-label="Exit to CometCave"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          color: 'var(--cc-text-muted, rgba(255,255,255,0.5))',
          textDecoration: 'none',
          padding: '4px 8px',
          borderRadius: 6,
          transition: 'color 0.15s',
        }}
        className="hover:!text-white"
      >
        ✕
      </Link>
      <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{children}</div>
    </div>
    </MotionConfig>
  )
}

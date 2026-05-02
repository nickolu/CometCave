'use client'

import { GhostButton } from '@/app/daily-card-game/components/cosmic/buttons'
import { Panel } from '@/app/daily-card-game/components/cosmic/panel'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'

import type { ReactNode } from 'react'

export function ReferenceView({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div
      className="mx-auto"
      style={{ maxWidth: 1080, padding: '32px 22px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <header className="flex flex-col items-start" style={{ gap: 4 }}>
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            letterSpacing: 3,
            opacity: 0.55,
            color: 'var(--cc-mint)',
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 300,
            letterSpacing: -0.5,
            margin: 0,
            color: 'var(--cc-text-default)',
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: 13,
              opacity: 0.7,
              maxWidth: 640,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {description}
          </p>
        )}
      </header>

      <Panel>
        <div style={{ padding: 18 }}>{children}</div>
      </Panel>

      <div>
        <GhostButton onClick={() => eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })}>
          ← Back
        </GhostButton>
      </div>
    </div>
  )
}

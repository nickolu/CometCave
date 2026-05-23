'use client'

import {
  GhostButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'

const REFERENCE_BUTTONS = [
  { event: 'DISPLAY_JOKERS', label: 'Jokers' },
  { event: 'DISPLAY_VOUCHERS', label: 'Vouchers' },
  { event: 'DISPLAY_TAROT_CARDS', label: 'Tarot Cards' },
  { event: 'DISPLAY_CELESTIALS', label: 'Celestial Cards' },
  { event: 'DISPLAY_BOSS_BLINDS', label: 'Boss Blinds' },
  { event: 'DISPLAY_TAGS', label: 'Tags' },
  { event: 'DISPLAY_SPECTRAL_CARDS', label: 'Spectral Cards' },
] as const

export function MainMenuView() {
  const isLandscape = useLandscapeMobile()
  return (
    <div
      className="relative mx-auto flex flex-col items-center"
      style={{
        padding: isLandscape ? '16px 16px' : '64px 24px',
        gap: isLandscape ? 12 : 28,
        maxWidth: 720,
        textAlign: 'center',
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 11,
          letterSpacing: 4,
          color: 'var(--cc-mint)',
          opacity: 0.85,
        }}
      >
        CometCave
      </div>
      <h1
        style={{
          fontSize: isLandscape ? 28 : 48,
          fontWeight: 200,
          letterSpacing: -1.5,
          lineHeight: 1.05,
          color: 'var(--cc-text-default)',
          textShadow: '0 0 60px rgba(94,234,212,0.3)',
          margin: 0,
        }}
      >
        Daily Cards
      </h1>
      <p
        style={{
          fontSize: 14,
          opacity: 0.65,
          maxWidth: 460,
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        A new run, every day. Stack chips, multiply, and bend the rules with jokers.
      </p>

      <PrimaryButton
        style={{ padding: '14px 32px', fontSize: 13, letterSpacing: 3 }}
        onClick={() => eventEmitter.emit({ type: 'GAME_START' })}
      >
        Start Run
      </PrimaryButton>

      <div
        className="w-full"
        style={{
          marginTop: isLandscape ? 4 : 8,
          paddingTop: isLandscape ? 8 : 24,
          borderTop: '1px solid var(--cc-panel-divider)',
        }}
      >
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 2,
            opacity: 0.45,
            marginBottom: 12,
          }}
        >
          Reference
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {REFERENCE_BUTTONS.map(item => (
            <GhostButton
              key={item.event}
              onClick={() => eventEmitter.emit({ type: item.event })}
            >
              {item.label}
            </GhostButton>
          ))}
        </div>
      </div>
    </div>
  )
}

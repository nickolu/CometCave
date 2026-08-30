'use client'

import { useState } from 'react'
import {
  GhostButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { Modal } from '@/app/comet-cards/components/ui/modal'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { useRunHistory, type RunSummary } from '@/app/comet-cards/hooks/useRunHistory'
import type { GameEvent } from '@/app/comet-cards/domain/events/types'

const REFERENCE_BUTTONS = [
  { event: 'DISPLAY_JOKERS', label: 'Jokers' },
  { event: 'DISPLAY_VOUCHERS', label: 'Vouchers' },
  { event: 'DISPLAY_TAROT_CARDS', label: 'Tarot Cards' },
  { event: 'DISPLAY_CELESTIALS', label: 'Celestial Cards' },
  { event: 'DISPLAY_BOSS_BLINDS', label: 'Boss Blinds' },
  { event: 'DISPLAY_TAGS', label: 'Tags' },
  { event: 'DISPLAY_SPECTRAL_CARDS', label: 'Spectral Cards' },
] as const

/**
 * One of the two dailies. The card doubles as a status board — principle 3 says
 * the regular should learn something from the tap they were going to make
 * anyway, so each card says where today stands before they choose.
 */
function ModeCard({
  name,
  tagline,
  meta,
  event,
  todaysRun,
}: {
  name: string
  tagline: string
  meta: string
  event: GameEvent
  todaysRun: RunSummary | null
}) {
  const played = todaysRun !== null

  return (
    <div
      className="flex flex-col"
      style={{
        border: '1px solid var(--cc-panel-border)',
        background: 'linear-gradient(180deg, var(--cc-panel-grad-from), var(--cc-panel-grad-to))',
        borderRadius: 10,
        padding: 16,
        gap: 10,
        textAlign: 'left',
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1,
            color: 'var(--cc-mint)',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            opacity: 0.45,
            whiteSpace: 'nowrap',
          }}
        >
          {meta}
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.5, flex: '1 1 auto' }}>{tagline}</div>

      {played ? (
        <div
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            color: todaysRun.won ? 'var(--cc-mint)' : 'var(--cc-pink)',
          }}
        >
          {todaysRun.won ? 'Cleared' : 'Fell'} · {todaysRun.totalScore}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 11, opacity: 0.4 }}>
          Not played today
        </div>
      )}

      {played ? (
        <GhostButton
          style={{ fontSize: 11, letterSpacing: 1.5 }}
          onClick={() => eventEmitter.emit(event)}
        >
          Play Again
        </GhostButton>
      ) : (
        <PrimaryButton
          style={{ fontSize: 12, letterSpacing: 2 }}
          onClick={() => eventEmitter.emit(event)}
        >
          Play
        </PrimaryButton>
      )}

      {played && (
        <div
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            opacity: 0.3,
          }}
        >
          Practice — score won't be recorded
        </div>
      )}
    </div>
  )
}

export function MainMenuView() {
  const isLandscape = useLandscapeMobile()
  const { history, todayRun, todayLastAnteRun } = useRunHistory()
  const [showHistory, setShowHistory] = useState(false)
  const autoFocusRef = useAutoFocus()
  return (
    <div
      ref={autoFocusRef}
      className="cc-scroll relative mx-auto flex flex-col items-center"
      style={{
        padding: isLandscape ? '16px 16px' : '64px 24px',
        gap: isLandscape ? 12 : 28,
        maxWidth: 720,
        textAlign: 'center',
        height: '100%',
        overflowY: 'auto',
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
        Two tables, both dealt fresh at midnight. Take the long way down, or arrive at the end and
        talk your way out of it.
      </p>

      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: isLandscape ? '1fr 1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          maxWidth: 560,
        }}
      >
        <ModeCard
          name="The Last Ante"
          tagline="One round. Four minutes. You start at the end."
          meta="~4 min"
          event={{ type: 'START_LAST_ANTE' }}
          todaysRun={todayLastAnteRun}
        />
        <ModeCard
          name="The Long Fall"
          tagline="Eight rounds from nothing. The full descent."
          meta="~30 min"
          event={{ type: 'GAME_START' }}
          todaysRun={todayRun}
        />
      </div>

      {history.runs.length === 0 && (
        <div
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            opacity: 0.4,
            letterSpacing: 1,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          No runs yet.
        </div>
      )}

      {history.runs.length > 0 && (
        <div
          className="flex items-center justify-center gap-6"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            opacity: 0.55,
            letterSpacing: 1,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 200, opacity: 1, color: 'var(--cc-mint)', letterSpacing: -0.5 }}>
              {history.bestScore}
            </div>
            <div style={{ marginTop: 2 }}>Best Score</div>
          </div>
          <div style={{ width: 1, height: 28, background: 'var(--cc-panel-divider)' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 200, opacity: 1, color: 'var(--cc-text-default)', letterSpacing: -0.5 }}>
              {history.wins}–{history.losses}
            </div>
            <div style={{ marginTop: 2 }}>Record</div>
          </div>
          <div style={{ width: 1, height: 28, background: 'var(--cc-panel-divider)' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 200, opacity: 1, color: 'var(--cc-text-default)', letterSpacing: -0.5 }}>
              {history.runs.length}
            </div>
            <div style={{ marginTop: 2 }}>Runs</div>
          </div>
        </div>
      )}

      {history.runs.length > 0 && (
        <GhostButton
          onClick={() => setShowHistory(true)}
          style={{ fontSize: 10, opacity: 0.6 }}
        >
          Run History
        </GhostButton>
      )}

      <GhostButton
        onClick={() => eventEmitter.emit({ type: 'DISPLAY_HOW_TO_PLAY' })}
        style={{ fontSize: 12, letterSpacing: 1.5 }}
      >
        How to Play
      </GhostButton>

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
      {showHistory && (
        <Modal eyebrow="Stats" title="Run History" onClose={() => setShowHistory(false)}>
          <div
            className="cc-scroll flex flex-col"
            style={{
              padding: '12px 16px',
              maxHeight: '60vh',
              overflowY: 'auto',
              gap: 2,
            }}
          >
            {history.runs.map((run, i) => (
              <div
                key={`${run.date}-${i}`}
                className="flex items-center justify-between"
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 11,
                  gap: 12,
                }}
              >
                <div className="flex items-center" style={{ gap: 10 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: run.won ? 'rgba(94,234,212,0.15)' : 'rgba(255,107,157,0.15)',
                      color: run.won ? 'var(--cc-mint)' : 'var(--cc-pink)',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {run.won ? 'W' : 'L'}
                  </span>
                  <span style={{ opacity: 0.5 }}>{run.date}</span>
                </div>
                <div className="flex items-center" style={{ gap: 10 }}>
                  <span style={{ opacity: 0.5 }}>
                    {run.roundsCompleted}/{run.totalRounds}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: run.won ? 'var(--cc-mint)' : 'var(--cc-text-default)',
                      minWidth: 60,
                      textAlign: 'right',
                    }}
                  >
                    {run.totalScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

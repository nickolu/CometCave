'use client'

import { useState } from 'react'
import {
  GhostButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { Modal } from '@/app/comet-cards/components/ui/modal'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { useRunHistory } from '@/app/comet-cards/hooks/useRunHistory'

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
  const { history, todayRun } = useRunHistory()
  const [showHistory, setShowHistory] = useState(false)
  return (
    <div
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
      {todayRun ? (
        <>
          <p
            style={{
              fontSize: 14,
              opacity: 0.65,
              maxWidth: 460,
              lineHeight: 1.55,
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            Today's path is walked. Play again to practice — your recorded score won't change.
          </p>
          <div
            className="flex flex-col items-center"
            style={{
              fontFamily: 'var(--cc-font-mono)',
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                opacity: 0.45,
              }}
            >
              Today's Score
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 200,
                letterSpacing: -1,
                color: todayRun.won ? 'var(--cc-mint)' : 'var(--cc-pink)',
                textShadow: todayRun.won
                  ? '0 0 40px rgba(94,234,212,0.3)'
                  : '0 0 40px rgba(255,107,157,0.3)',
              }}
            >
              {todayRun.totalScore}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {todayRun.won ? 'Victory' : 'Defeated'} · {todayRun.roundsCompleted}/{todayRun.totalRounds} rounds · {todayRun.handsPlayed} hands
            </div>
          </div>
          <GhostButton
            style={{ padding: '10px 24px', fontSize: 12, letterSpacing: 2 }}
            onClick={() => eventEmitter.emit({ type: 'GAME_START' })}
          >
            Play Again
          </GhostButton>
          <div
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              opacity: 0.35,
              marginTop: -12,
            }}
          >
            Practice run — score won't be recorded
          </div>
        </>
      ) : (
        <>
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
        </>
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

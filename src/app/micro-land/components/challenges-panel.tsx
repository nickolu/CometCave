'use client'
import { useState } from 'react'
import { CHALLENGES } from '@/app/micro-land/domain/challenges'
import { resetTuning, setTuning } from '@/app/micro-land/domain/tuning'
import { useMicroLand } from '@/app/micro-land/store'

export function ChallengesPanel() {
  const open = useMicroLand(s => s.challengesOpen)
  const setChallengesOpen = useMicroLand(s => s.setChallengesOpen)
  const setChallengeActive = useMicroLand(s => s.setChallengeActive)
  const requestReshuffle = useMicroLand(s => s.requestReshuffle)
  const [targetGen, setTargetGen] = useState(10)
  const timeLimitOptions = [{ label: '3 min', seconds: 180 }, { label: '5 min', seconds: 300 }, { label: '10 min', seconds: 600 }]
  const [timeLimitIdx, setTimeLimitIdx] = useState(1)
  const startSpeedRun = useMicroLand(s => s.startSpeedRun)
  const elapsed = useMicroLand(s => s.elapsed)
  const speedRun = useMicroLand(s => s.speedRun)

  if (!open) return null

  function startChallenge(preset: (typeof CHALLENGES)[number]) {
    resetTuning()
    setTuning(preset.tuning)
    setChallengeActive({ name: preset.name, goal: preset.goal })
    requestReshuffle()
    setChallengesOpen(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => setChallengesOpen(false)}
    >
      <div
        style={{
          background: 'var(--cc-panel-bg)',
          border: '1px solid var(--cc-panel-divider)',
          borderRadius: 8,
          padding: '20px 24px',
          maxWidth: 420,
          width: '90vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: 'var(--cc-text-muted)',
            marginBottom: 16,
          }}
        >
          Challenges
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CHALLENGES.map(c => (
            <button
              key={c.id}
              type="button"
              className="cc-btn"
              onClick={() => startChallenge(c)}
              style={{
                display: 'block',
                textAlign: 'left',
                padding: '10px 14px',
                border: '1px solid var(--cc-mint-line)',
                borderRadius: 6,
                background: 'transparent',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: 'var(--cc-mint)',
                  marginBottom: 3,
                }}
              >
                {c.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginBottom: 4 }}>
                {c.blurb}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--cc-font-mono)',
                  color: 'var(--cc-text-muted)',
                  opacity: 0.7,
                }}
              >
                Goal: {c.goal}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, borderTop: '1px solid var(--cc-panel-divider)', paddingTop: 14 }}>
          <div style={{
            fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.6,
            textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 10,
          }}>
            Speed Run
          </div>
          <div style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginBottom: 10 }}>
            Race to keep a lineage alive to generation {targetGen} within the time limit.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {[10, 20, 30].map(g => (
              <button
                key={g}
                type="button"
                className="cc-btn"
                onClick={() => setTargetGen(g)}
                style={{
                  fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1,
                  textTransform: 'uppercase', padding: '3px 10px',
                  border: `1px solid ${targetGen === g ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
                  color: targetGen === g ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                }}
              >
                gen {g}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {timeLimitOptions.map((opt, i) => (
              <button
                key={opt.label}
                type="button"
                className="cc-btn"
                onClick={() => setTimeLimitIdx(i)}
                style={{
                  fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1,
                  textTransform: 'uppercase', padding: '3px 10px',
                  border: `1px solid ${timeLimitIdx === i ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
                  color: timeLimitIdx === i ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="cc-btn"
            onClick={() => {
              startSpeedRun(targetGen, timeLimitOptions[timeLimitIdx].seconds, elapsed)
              setChallengesOpen(false)
            }}
            style={{
              fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.2,
              textTransform: 'uppercase', padding: '5px 14px',
              border: '1px solid var(--cc-mint)',
              color: 'var(--cc-mint)',
              display: 'block',
            }}
          >
            {speedRun.active ? 'Restart Speed Run' : 'Start Speed Run'}
          </button>
        </div>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setChallengesOpen(false)}
          style={{
            marginTop: 14,
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            letterSpacing: 1,
            textTransform: 'uppercase',
            padding: '4px 10px',
            border: '1px solid var(--cc-panel-divider)',
            color: 'var(--cc-text-muted)',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

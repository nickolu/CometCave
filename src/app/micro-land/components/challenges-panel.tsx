'use client'
import { CHALLENGES } from '@/app/micro-land/domain/challenges'
import { resetTuning, setTuning } from '@/app/micro-land/domain/tuning'
import { useMicroLand } from '@/app/micro-land/store'

export function ChallengesPanel() {
  const open = useMicroLand(s => s.challengesOpen)
  const setChallengesOpen = useMicroLand(s => s.setChallengesOpen)
  const setChallengeActive = useMicroLand(s => s.setChallengeActive)
  const requestReshuffle = useMicroLand(s => s.requestReshuffle)

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

'use client'
import { useEffect, useState } from 'react'
import { useMicroLand } from '@/app/micro-land/store'
import { getFirebaseAuth } from '@/lib/firebase/client'

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function SpeedRunOverlay() {
  const speedRun = useMicroLand(s => s.speedRun)
  const elapsed = useMicroLand(s => s.elapsed)
  const deepestGeneration = useMicroLand(s => s.records.deepestGeneration)
  const cancelSpeedRun = useMicroLand(s => s.cancelSpeedRun)
  const requestReshuffle = useMicroLand(s => s.requestReshuffle)
  const themeId = useMicroLand(s => s.themeId)
  const leaderboard = useMicroLand(s => s.speedRunLeaderboard)
  const setLeaderboard = useMicroLand(s => s.setSpeedRunLeaderboard)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (speedRun.result !== 'won' || submitted) return
    const wonSeconds = speedRun.wonSeconds
    if (wonSeconds == null) return

    async function submitAndFetch() {
      setSubmitting(true)
      // Submit if signed in and not anonymous
      try {
        const auth = getFirebaseAuth()
        const user = auth.currentUser
        if (user && !user.isAnonymous) {
          const token = await user.getIdToken()
          await fetch('/api/v1/micro-land/speed-runs', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetGen: speedRun.targetGeneration, theme: themeId, seconds: wonSeconds }),
          })
        }
      } catch { /* best effort */ }

      // Always fetch leaderboard
      try {
        const res = await fetch(`/api/v1/micro-land/speed-runs?targetGen=${speedRun.targetGeneration}&limit=10`)
        if (res.ok) {
          const data = await res.json() as { entries: Array<{ displayName: string; theme: string; seconds: number; completedAt: number }> }
          setLeaderboard(data.entries)
        }
      } catch { /* best effort */ }

      setSubmitting(false)
      setSubmitted(true)
    }
    void submitAndFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedRun.result])

  useEffect(() => {
    if (speedRun.result === 'none') {
      setLeaderboard(null)
      setSubmitted(false)
    }
  }, [speedRun.result, setLeaderboard])

  if (!speedRun.active && speedRun.result === 'none') return null

  const timeRemaining = speedRun.timeLimitSeconds - (elapsed - speedRun.startElapsed)
  const isLow = timeRemaining < 30 && speedRun.result === 'none'
  const progress = Math.min(1, deepestGeneration / speedRun.targetGeneration)

  if (speedRun.result !== 'none') {
    const won = speedRun.result === 'won'
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'var(--cc-panel-bg)',
          border: `1px solid ${won ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
          borderRadius: 8, padding: '28px 32px', maxWidth: 340, width: '90vw',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--cc-font-mono)', fontSize: 11,
            letterSpacing: 1.6, textTransform: 'uppercase',
            color: won ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
            marginBottom: 12,
          }}>
            {won ? 'Speed Run Complete' : 'Speed Run Failed'}
          </div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{won ? '🏆' : '💀'}</div>
          <div style={{ fontSize: 14, color: 'var(--cc-text-muted)', marginBottom: 20 }}>
            {won
              ? `Reached generation ${speedRun.targetGeneration} — the line endures.`
              : `Generation ${deepestGeneration} of ${speedRun.targetGeneration} before time ran out.`}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              className="cc-btn"
              onClick={() => { cancelSpeedRun(); requestReshuffle() }}
              style={{
                fontFamily: 'var(--cc-font-mono)', fontSize: 10,
                letterSpacing: 1, textTransform: 'uppercase',
                padding: '6px 14px',
                border: '1px solid var(--cc-mint-line)',
                color: 'var(--cc-mint)',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="cc-btn"
              onClick={cancelSpeedRun}
              style={{
                fontFamily: 'var(--cc-font-mono)', fontSize: 10,
                letterSpacing: 1, textTransform: 'uppercase',
                padding: '6px 14px',
                border: '1px solid var(--cc-panel-divider)',
                color: 'var(--cc-text-muted)',
              }}
            >
              Keep watching
            </button>
          </div>
          {leaderboard && leaderboard.length > 0 && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 8 }}>
                Gen {speedRun.targetGeneration} leaderboard
              </div>
              {leaderboard.map((entry, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12, color: i === 0 ? 'var(--cc-mint)' : 'var(--cc-text-default)' }}>
                  <span style={{ fontFamily: 'var(--cc-font-mono)', minWidth: 16 }}>{i + 1}.</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.displayName}</span>
                  <span style={{ fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-mint)', opacity: i === 0 ? 1 : 0.7 }}>{formatTime(entry.seconds)}</span>
                </div>
              ))}
            </div>
          )}
          {submitting && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--cc-text-muted)', fontFamily: 'var(--cc-font-mono)', letterSpacing: 0.5 }}>
              Submitting to leaderboard…
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 40,
      background: 'rgba(0,0,0,0.7)',
      border: `1px solid ${isLow ? '#ff6b6b' : 'var(--cc-panel-divider)'}`,
      borderRadius: 6, padding: '7px 14px',
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: 'var(--cc-font-mono)', fontSize: 11,
      pointerEvents: 'auto',
    }}>
      <span style={{ color: isLow ? '#ff6b6b' : 'var(--cc-text-muted)', letterSpacing: 1.2 }}>
        {formatTime(timeRemaining)}
      </span>
      <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{
          width: `${progress * 100}%`, height: '100%',
          background: 'var(--cc-mint)', borderRadius: 2,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ color: 'var(--cc-text-muted)', letterSpacing: 1 }}>
        gen {deepestGeneration}/{speedRun.targetGeneration}
      </span>
      <button
        type="button"
        onClick={cancelSpeedRun}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--cc-text-muted)', fontSize: 11, padding: 0,
          lineHeight: 1,
        }}
        title="Cancel speed run"
      >
        ×
      </button>
    </div>
  )
}

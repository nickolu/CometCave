'use client'
import { useMicroLand } from '@/app/micro-land/store'

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

'use client'
import { useMicroLand } from '@/app/micro-land/store'

export function ReplayBar() {
  const replaySnapshots = useMicroLand(s => s.replaySnapshots)
  const replayIndex = useMicroLand(s => s.replayIndex)
  const setReplayIndex = useMicroLand(s => s.setReplayIndex)
  const exitReplay = useMicroLand(s => s.exitReplay)

  if (!replaySnapshots || replaySnapshots.length === 0) return null

  const current = replaySnapshots[replayIndex]
  const totalElapsed = replaySnapshots[replaySnapshots.length - 1].elapsed

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    return `${m}m ${Math.floor(s % 60)}s`
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(10,10,18,0.92)',
        borderTop: '1px solid var(--cc-panel-divider)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: 'var(--cc-mint)',
          whiteSpace: 'nowrap',
        }}
      >
        History
      </span>

      {/* Scrub bar */}
      <div style={{ flex: 1, position: 'relative', height: 32, cursor: 'pointer' }}>
        {/* Background track */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--cc-panel-divider)',
            transform: 'translateY(-50%)',
          }}
        />
        {/* Tick marks at each snapshot */}
        {replaySnapshots.map((snap, i) => {
          const pct = totalElapsed > 0 ? (snap.elapsed / totalElapsed) * 100 : 0
          const isActive = i === replayIndex
          return (
            <button
              key={i}
              type="button"
              onClick={() => setReplayIndex(i)}
              style={{
                position: 'absolute',
                top: '50%',
                left: `${pct}%`,
                transform: 'translate(-50%, -50%)',
                width: isActive ? 10 : 6,
                height: isActive ? 10 : 6,
                borderRadius: '50%',
                background: isActive ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
              title={formatTime(snap.elapsed)}
            />
          )
        })}
      </div>

      {/* Current time */}
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 10,
          color: 'var(--cc-text-muted)',
          whiteSpace: 'nowrap',
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {current ? formatTime(current.elapsed) : '—'}
      </span>

      {/* Prev / Next */}
      <button
        type="button"
        className="cc-btn"
        onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}
        disabled={replayIndex <= 0}
        style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 11, padding: '3px 8px', border: '1px solid var(--cc-mint-line)', color: 'var(--cc-text-muted)' }}
      >
        ‹
      </button>
      <button
        type="button"
        className="cc-btn"
        onClick={() => setReplayIndex(Math.min(replaySnapshots.length - 1, replayIndex + 1))}
        disabled={replayIndex >= replaySnapshots.length - 1}
        style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 11, padding: '3px 8px', border: '1px solid var(--cc-mint-line)', color: 'var(--cc-text-muted)' }}
      >
        ›
      </button>

      {/* Exit */}
      <button
        type="button"
        className="cc-btn"
        onClick={exitReplay}
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 9,
          letterSpacing: 1,
          textTransform: 'uppercase',
          padding: '4px 10px',
          border: '1px solid var(--cc-pink-border)',
          color: 'var(--cc-pink)',
          whiteSpace: 'nowrap',
        }}
      >
        Exit
      </button>
    </div>
  )
}

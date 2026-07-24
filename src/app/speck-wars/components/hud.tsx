'use client'
import { useSpeckWarsStore } from '../store'
import { PLAYER_COLOR, AI_COLOR } from '../domain/constants'

function colorHex(n: number) {
  return `#${n.toString(16).padStart(6, '0')}`
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function HUD() {
  const hud = useSpeckWarsStore(s => s.hud)
  const phase = useSpeckWarsStore(s => s.phase)
  const togglePause = useSpeckWarsStore(s => s.togglePause)
  const elapsedMs = useSpeckWarsStore(s => s.elapsedMs)
  const speed = useSpeckWarsStore(s => s.speed)
  const cycleSpeed = useSpeckWarsStore(s => s.cycleSpeed)

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      fontFamily: 'monospace', fontSize: 13, color: '#fff',
    }}>
      {/* Timer + Pause button — top bar */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 15, letterSpacing: 2, opacity: 0.9 }}>
          {formatTime(elapsedMs)}
        </span>
        <button
          onClick={togglePause}
          style={{
            pointerEvents: 'auto',
            padding: '4px 14px',
            fontSize: 12,
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 4,
            color: '#fff',
            letterSpacing: 1,
          }}
        >
          {phase === 'paused' ? 'RESUME' : 'PAUSE'}
        </button>
        <button
          onClick={cycleSpeed}
          style={{
            pointerEvents: 'auto',
            padding: '4px 14px',
            fontSize: 12,
            cursor: 'pointer',
            background: speed > 1 ? 'rgba(74,247,196,0.15)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${speed > 1 ? '#4af7c4' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: 4,
            color: speed > 1 ? '#4af7c4' : '#fff',
            letterSpacing: 1,
          }}
        >
          {speed}×
        </button>
      </div>

      {/* Outpost ownership indicator dots */}
      {hud && (() => {
        const OUTPOST_IDS = ['outpost-top', 'outpost-left', 'outpost-right'] as const
        const dots = OUTPOST_IDS.map(id => {
          if (hud.players.player?.buildingHp[id] !== undefined) return '#4af7c4'
          if (hud.players.ai?.buildingHp[id] !== undefined) return '#ff4f7b'
          return '#888888'
        })
        return (
          <div style={{
            position: 'absolute', top: 48, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 10, letterSpacing: 1, opacity: 0.5, marginRight: 4 }}>OUTPOSTS</span>
            {dots.map((color, i) => (
              <div key={i} style={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: color,
                boxShadow: color !== '#888888' ? `0 0 6px ${color}` : 'none',
              }} />
            ))}
          </div>
        )
      })()}

      {/* Paused overlay */}
      {phase === 'paused' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 36, fontWeight: 'bold', letterSpacing: 4, opacity: 0.9 }}>
            PAUSED
          </span>
        </div>
      )}

      {/* Player stats — bottom left */}
      {hud && (
        <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
          {Object.entries(hud.players)
            .filter(([pid]) => pid !== 'neutral')
            .map(([pid, data]) => {
              const color = pid === 'player' ? colorHex(PLAYER_COLOR) : colorHex(AI_COLOR)
              const label = pid === 'player' ? 'YOU' : 'AI'
              const totalHp = Object.values(data.buildingHp).reduce((a, b) => a + b, 0)
              return (
                <div key={pid} style={{ marginBottom: 6, color }}>
                  <strong>{label}</strong> — specks: {data.speckCount} | bases: {data.buildingCount} | HP: {totalHp}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

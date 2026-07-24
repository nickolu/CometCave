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
  const notification = useSpeckWarsStore(s => s.notification)
  const kills = useSpeckWarsStore(s => s.kills)
  const losses = useSpeckWarsStore(s => s.losses)
  const spawnMode = useSpeckWarsStore(s => s.spawnMode)
  const cycleSpawnMode = useSpeckWarsStore(s => s.cycleSpawnMode)

  const BASE_MAX_HP = 100
  const playerBaseHp = hud?.players.player?.buildingHp['building-player-base']
  const hpFrac = playerBaseHp !== undefined ? playerBaseHp / BASE_MAX_HP : 1
  const isDanger = phase === 'playing' && hpFrac < 0.3
  const isCritical = phase === 'playing' && hpFrac < 0.15

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      fontFamily: 'monospace', fontSize: 13, color: '#fff',
    }}>
      {isDanger && (
        <>
          <style>{`
            @keyframes danger-pulse {
              from { opacity: ${isCritical ? 0.4 : 0.15}; }
              to   { opacity: ${isCritical ? 0.7 : 0.35}; }
            }
          `}</style>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(220,30,30,1) 100%)',
            animation: `danger-pulse ${isCritical ? '0.5s' : '1s'} ease-in-out infinite alternate`,
            pointerEvents: 'none',
          }} />
        </>
      )}
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
        <button
          onClick={cycleSpawnMode}
          title="H — toggle spawn mode"
          style={{
            pointerEvents: 'auto',
            padding: '4px 14px',
            fontSize: 12,
            cursor: 'pointer',
            background: spawnMode === 'heavy' ? 'rgba(255,160,50,0.15)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${spawnMode === 'heavy' ? '#ffa032' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: 4,
            color: spawnMode === 'heavy' ? '#ffa032' : '#fff',
            letterSpacing: 1,
          }}
        >
          {spawnMode === 'heavy' ? '⬡ HEAVY' : '· BASIC'}
        </button>
      </div>

      {/* Outpost ownership indicator dots */}
      {hud && (() => {
        const OUTPOST_IDS = ['outpost-top', 'outpost-left', 'outpost-right'] as const
        const attacked = new Set(hud.attackedBuildingIds ?? [])
        const dots = OUTPOST_IDS.map(id => {
          const isPlayerOwned = hud.players.player?.buildingHp[id] !== undefined
          const isAiOwned = hud.players.ai?.buildingHp[id] !== undefined
          const isUnderAttack = attacked.has(id)
          const color = isPlayerOwned ? '#4af7c4' : isAiOwned ? '#ff4f7b' : '#888888'
          return { color, isUnderAttack, isPlayerOwned }
        })
        return (
          <>
            {dots.some(d => d.isUnderAttack && d.isPlayerOwned) && (
              <style>{`
                @keyframes outpost-alert {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.3; transform: scale(1.5); }
                }
              `}</style>
            )}
            <div style={{
              position: 'absolute', top: 48, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 10, letterSpacing: 1, opacity: 0.5, marginRight: 4 }}>OUTPOSTS</span>
              {dots.map(({ color, isUnderAttack, isPlayerOwned }, i) => (
                <div key={i} style={{
                  width: 10, height: 10,
                  borderRadius: '50%',
                  background: isUnderAttack && isPlayerOwned ? '#ff6b35' : color,
                  boxShadow: color !== '#888888' ? `0 0 6px ${isUnderAttack && isPlayerOwned ? '#ff6b35' : color}` : 'none',
                  animation: isUnderAttack && isPlayerOwned ? 'outpost-alert 0.6s ease-in-out infinite' : 'none',
                }} />
              ))}
            </div>
          </>
        )
      })()}

      {/* Triple outpost bonus indicator */}
      {hud?.tripleOutpostOwner === 'player' && phase === 'playing' && (
        <div style={{
          position: 'absolute', top: 100, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
            color: '#ffd700', textShadow: '0 0 8px #ffd700',
          }}>
            ⬡⬡⬡ TRIPLE CONTROL — SPAWN ×2
          </span>
        </div>
      )}

      {/* Outpost capture/loss notification */}
      {notification && (
        <div style={{
          position: 'absolute', top: 76, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <span style={{
            color: notification.color,
            fontSize: 13,
            fontWeight: 'bold',
            letterSpacing: 2,
            textShadow: `0 0 12px ${notification.color}`,
          }}>
            {notification.message}
          </span>
        </div>
      )}

      {/* Battle status indicator */}
      {hud && phase === 'playing' && (() => {
        const playerSpecks = hud.players.player?.speckCount ?? 0
        const aiSpecks = hud.players.ai?.speckCount ?? 0
        const total = playerSpecks + aiSpecks
        if (total < 20) return null  // too few specks — don't show yet
        const ratio = playerSpecks / total
        const status =
          ratio > 0.65 ? { label: 'DOMINATING', color: '#4af7c4' }
          : ratio > 0.55 ? { label: 'WINNING', color: '#88ff44' }
          : ratio < 0.35 ? { label: 'CRITICAL', color: '#ff4f7b' }
          : ratio < 0.45 ? { label: 'LOSING', color: '#ffaa44' }
          : null
        if (!status) return null
        return (
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 11,
              letterSpacing: 2,
              color: status.color,
              opacity: 0.6,
              textTransform: 'uppercase',
            }}>
              {status.label}
            </span>
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
                  {pid === 'player' && (
                    <span style={{ opacity: 0.7 }}> | ↑{kills} ↓{losses}</span>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

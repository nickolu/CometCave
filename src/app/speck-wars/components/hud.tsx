'use client'
import { useState, useEffect } from 'react'
import { useSpeckWarsStore } from '../store'
import { PLAYER_COLOR, AI_COLOR } from '../domain/constants'
import { getBestTime } from '../lib/personal-best'

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
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Slash' && e.shiftKey) { e.preventDefault(); setShowHelp(h => !h) }
      if (e.code === 'Escape') setShowHelp(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  const difficulty = useSpeckWarsStore(s => s.difficulty)
  const surrender = useSpeckWarsStore(s => s.surrender)

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
      {/* Difficulty badge — top right */}
      {(() => {
        const diffColors: Record<string, string> = { easy: '#44ff88', medium: '#ffcc44', hard: '#ff4f7b', 'very-hard': '#cc00ff' }
        const color = diffColors[difficulty] ?? '#ffffff'
        return (
          <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 10, letterSpacing: 1 }}>
            <span style={{ color, opacity: 0.5, border: `1px solid ${color}`, borderRadius: 3, padding: '2px 6px' }}>
              {difficulty.toUpperCase()}
            </span>
          </div>
        )
      })()}

      {/* Timer + Pause button — top bar */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 15, letterSpacing: 2, opacity: 0.9 }}>
          {formatTime(elapsedMs)}
          {(() => {
            const pb = getBestTime(difficulty)
            if (!pb) return null
            const ahead = pb - elapsedMs
            return (
              <span style={{
                fontSize: 10, letterSpacing: 1, marginLeft: 8,
                color: ahead > 0 ? '#ffd700' : '#ff4f7b',
                opacity: 0.7,
              }}>
                {ahead > 0 ? `−${formatTime(ahead)}` : `+${formatTime(-ahead)}`}
              </span>
            )
          })()}
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
        <button
          onClick={() => setShowHelp(h => !h)}
          title="? — show controls"
          style={{
            pointerEvents: 'auto',
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
            background: showHelp ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${showHelp ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: 4,
            color: '#fff',
          }}
        >
          ?
        </button>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto', cursor: 'default',
          }}
        >
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '6px 32px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 13,
            letterSpacing: 0.5,
            background: 'rgba(0,0,0,0.5)',
            padding: '24px 32px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <span>🖱 Click — rally specks</span><span>Space — pause</span>
            <span>Scroll — zoom</span><span>R — clear rally</span>
            <span>Drag — pan camera</span><span>H — heavy/basic mode</span>
            <span>A — advance to outpost</span><span>C — center on base</span>
            <span>B — rush enemy base</span><span>D — defend base</span>
            <span>Minimap — click to rally</span><span>? — this help</span>
          </div>
        </div>
      )}

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
        const playerCount = dots.filter(d => d.isPlayerOwned).length
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
              <span style={{ fontSize: 10, letterSpacing: 1, opacity: 0.5, marginRight: 4 }}>
                OUTPOSTS {playerCount}/{OUTPOST_IDS.length}
              </span>
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

      {/* Triple outpost bonus indicator + domination countdown */}
      {hud?.tripleOutpostOwner !== null && hud?.tripleOutpostOwner !== undefined && phase === 'playing' && (() => {
        const isPlayer = hud.tripleOutpostOwner === 'player'
        const color = isPlayer ? '#ffd700' : '#ff4f7b'
        const secLeft = hud.dominationProgress != null
          ? Math.ceil((1 - hud.dominationProgress) * 60)
          : null
        return (
          <div style={{
            position: 'absolute', top: 100, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
              color, textShadow: `0 0 8px ${color}`,
            }}>
              {isPlayer ? '⬡⬡⬡ TRIPLE CONTROL — SPAWN ×2' : '⬡⬡⬡ ENEMY TRIPLE CONTROL'}
            </span>
            {secLeft !== null && (
              <span style={{ fontSize: 10, letterSpacing: 1, color, opacity: 0.7 }}>
                {isPlayer ? `DOMINATION in ${secLeft}s` : `ENEMY DOMINATES in ${secLeft}s`}
              </span>
            )}
          </div>
        )
      })()}

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

      {/* Battle status indicator + morale badge */}
      {hud && phase === 'playing' && (() => {
        const playerSpecks = hud.players.player?.speckCount ?? 0
        const aiSpecks = hud.players.ai?.speckCount ?? 0
        const total = playerSpecks + aiSpecks
        const moraleActive = aiSpecks > 0 && playerSpecks >= 2 * aiSpecks
        const enemyMoraleActive = playerSpecks > 0 && aiSpecks >= 2 * playerSpecks

        if (total < 20 && !moraleActive && !enemyMoraleActive) return null

        const ratio = playerSpecks / (total || 1)
        const status = total >= 20 ? (
          ratio > 0.65 ? { label: 'DOMINATING', color: '#4af7c4' }
          : ratio > 0.55 ? { label: 'WINNING', color: '#88ff44' }
          : ratio < 0.35 ? { label: 'CRITICAL', color: '#ff4f7b' }
          : ratio < 0.45 ? { label: 'LOSING', color: '#ffaa44' }
          : null
        ) : null

        return (
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
          }}>
            {status && (
              <span style={{
                fontSize: 11,
                letterSpacing: 2,
                color: status.color,
                opacity: 0.6,
                textTransform: 'uppercase',
              }}>
                {status.label}
              </span>
            )}
            {moraleActive && (
              <span style={{
                fontSize: 10, letterSpacing: 1,
                color: '#ffd700', opacity: 0.75,
                border: '1px solid rgba(255,215,0,0.4)', borderRadius: 3,
                padding: '2px 6px',
              }}>
                ⚡ MORALE +20%
              </span>
            )}
            {enemyMoraleActive && (
              <span style={{
                fontSize: 10, letterSpacing: 1,
                color: '#ff6b35', opacity: 0.75,
                border: '1px solid rgba(255,107,53,0.4)', borderRadius: 3,
                padding: '2px 6px',
              }}>
                ⚡ ENEMY MORALE
              </span>
            )}
            {isCritical && !moraleActive && (
              <span style={{
                fontSize: 10, letterSpacing: 1,
                color: '#ff4f7b', opacity: 0.85,
                border: '1px solid rgba(255,79,123,0.5)', borderRadius: 3,
                padding: '2px 6px',
                fontWeight: 'bold',
              }}>
                ⚡ RAGE +40%
              </span>
            )}
          </div>
        )
      })()}

      {/* Paused overlay */}
      {phase === 'paused' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
        }}>
          <span style={{ fontSize: 36, fontWeight: 'bold', letterSpacing: 4, opacity: 0.9 }}>
            PAUSED
          </span>
          <button
            onClick={surrender}
            style={{
              pointerEvents: 'auto',
              padding: '8px 24px',
              fontSize: 12,
              cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(255,100,100,0.4)',
              borderRadius: 4,
              color: 'rgba(255,100,100,0.6)',
              letterSpacing: 1,
            }}
          >
            Give Up
          </button>
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

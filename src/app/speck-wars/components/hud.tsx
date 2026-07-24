'use client'
import { useState, useEffect } from 'react'
import { useSpeckWarsStore } from '../store'
import { PLAYER_COLOR, AI_COLOR } from '../domain/constants'
import { getBestTime, getWinStreak } from '../lib/personal-best'

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
  const [winStreak, setWinStreak] = useState(0)

  useEffect(() => {
    setWinStreak(getWinStreak())
  }, [])

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
  const gameActions = useSpeckWarsStore(s => s.gameActions)

  const BASE_MAX_HP = 100
  const playerBaseHp = hud?.players.player?.buildingHp['building-player-base']
  const hpFrac = playerBaseHp !== undefined ? playerBaseHp / BASE_MAX_HP : 1
  const isDanger = phase === 'playing' && hpFrac < 0.3
  const isCritical = phase === 'playing' && hpFrac < 0.15

  const aiBaseHp = hud?.players.ai?.buildingHp['building-ai-base']
  const aiHpFrac = aiBaseHp !== undefined ? aiBaseHp / BASE_MAX_HP : 1
  const isWinning = phase === 'playing' && aiHpFrac < 0.2 && aiHpFrac > 0  // enemy near death

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
      {isWinning && (
        <>
          <style>{`
            @keyframes win-pulse {
              from { opacity: 0.1; }
              to   { opacity: 0.28; }
            }
          `}</style>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(20,220,120,1) 100%)',
            animation: 'win-pulse 1.2s ease-in-out infinite alternate',
            pointerEvents: 'none',
          }} />
        </>
      )}
      {/* Difficulty badge — top right */}
      {(() => {
        const diffColors: Record<string, string> = { easy: '#44ff88', medium: '#ffcc44', hard: '#ff4f7b', 'very-hard': '#cc00ff' }
        const color = diffColors[difficulty] ?? '#ffffff'
        return (
          <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 10, letterSpacing: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ color, opacity: 0.5, border: `1px solid ${color}`, borderRadius: 3, padding: '2px 6px' }}>
              {difficulty.toUpperCase()}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 8, letterSpacing: 0.5 }}>
              DAILY MAP · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </span>
          </div>
        )
      })()}

      {/* Timer + Pause button — top bar */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 15, letterSpacing: 2, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
          {formatTime(elapsedMs)}
          {(() => {
            const pb = getBestTime(difficulty)
            if (!pb) return null
            const ahead = pb - elapsedMs
            return (
              <span style={{
                fontSize: 10, letterSpacing: 1,
                color: ahead > 0 ? '#ffd700' : '#ff4f7b',
                opacity: 0.7,
              }}>
                {ahead > 0 ? `−${formatTime(ahead)}` : `+${formatTime(-ahead)}`}
              </span>
            )
          })()}
          {winStreak >= 2 && (
            <span style={{
              fontSize: 9, letterSpacing: 1,
              color: '#ffd700', opacity: 0.65,
              border: '1px solid rgba(255,215,0,0.35)',
              borderRadius: 3, padding: '1px 5px',
            }}>
              🔥 ×{winStreak}
            </span>
          )}
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
            <span>Scroll — zoom</span><span>R / Right-click — clear rally</span>
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
        const captureInfo = hud.captureInfo ?? {}
        const OUTPOST_MAX_HP = 50
        const dots = OUTPOST_IDS.map(id => {
          const isPlayerOwned = hud.players.player?.buildingHp[id] !== undefined
          const isAiOwned = hud.players.ai?.buildingHp[id] !== undefined
          const isUnderAttack = attacked.has(id)
          const color = isPlayerOwned ? '#4af7c4' : isAiOwned ? '#ff4f7b' : '#888888'
          const cap = captureInfo[id] ?? null
          const hp = isPlayerOwned ? hud.players.player?.buildingHp[id]
            : isAiOwned ? hud.players.ai?.buildingHp[id]
            : undefined
          const hpFrac = hp !== undefined ? hp / OUTPOST_MAX_HP : undefined
          return { color, isUnderAttack, isPlayerOwned, cap, hpFrac }
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
              {dots.map(({ color, isUnderAttack, isPlayerOwned, cap, hpFrac }, i) => {
                const capColor = cap?.side === 'player' ? '#4af7c4' : '#ff4f7b'
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: isUnderAttack && isPlayerOwned ? '#ff6b35' : color,
                      boxShadow: color !== '#888888' ? `0 0 6px ${isUnderAttack && isPlayerOwned ? '#ff6b35' : color}` : 'none',
                      animation: isUnderAttack && isPlayerOwned ? 'outpost-alert 0.6s ease-in-out infinite' : 'none',
                    }} />
                    {cap && cap.progress > 0 ? (
                      <div style={{ width: 14, height: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }}>
                        <div style={{
                          width: `${Math.round(cap.progress * 100)}%`,
                          height: '100%', background: capColor, borderRadius: 1,
                        }} />
                      </div>
                    ) : hpFrac !== undefined && hpFrac < 0.99 ? (
                      <div style={{ width: 14, height: 2, background: 'rgba(255,255,255,0.12)', borderRadius: 1 }}>
                        <div style={{
                          width: `${Math.round(hpFrac * 100)}%`,
                          height: '100%',
                          background: hpFrac > 0.5 ? color : hpFrac > 0.2 ? '#ffaa44' : '#ff2200',
                          borderRadius: 1,
                        }} />
                      </div>
                    ) : null}
                  </div>
                )
              })}
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
            {hud.dominationProgress !== null && (
              <>
                <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round(hud.dominationProgress * 100)}%`,
                    background: color,
                    borderRadius: 2,
                    boxShadow: `0 0 6px ${color}`,
                    transition: 'width 0.3s',
                  }} />
                </div>
                {secLeft !== null && (
                  <span style={{ fontSize: 10, letterSpacing: 1, color, opacity: 0.7 }}>
                    {isPlayer ? `DOMINATION in ${secLeft}s` : `ENEMY DOMINATES in ${secLeft}s`}
                  </span>
                )}
              </>
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
          <style>{`
            @keyframes notif-in {
              from { opacity: 0; transform: translateY(-8px) scale(0.92); }
              to   { opacity: 1; transform: translateY(0)  scale(1); }
            }
          `}</style>
          <span
            key={notification.message + notification.color}
            style={{
              color: notification.color,
              fontSize: 13,
              fontWeight: 'bold',
              letterSpacing: 2,
              textShadow: `0 0 12px ${notification.color}`,
              animation: 'notif-in 0.18s ease-out',
            }}
          >
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
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <span style={{ fontSize: 36, fontWeight: 'bold', letterSpacing: 4, opacity: 0.9 }}>
            PAUSED
          </span>
          {hud && (() => {
            const playerSpecks = hud.players.player?.speckCount ?? 0
            const aiSpecks = hud.players.ai?.speckCount ?? 0
            const playerBaseHpVal = hud.players.player?.buildingHp['building-player-base'] ?? 0
            const aiBaseHpVal = hud.players.ai?.buildingHp['building-ai-base'] ?? 0
            const playerOutpostCount = hud.players.player?.buildingCount
              ? hud.players.player.buildingCount - 1  // subtract base
              : 0
            const playerTypes = hud.players.player?.speckTypes ?? {}
            const aiTypes = hud.players.ai?.speckTypes ?? {}
            const fmtTypes = (t: Record<string, number>) => {
              const basic = t['basic'] ?? 0
              const heavy = t['heavy'] ?? 0
              if (basic === 0 && heavy === 0) return '—'
              if (heavy === 0) return `${basic}× basic`
              if (basic === 0) return `${heavy}× heavy`
              return `${basic}× basic, ${heavy}× heavy`
            }
            // Production rate estimate
            const BASE_MS = spawnMode === 'heavy' ? 1800 : 800
            const OUTPOST_MS = 1800
            const playerTriple = hud.tripleOutpostOwner === 'player'
            const aiOutpostCount = Math.max(0, (hud.players.ai?.buildingCount ?? 0) - 1)
            const aiTriple = hud.tripleOutpostOwner === 'ai'
            const playerProd = ((1000/BASE_MS) + playerOutpostCount * (1000/OUTPOST_MS)) * (playerTriple ? 2 : 1)
            const aiProd = ((1000/800) + aiOutpostCount * (1000/OUTPOST_MS)) * (aiTriple ? 2 : 1)
            return (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px',
                fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.55)',
                background: 'rgba(0,0,0,0.3)', padding: '16px 28px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ color: colorHex(PLAYER_COLOR), opacity: 0.8 }}>YOUR ARMY</span>
                <span style={{ color: colorHex(AI_COLOR), opacity: 0.8 }}>ENEMY ARMY</span>
                <span>{playerSpecks} specks</span>
                <span>{aiSpecks} specks</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{fmtTypes(playerTypes)}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{fmtTypes(aiTypes)}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>~{playerProd.toFixed(1)}/s prod</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>~{aiProd.toFixed(1)}/s prod</span>
                <span>Base: {Math.round(playerBaseHpVal)}HP</span>
                <span>Base: {Math.round(aiBaseHpVal)}HP</span>
                <span>Outposts: {playerOutpostCount}</span>
                <span style={{ color: colorHex(PLAYER_COLOR), opacity: 0.7 }}>↑{kills} ↓{losses}</span>
                <span style={{ gridColumn: '1/-1', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
                  {formatTime(elapsedMs)} elapsed
                </span>
              </div>
            )
          })()}
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

      {/* Mobile action buttons — bottom right */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          display: 'flex', flexDirection: 'row', gap: 6,
          pointerEvents: 'auto',
        }}>
          <button
            onClick={() => gameActions.defend?.()}
            title="[D] Defend — rally to your base"
            style={{
              padding: '6px 10px',
              fontSize: 11,
              cursor: 'pointer',
              background: 'rgba(74,247,196,0.08)',
              border: '1px solid rgba(74,247,196,0.4)',
              borderRadius: 20,
              color: '#4af7c4',
              letterSpacing: 1,
              minHeight: 44,
              fontFamily: 'monospace',
            }}
          >
            🛡 D
          </button>
          <button
            onClick={() => gameActions.advance?.()}
            title="[A] Advance — rally to nearest outpost"
            style={{
              padding: '6px 10px',
              fontSize: 11,
              cursor: 'pointer',
              background: 'rgba(255,215,0,0.08)',
              border: '1px solid rgba(255,215,0,0.4)',
              borderRadius: 20,
              color: '#ffd700',
              letterSpacing: 1,
              minHeight: 44,
              fontFamily: 'monospace',
            }}
          >
            → A
          </button>
          <button
            onClick={() => gameActions.rush?.()}
            title="[B] Rush — attack enemy base"
            style={{
              padding: '6px 10px',
              fontSize: 11,
              cursor: 'pointer',
              background: 'rgba(255,79,123,0.08)',
              border: '1px solid rgba(255,79,123,0.4)',
              borderRadius: 20,
              color: '#ff4f7b',
              letterSpacing: 1,
              minHeight: 44,
              fontFamily: 'monospace',
            }}
          >
            ⚡ B
          </button>
          <button
            onClick={() => gameActions.clearRally?.()}
            title="[R] Clear rally"
            style={{
              padding: '6px 10px',
              fontSize: 11,
              cursor: 'pointer',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 20,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 1,
              minHeight: 44,
              fontFamily: 'monospace',
            }}
          >
            ✕ R
          </button>
        </div>
      )}

      {/* Player stats + force bar — bottom left */}
      {hud && (() => {
        const playerSpecks = hud.players.player?.speckCount ?? 0
        const aiSpecks = hud.players.ai?.speckCount ?? 0
        const total = playerSpecks + aiSpecks
        const playerFrac = total > 0 ? playerSpecks / total : 0.5
        const playerBaseHpVal = hud.players.player?.buildingHp['building-player-base'] ?? 0
        const aiBaseHpVal = hud.players.ai?.buildingHp['building-ai-base'] ?? 0
        const aiBaseHpFrac = aiBaseHpVal / 100
        const aiBaseColor = aiBaseHpFrac > 0.5 ? '#ff4f7b' : aiBaseHpFrac > 0.2 ? '#ffaa44' : '#ff2200'
        return (
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Force ratio bar */}
            {total >= 4 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, letterSpacing: 1, color: colorHex(PLAYER_COLOR), opacity: 0.7, minWidth: 20, textAlign: 'right' }}>
                  {playerSpecks}
                </span>
                <div style={{ width: 100, height: 5, background: 'rgba(255,79,123,0.4)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${Math.round(playerFrac * 100)}%`,
                    background: colorHex(PLAYER_COLOR),
                    borderRadius: 3,
                    transition: 'width 0.2s',
                  }} />
                </div>
                <span style={{ fontSize: 9, letterSpacing: 1, color: colorHex(AI_COLOR), opacity: 0.7, minWidth: 20 }}>
                  {aiSpecks}
                </span>
              </div>
            )}
            {/* Army composition: heavy % indicator */}
            {(() => {
              const playerTypes = hud.players.player?.speckTypes ?? {}
              const aiTypes = hud.players.ai?.speckTypes ?? {}
              const playerHeavy = playerTypes['heavy'] ?? 0
              const playerBasic = playerTypes['basic'] ?? 0
              const aiHeavy = aiTypes['heavy'] ?? 0
              const aiBasic = aiTypes['basic'] ?? 0
              const playerTotal = playerHeavy + playerBasic
              const aiTotal = aiHeavy + aiBasic
              if (playerTotal < 3 && aiTotal < 3) return null
              const playerHeavyFrac = playerTotal > 0 ? playerHeavy / playerTotal : 0
              const aiHeavyFrac = aiTotal > 0 ? aiHeavy / aiTotal : 0
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div title={`You: ${playerHeavy}⬡ heavy, ${playerBasic}· basic`} style={{ width: 20, textAlign: 'right' }}>
                    {playerHeavy > 0 && <span style={{ fontSize: 8, color: '#ffa032', opacity: 0.7 }}>⬡{playerHeavy}</span>}
                  </div>
                  <div style={{ width: 100, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${Math.round(playerHeavyFrac * 100)}%`,
                      background: '#ffa032', opacity: 0.5, borderRadius: 2,
                    }} />
                  </div>
                  <div title={`Enemy: ${aiHeavy}⬡ heavy, ${aiBasic}· basic`} style={{ width: 20 }}>
                    {aiHeavy > 0 && <span style={{ fontSize: 8, color: '#ff6b6b', opacity: 0.7 }}>⬡{aiHeavy}</span>}
                  </div>
                </div>
              )
            })()}
            {/* Kill/loss + enemy base HP */}
            <div style={{ display: 'flex', gap: 10, fontSize: 10, letterSpacing: 0.5 }}>
              <span style={{ color: colorHex(PLAYER_COLOR), opacity: 0.7 }}>↑{kills} ↓{losses}</span>
              {aiBaseHpVal > 0 && (
                <span style={{ color: aiBaseColor, opacity: 0.8 }}>
                  ENEMY BASE {Math.round(aiBaseHpFrac * 100)}%
                </span>
              )}
              {playerBaseHpVal > 0 && (
                <span style={{ color: hpFrac < 0.3 ? '#ff4f7b' : 'rgba(255,255,255,0.4)', opacity: 0.8 }}>
                  BASE {Math.round(playerBaseHpVal)}HP
                </span>
              )}
            </div>
          </div>
        )
      })()}

    </div>
  )
}

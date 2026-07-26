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
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0

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
  const countdown = useSpeckWarsStore(s => s.countdown)
  const kills = useSpeckWarsStore(s => s.kills)
  const losses = useSpeckWarsStore(s => s.losses)
  const killFeed = useSpeckWarsStore(s => s.killFeed)
  const spawnMode = useSpeckWarsStore(s => s.spawnMode)
  const setSpawnMode = useSpeckWarsStore(s => s.setSpawnMode)
  const difficulty = useSpeckWarsStore(s => s.difficulty)
  const surrender = useSpeckWarsStore(s => s.surrender)
  const gameActions = useSpeckWarsStore(s => s.gameActions)
  const stance = useSpeckWarsStore(s => s.stance)

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
      touchAction: 'manipulation',
    }}>
      <style>{`
        @keyframes pulse-red {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
        @keyframes countdown-pop {
          from { transform: scale(1.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes minimap-capture-pulse {
          0% { opacity: 0.8; transform: scale(0.85); }
          100% { opacity: 0; transform: scale(1.6); }
        }
      `}</style>
      {hud?.baseUnderThreat && (
        <div style={{
          position: 'fixed',
          inset: 0,
          border: '4px solid rgba(255, 50, 50, 0.85)',
          borderRadius: 2,
          pointerEvents: 'none',
          zIndex: 100,
          animation: 'pulse-red 0.8s ease-in-out infinite alternate',
          boxShadow: 'inset 0 0 40px rgba(255, 0, 0, 0.25)',
        }} />
      )}
      {hud?.baseUnderThreat && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(200,0,0,0.9)', color: '#fff', fontWeight: 700,
          padding: '4px 14px', borderRadius: 6, fontSize: 13, letterSpacing: 1,
          zIndex: 110, pointerEvents: 'none',
          animation: 'pulse-red 0.6s ease-in-out infinite alternate',
        }}>⚠ BASE UNDER ATTACK</div>
      )}
      {(() => {
        const myCount = hud?.players?.player?.speckCount ?? 0
        const aiCount = hud?.players?.ai?.speckCount ?? 0
        const ratio = myCount > 0 ? aiCount / myCount : (aiCount > 0 ? 999 : 0)
        if (ratio < 2.5) return null
        return (
          <div style={{
            position: 'fixed', top: 44, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(200,100,0,0.9)', color: '#fff', fontWeight: 700,
            padding: '3px 12px', borderRadius: 6, fontSize: 12, letterSpacing: 1,
            zIndex: 109, pointerEvents: 'none',
          }}>OUTNUMBERED {Math.round(ratio)}:1</div>
        )
      })()}
      {hud?.enemyAdvanceDetected && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(200,80,0,0.88)', color: '#ffe0c0', fontWeight: 700,
          padding: '3px 12px', borderRadius: 6, fontSize: 12, letterSpacing: 1,
          zIndex: 108, pointerEvents: 'none',
        }}>ENEMY ADVANCING</div>
      )}
      {hud?.rallyCryActive && !hud?.baseUnderThreat && (
        <div style={{
          position: 'fixed', top: 108, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,136,0,0.88)', color: '#fff', fontWeight: 700,
          padding: '3px 12px', borderRadius: 6, fontSize: 11, letterSpacing: 1,
          zIndex: 107, pointerEvents: 'none',
          animation: 'pulse-red 0.9s ease-in-out infinite alternate',
        }}>★ RALLY CRY — 1.5× SPAWN</div>
      )}
      {hud && (hud.creepCampBoostMs ?? 0) > 0 && phase === 'playing' && (
        <div style={{
          position: 'fixed', top: hud.rallyCryActive ? 138 : 108, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,200,50,0.85)', color: '#000', fontWeight: 700,
          padding: '3px 12px', borderRadius: 6, fontSize: 11, letterSpacing: 1,
          zIndex: 106, pointerEvents: 'none',
        }}>🏕 CAMP BOOST +25% SPAWN — {Math.ceil((hud.creepCampBoostMs ?? 0) / 1000)}s</div>
      )}
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
      {/* Dual base HP bars — top edge, fighting-game style */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', height: 3, pointerEvents: 'none',
        }}>
          {/* Player bar: left edge, grows right */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${Math.round(hpFrac * 100)}%`,
              background: hpFrac > 0.5 ? '#4af7c4' : hpFrac > 0.25 ? '#ffcc44' : '#ff4f7b',
              transition: 'width 0.3s ease, background 0.5s ease',
            }} />
          </div>
          {/* 1px gap in center */}
          <div style={{ width: 2, background: 'rgba(0,0,0,0.8)' }} />
          {/* Enemy bar: right edge, grows left */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: `${Math.round(aiHpFrac * 100)}%`,
              background: aiHpFrac > 0.5 ? '#ff4f7b' : aiHpFrac > 0.25 ? '#ffcc44' : '#ff2200',
              transition: 'width 0.3s ease, background 0.5s ease',
            }} />
          </div>
        </div>
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
            {hud?.dailyModifier && hud.dailyModifier !== 'standard' && (
              <span style={{ color: '#ffd700', fontSize: 8, letterSpacing: 0.5, opacity: 0.7, textAlign: 'right' }}>
                {hud.dailyModifier === 'bulwark' ? '⚔ BULWARK' : hud.dailyModifier === 'blitz' ? '⚡ BLITZ' : '🏰 SIEGE'}
              </span>
            )}
          </div>
        )
      })()}

      {/* Wave countdown — only shows when wave is imminent or in progress */}
      {hud && (hud.waveCountdown !== null || hud.waveInProgress) && (() => {
        const countdown = hud.waveCountdown ?? 0
        const inProgress = hud.waveInProgress
        if (!inProgress && countdown > 30000) return null  // only show when < 30s
        const secs = Math.ceil(countdown / 1000)
        return (
          <>
            {inProgress && (
              <style>{`
                @keyframes danger-pulse {
                  from { opacity: 0.4; }
                  to   { opacity: 0.7; }
                }
              `}</style>
            )}
            <div style={{
              position: 'absolute', top: 240, right: 16,
              padding: '4px 10px',
              background: inProgress ? 'rgba(255,80,80,0.25)' : 'rgba(255,140,0,0.15)',
              border: `1px solid ${inProgress ? 'rgba(255,80,80,0.6)' : 'rgba(255,140,0,0.5)'}`,
              borderRadius: 4,
              fontSize: 10,
              letterSpacing: 1.5,
              color: inProgress ? '#ff5050' : '#ffa030',
              animation: inProgress ? 'danger-pulse 0.6s ease-in-out infinite alternate' : 'none',
            }}>
              {inProgress ? '⚠ WAVE INCOMING!' : `⚠ WAVE IN ${secs}s`}
            </div>
          </>
        )
      })()}

      {/* Mini-map — top right, below difficulty badge */}
      {hud && (() => {
        const MINIMAP_SIZE = 160
        const SCALE = MINIMAP_SIZE / 3000  // world→screen
        return (
          <div style={{
            position: 'absolute', top: 72, right: 16,
            width: MINIMAP_SIZE, height: MINIMAP_SIZE,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            overflow: 'hidden',
            cursor: 'crosshair',
          }}>
            <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE} style={{ display: 'block' }}
              onClick={(e) => {
                if (!gameActions?.rally) return
                const rect = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - rect.left
                const py = e.clientY - rect.top
                const worldX = (px / MINIMAP_SIZE) * 3000
                const worldY = (py / MINIMAP_SIZE) * 3000
                gameActions.rally(worldX, worldY)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                if (!gameActions?.panCamera) return
                const rect = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - rect.left
                const py = e.clientY - rect.top
                const worldX = (px / MINIMAP_SIZE) * 3000
                const worldY = (py / MINIMAP_SIZE) * 3000
                gameActions.panCamera(worldX, worldY)
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                if (!gameActions?.panCamera) return
                const touch = e.changedTouches[0]
                if (!touch) return
                const rect = e.currentTarget.getBoundingClientRect()
                const px = touch.clientX - rect.left
                const py = touch.clientY - rect.top
                const worldX = (px / MINIMAP_SIZE) * 3000
                const worldY = (py / MINIMAP_SIZE) * 3000
                gameActions.panCamera(worldX, worldY)
                navigator.vibrate?.(15)  // short pulse confirms minimap navigation
              }}
            >
              {/* Speck dots */}
              {hud.minimap.specks.map((s, i) => (
                <circle
                  key={i}
                  cx={s.x * SCALE}
                  cy={s.y * SCALE}
                  r={1}
                  fill={s.ownerId === 'player' ? colorHex(PLAYER_COLOR) : colorHex(AI_COLOR)}
                  opacity={0.55}
                />
              ))}
              {/* Buildings */}
              {hud.minimap.buildings.map(b => {
                const fill = b.ownerId === 'player' ? colorHex(PLAYER_COLOR)
                  : b.ownerId === 'ai' ? colorHex(AI_COLOR)
                  : '#888888'
                const r = b.typeId === 'base' ? 4 : 2.5
                const ci = b.typeId === 'outpost' ? (hud.captureInfo?.[b.id] ?? null) : null
                const bx = b.x * SCALE
                const by = b.y * SCALE
                return (
                  <g key={b.id}>
                    <circle
                      cx={bx}
                      cy={by}
                      r={r}
                      fill={fill}
                      opacity={0.9}
                    />
                    {ci && ci.progress > 0 && (() => {
                      const sideColor = ci.side === 'player' ? '#4af7c4' : '#ff5555'
                      return (
                        <>
                          {/* Static capture progress ring */}
                          <circle
                            cx={bx} cy={by}
                            r={4 + ci.progress * 3}
                            fill="none"
                            stroke={sideColor}
                            strokeWidth={1}
                            opacity={0.8 - ci.progress * 0.3}
                            style={{ pointerEvents: 'none' }}
                          />
                          {/* Pulsing outward ring — draws attention to active capture */}
                          <circle
                            cx={bx} cy={by}
                            r={4}
                            fill="none"
                            stroke={sideColor}
                            strokeWidth={1.5}
                            style={{
                              pointerEvents: 'none',
                              animation: `minimap-capture-pulse 1.1s ease-out infinite`,
                              transformOrigin: `${bx}px ${by}px`,
                            }}
                          />
                        </>
                      )
                    })()}
                  </g>
                )
              })}
              {/* Rally point crosshair */}
              {hud.minimap.rallyPoint && (() => {
                const rx = hud.minimap.rallyPoint.x * SCALE
                const ry = hud.minimap.rallyPoint.y * SCALE
                return (
                  <g>
                    <line x1={rx - 4} y1={ry} x2={rx + 4} y2={ry} stroke="#ffffff" strokeWidth={1} opacity={0.6} />
                    <line x1={rx} y1={ry - 4} x2={rx} y2={ry + 4} stroke="#ffffff" strokeWidth={1} opacity={0.6} />
                  </g>
                )
              })()}
              {/* AI rally point crosshair */}
              {hud.minimap.aiRallyPoint && (() => {
                const ax = hud.minimap.aiRallyPoint.x * SCALE
                const ay = hud.minimap.aiRallyPoint.y * SCALE
                return (
                  <g>
                    <line x1={ax - 5} y1={ay} x2={ax + 5} y2={ay} stroke="rgba(255,80,80,0.7)" strokeWidth={1.5} />
                    <line x1={ax} y1={ay - 5} x2={ax} y2={ay + 5} stroke="rgba(255,80,80,0.7)" strokeWidth={1.5} />
                  </g>
                )
              })()}
              {/* Camera viewport rect */}
              {hud.cameraViewport && (() => {
                const vp = hud.cameraViewport
                const vx = vp.x * SCALE
                const vy = vp.y * SCALE
                const vw = vp.w * SCALE
                const vh = vp.h * SCALE
                return (
                  <rect
                    x={vx} y={vy} width={vw} height={vh}
                    fill="none"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={1}
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })()}
            </svg>
          </div>
        )
      })()}

      {/* Kill feed — below minimap, top-right */}
      {phase === 'playing' && killFeed.length > 0 && (
        <div style={{
          position: 'absolute', top: 250, right: 16,
          display: 'flex', flexDirection: 'column', gap: 3,
          pointerEvents: 'none',
          width: 140,
        }}>
          {killFeed.map(entry => {
            const age = Date.now() - entry.ts
            const opacity = age > 3000 ? Math.max(0, 1 - (age - 3000) / 1500) : 1
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: isTouchDevice ? 11 : 9, letterSpacing: 0.5,
                opacity,
                transition: 'opacity 150ms',
              }}>
                <span style={{ fontSize: isTouchDevice ? 13 : 11 }}>{entry.icon}</span>
                <span style={{ color: entry.color }}>{entry.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Timer + Pause button — top bar */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
        flexWrap: 'wrap', padding: '0 8px',
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
            padding: '8px 14px',
            fontSize: 12,
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 4,
            color: '#fff',
            letterSpacing: 1,
            minHeight: 44, minWidth: 44,
          }}
        >
          {phase === 'paused' ? 'RESUME' : 'PAUSE'}
        </button>
        <button
          onClick={cycleSpeed}
          style={{
            pointerEvents: 'auto',
            padding: '8px 14px',
            fontSize: 12,
            cursor: 'pointer',
            background: speed > 1 ? 'rgba(74,247,196,0.15)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${speed > 1 ? '#4af7c4' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: 4,
            color: speed > 1 ? '#4af7c4' : '#fff',
            letterSpacing: 1,
            minHeight: 44, minWidth: 44,
          }}
        >
          {speed}×
        </button>
        {/* Spawn type selector — 3 direct buttons instead of cycle */}
        {(['basic', 'heavy', 'scout'] as const).map((type, idx) => {
          const active = spawnMode === type
          const color = type === 'heavy' ? '#ffa032' : type === 'scout' ? '#50c8ff' : '#ffffff'
          const subtitle = type === 'heavy' ? 'slow · siege' : type === 'scout' ? 'fast · outpost' : 'balanced'
          return (
            <button
              key={type}
              onClick={() => gameActions?.setSpawnType?.(type)}
              title={`[${idx + 1}] Spawn ${type} — ${subtitle}`}
              style={{
                pointerEvents: 'auto',
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                background: active ? `${color}22` : 'rgba(0,0,0,0.5)',
                border: `1px solid ${active ? color : 'rgba(255,255,255,0.2)'}`,
                borderRadius: idx === 0 ? '4px 0 0 4px' : idx === 2 ? '0 4px 4px 0' : '0',
                color: active ? color : 'rgba(255,255,255,0.4)',
                marginLeft: idx === 0 ? 0 : -1,
                lineHeight: 1.3,
                textAlign: 'center',
                minHeight: 44,
              }}
            >
              <div style={{ fontWeight: 700, letterSpacing: 0.5 }}>{idx + 1} {type.toUpperCase()}</div>
              <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 0.3 }}>{subtitle}</div>
            </button>
          )
        })}
        {/* Stance toggle — cycles through aggressive/defensive/hold */}
        {gameActions?.cycleStance && (() => {
          const stanceConfig: Record<string, { icon: string; label: string; color: string; title: string }> = {
            aggressive: { icon: '⚔', label: 'AGGRO', color: '#ff4f7b', title: '[Z] Aggressive — pursues nearby enemies' },
            defensive:  { icon: '🛡', label: 'DEF',   color: '#4af7c4', title: '[Z] Defensive — holds position more' },
            hold:       { icon: '⛨', label: 'HOLD',   color: '#aaaaaa', title: '[Z] Hold — only attacks at melee range' },
          }
          const cfg = stanceConfig[stance] ?? stanceConfig.defensive
          return (
            <button
              onClick={gameActions.cycleStance ?? undefined}
              title={cfg.title}
              style={{
                pointerEvents: 'auto',
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                background: `${cfg.color}18`,
                border: `1px solid ${cfg.color}66`,
                borderRadius: 4,
                color: cfg.color,
                letterSpacing: 0.5,
                lineHeight: 1.3,
                textAlign: 'center',
                minHeight: 44,
              }}
            >
              <div style={{ fontWeight: 700 }}>{cfg.icon} {cfg.label}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>Z</div>
            </button>
          )
        })()}
        {/* Select All button — critical for mobile (no keyboard shortcut available) */}
        {gameActions?.selectAll && (
          <button
            onClick={() => gameActions.selectAll?.()}
            title="[E] Select all friendly specks"
            style={{
              pointerEvents: 'auto',
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
              background: 'rgba(74,247,196,0.12)',
              border: '1px solid rgba(74,247,196,0.4)',
              borderRadius: 4,
              color: '#4af7c4',
              letterSpacing: 0.5,
              lineHeight: 1.3,
              textAlign: 'center',
              minHeight: 44,
            }}
          >
            <div style={{ fontWeight: 700 }}>⬡ ALL</div>
            {!isTouchDevice && <div style={{ fontSize: 8, opacity: 0.7 }}>E</div>}
          </button>
        )}
        {/* Snap to base button — essential for mobile (no keyboard shortcut) */}
        {gameActions?.snapToBase && (
          <button
            onClick={() => gameActions.snapToBase?.()}
            title="[C] Center camera on home base"
            aria-label="Snap camera to home base"
            style={{
              pointerEvents: 'auto',
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
              background: 'rgba(74,247,196,0.08)',
              border: '1px solid rgba(74,247,196,0.3)',
              borderRadius: 4,
              color: 'rgba(74,247,196,0.8)',
              letterSpacing: 0.5,
              lineHeight: 1.3,
              textAlign: 'center',
              minHeight: 44,
            }}
          >
            <div style={{ fontWeight: 700 }}>⌂ HOME</div>
            {!isTouchDevice && <div style={{ fontSize: 8, opacity: 0.7 }}>C</div>}
          </button>
        )}
        {/* Snap to battle button — mobile: jump camera to where the fight is (V key) */}
        {gameActions?.snapToAction && (
          <button
            onClick={() => gameActions.snapToAction?.()}
            title="[V] Snap camera to active battle"
            aria-label="Snap camera to battle"
            style={{
              pointerEvents: 'auto',
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
              background: 'rgba(255,80,80,0.1)',
              border: '1px solid rgba(255,80,80,0.35)',
              borderRadius: 4,
              color: 'rgba(255,120,80,0.9)',
              letterSpacing: 0.5,
              lineHeight: 1.3,
              textAlign: 'center',
              minHeight: 44,
            }}
          >
            <div style={{ fontWeight: 700 }}>⚔ FIGHT</div>
            {!isTouchDevice && <div style={{ fontSize: 8, opacity: 0.7 }}>V</div>}
          </button>
        )}
        <button
          onClick={() => setShowHelp(h => !h)}
          title="? — show controls"
          aria-label="Show controls"
          style={{
            pointerEvents: 'auto',
            padding: '8px 12px',
            fontSize: 14,
            cursor: 'pointer',
            background: showHelp ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${showHelp ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: 4,
            color: '#fff',
            minHeight: 44, minWidth: 44,
            fontWeight: 700,
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
          {isTouchDevice ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 12,
              color: 'rgba(255,255,255,0.8)', fontSize: 13, letterSpacing: 0.5,
              background: 'rgba(0,0,0,0.5)', padding: '24px 32px',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              maxWidth: 320, maxHeight: '80vh', overflowY: 'auto',
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#4af7c4', marginBottom: 4 }}>Touch Controls</div>
              {[
                ['Tap canvas', 'Rally units to that spot'],
                ['Long-press canvas', 'Attack Move (aggressive)'],
                ['Pinch', 'Zoom in / out'],
                ['Drag', 'Pan camera'],
                ['Tap minimap', 'Navigate camera there'],
              ].map(([gesture, desc]) => (
                <div key={gesture} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ color: '#ffb450', whiteSpace: 'nowrap' }}>{gesture}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>{desc}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: 1 }}>BUTTONS</div>
                {[
                  ['⬡ ALL', 'Select all your specks'],
                  ['⌂ HOME', 'Camera → your base'],
                  ['⚔ FIGHT', 'Camera → active battle'],
                  ['★ SURGE', '2× spawn rate for 8s'],
                  ['🔧 SACR', 'Sacrifice 10 specks → +15 HP base'],
                  ['◆ TURRET', 'Build turret (need 20+ selected)'],
                  ['Z', 'Cycle stance (Aggressive / Defensive / Hold)'],
                  ['1× / 2× / 4×', 'Game speed'],
                ].map(([btn, desc]) => (
                  <div key={btn} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                    <span style={{ color: '#4af7c4', fontWeight: 600, whiteSpace: 'nowrap' }}>{btn}</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'right', fontSize: 12 }}>{desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 2, color: 'rgba(160,220,255,0.6)', fontSize: 11 }}>
                Tap anywhere to close
              </div>
            </div>
          ) : (
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
              <span>Right-click — move · Left-click — deselect</span><span>Space — pause</span>
              <span>Left-drag — box select specks</span><span>Middle-drag — pan camera</span>
              <span>Ctrl+scroll — zoom · scroll — pan</span><span>R — clear rally</span>
              <span>E / Ctrl+A — select all · Esc — cancel/clear</span><span>Arrow keys / W S — pan camera</span>
              <span>Ctrl+4-9 — save group</span><span>4-9 — recall group</span>
              <span style={{ color: 'rgba(74,247,196,0.7)' }}>Right-click with group selected → moves selected only</span><span style={{ color: 'rgba(74,247,196,0.7)' }}>Specks engage enemies en route (attack-move)</span>
              <span>A — attack-move modifier · P — patrol modifier</span><span>A/P + right-click — attack-move / patrol</span>
              <span style={{ color: 'rgba(255,180,80,0.75)' }}>Long-press canvas → Attack Move (mobile)</span><span style={{ color: 'rgba(255,180,80,0.75)' }}>Tap canvas → Rally (mobile)</span>
              <span>S — stop · H — hold position</span><span>C — center on base</span>
              <span>N — advance to outpost · D — defend base</span><span>B — rush enemy base</span>
              <span>Q — surge (2× spawn 8s)</span><span>V — snap camera to battle</span>
              <span>1/2/3 — set spawn type</span><span>Minimap — left-click rally · right-click pan</span>
              <span>X — cycle speed (1×/2×/4×)</span><span>F — sacrifice 10 specks → +15 HP</span>
              <span>T — build turret (select 20+ specks first)</span><span>? — this help</span>
              <span>Z — cycle stance (Aggressive/Defensive/Hold)</span><span>G — guard mode (follow selected)</span>
              <span style={{ color: 'rgba(160,220,255,0.7)' }}>2 creep camps on each map — contest to earn +25% spawn for 30s</span><span style={{ color: 'rgba(160,220,255,0.7)' }}>50/150/300 kills → BLOODED/HARDENED/VETERAN ARMY upgrades</span>
              <span style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 2, color: 'rgba(255,215,0,0.5)', fontSize: 11 }}>
                Daily map seed changes each day · modifier shown top-right (bulwark/blitz/siege)
              </span>
            </div>
          )}
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
          return { id, color, isUnderAttack, isPlayerOwned, cap, hpFrac }
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
              {dots.map(({ id, color, isUnderAttack, isPlayerOwned, cap, hpFrac }, i) => {
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
                    {/* Fortification indicator — gold bar for player-owned outposts with fortify progress */}
                    {(() => {
                      if (!isPlayerOwned) return null
                      const level = hud.outpostFortify?.[id] ?? 0
                      if (level <= 0) return null
                      return (
                        <div style={{ width: 14, height: 2, background: 'rgba(255,215,0,0.15)', borderRadius: 1 }}>
                          <div style={{
                            width: `${Math.round(level * 100)}%`,
                            height: '100%', background: '#ffd700', borderRadius: 1, opacity: 0.7,
                          }} />
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {/* Triple outpost production bonus indicator */}
      {hud?.tripleOutpostOwner === 'player' && phase === 'playing' && (
        <div style={{
          position: 'absolute', top: 100, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
            color: '#ffd700', textShadow: '0 0 8px #ffd700',
            background: 'rgba(0,0,0,0.4)', padding: '2px 10px', borderRadius: 4,
          }}>
            ⬡ +PROD
          </span>
        </div>
      )}

      {/* Cinematic countdown overlay */}
      {countdown !== null && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          <div
            key={countdown}
            style={{
              fontSize: 120,
              fontWeight: 'bold',
              color: countdown === 1 ? '#ff4f7b' : countdown === 2 ? '#ffcc44' : '#4af7c4',
              textShadow: `0 0 40px currentColor, 0 0 80px currentColor`,
              letterSpacing: 8,
              lineHeight: 1,
              animation: 'countdown-pop 0.9s ease-out forwards',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

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
        <div onClick={togglePause} style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
          cursor: 'pointer',
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
              const scout = t['scout'] ?? 0
              const parts: string[] = []
              if (heavy > 0) parts.push(`${heavy}× heavy`)
              if (basic > 0) parts.push(`${basic}× basic`)
              if (scout > 0) parts.push(`${scout}× dart`)
              if (parts.length === 0) return '—'
              return parts.join(', ')
            }
            // Production rate estimate
            const BASE_MS = spawnMode === 'heavy' ? 1800 : spawnMode === 'scout' ? 500 : 800
            const OUTPOST_MS = 1200
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
                <span>Outposts: {aiOutpostCount}</span>
                <span style={{ gridColumn: '1/-1', textAlign: 'center', color: colorHex(PLAYER_COLOR), opacity: 0.7 }}>↑{kills} kills · {losses} lost</span>
                <span style={{ gridColumn: '1/-1', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
                  {formatTime(elapsedMs)} elapsed
                </span>
              </div>
            )
          })()}
          <button
            onClick={(e) => { e.stopPropagation(); surrender() }}
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
              minHeight: 44,
            }}
          >
            Give Up
          </button>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 }}>
            Tap anywhere to resume
          </div>
        </div>
      )}

      {/* Command panel — bottom center: build menu + selection info, stacked */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute',
          bottom: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          opacity: hud && ((hud.selectedSpeckCount ?? 0) > 0 || hud.selectedBuilding != null) ? 1 : 0,
          transition: 'opacity 150ms ease',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}>
          {/* Build menu — only shows when specks are selected */}
          {(() => {
            const selectedCount = hud?.selectedSpeckCount ?? 0
            if (selectedCount === 0) return null
            const TURRET_COST = 20
            const canBuild = selectedCount >= TURRET_COST
            const barFill = Math.min(1, selectedCount / TURRET_COST)
            return (
              <div style={{
                background: 'rgba(0,0,0,0.65)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: '7px 12px',
                width: 190,
                pointerEvents: 'auto',
              }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                  BUILD
                </div>
                <button
                  onClick={() => { if (canBuild) (gameActions as { buildTurret?: () => void } | null)?.buildTurret?.() }}
                  style={{
                    width: '100%',
                    background: canBuild ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${canBuild ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 4,
                    padding: '6px 8px',
                    cursor: canBuild ? 'pointer' : 'default',
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    opacity: canBuild ? 1 : 0.45,
                    transition: 'opacity 200ms, border-color 200ms',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: canBuild ? '#ffd700' : 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
                      ◆ TURRET
                    </span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>
                      {TURRET_COST} specks
                    </span>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5, marginBottom: 5 }}>
                    Fires missiles at nearby enemies
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${barFill * 100}%`,
                        background: canBuild ? '#ffd700' : '#4af7c4',
                        borderRadius: 2,
                        transition: 'width 100ms',
                      }} />
                    </div>
                    <span style={{ fontSize: 8, color: canBuild ? '#ffd700' : 'rgba(255,255,255,0.45)', letterSpacing: 0.5, minWidth: 32, textAlign: 'right' }}>
                      {selectedCount}/{TURRET_COST}
                    </span>
                  </div>
                </button>
              </div>
            )
          })()}

          {/* Building info panel — shown when a building is selected and no specks are selected */}
          {hud?.selectedBuilding && (hud.selectedSpeckCount ?? 0) === 0 && (() => {
            const b = hud.selectedBuilding
            const hpFrac = b.hp / b.maxHp
            const hpColor = hpFrac > 0.5 ? '#4af7c4' : hpFrac > 0.2 ? '#ffaa44' : '#ff4f7b'
            return (
              <div style={{
                background: 'rgba(0,0,0,0.65)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: '7px 12px',
                minWidth: 160,
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>
                  {b.typeId.toUpperCase()}
                </div>
                <div style={{ fontSize: 9, color: hpColor, letterSpacing: 1, marginBottom: 4 }}>
                  HP {Math.ceil(b.hp)} / {b.maxHp}
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${hpFrac * 100}%`, background: hpColor, borderRadius: 2, transition: 'width 150ms' }} />
                </div>
                {b.spawnTypeOverride && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>
                    Producing:{' '}
                    <span style={{
                      color: b.spawnTypeOverride === 'heavy' ? '#ff8844'
                           : b.spawnTypeOverride === 'scout' ? '#50c8ff'
                           : '#4af7c4',
                      fontWeight: 600,
                    }}>
                      {b.spawnTypeOverride.toUpperCase()}
                    </span>
                    {!isTouchDevice && <span style={{ color: '#666', marginLeft: 6 }}>1/2/3 to change</span>}
                  </div>
                )}
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                  {isTouchDevice ? 'tap canvas to set rally' : 'right-click to set rally'}
                </div>
              </div>
            )
          })()}

          {/* Outpost upgrade research panel */}
          {hud?.selectedBuilding?.typeId === 'outpost' &&
           hud.selectedBuilding.ownerId === 'player' &&
           (hud.selectedBuilding.fortifyDuration ?? 0) >= 20000 &&
           phase === 'playing' && (() => {
            if (hud.selectedBuilding!.researchedUpgrade) {
              return (
                <div style={{
                  background: 'rgba(0,0,0,0.65)',
                  border: '1px solid rgba(68,170,255,0.3)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  pointerEvents: 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 10, letterSpacing: 1,
                  color: '#44aaff',
                }}>
                  <span>⚗</span>
                  <span>{hud.selectedBuilding!.researchedUpgrade!.toUpperCase()}</span>
                </div>
              )
            }
            const upgrades: Array<{ id: 'carapace' | 'blades' | 'afterburners'; label: string; desc: string; color: string }> = [
              { id: 'carapace', label: 'CARAPACE', desc: '+1 HP', color: '#44ff88' },
              { id: 'blades', label: 'BLADES', desc: '+15% DMG', color: '#ff4f7b' },
              { id: 'afterburners', label: 'AFTERBURNERS', desc: '+15% SPD', color: '#44aaff' },
            ]
            return (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'rgba(0,0,0,0.7)', padding: '8px 12px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                pointerEvents: 'auto',
              }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.5)' }}>⚗ RESEARCH UPGRADE</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {upgrades.map(u => (
                    <button key={u.id} onClick={() => gameActions?.researchUpgrade?.(hud.selectedBuilding!.id, u.id)} style={{
                      padding: '4px 10px', fontSize: 10, letterSpacing: 1,
                      background: 'rgba(0,0,0,0.5)', border: `1px solid ${u.color}44`,
                      color: u.color, cursor: 'pointer', borderRadius: 4,
                      fontFamily: 'monospace', minHeight: 44,
                    }}>
                      <div>{u.label}</div>
                      <div style={{ opacity: 0.7 }}>{u.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Selection info panel */}
          <div style={{
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '7px 12px',
            minWidth: 130,
            pointerEvents: (hud?.selectedSpeckCount ?? 0) > 0 ? 'auto' : 'none',
          }}>
            <div style={{
              fontSize: 9, letterSpacing: 2, color: '#ffffff', opacity: 0.9, marginBottom: 5,
            }}>
              SELECTED {hud?.selectedSpeckCount ?? 0}
            </div>
            {hud?.selectedComposition && Object.entries(hud.selectedComposition.types)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([typeId, count]) => (
                <div key={typeId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 2,
                }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, flexShrink: 0,
                    borderRadius: typeId === 'heavy' ? 1 : '50%',
                    background: '#4af7c4',
                    transform: typeId === 'heavy' ? 'rotate(45deg)' : 'none',
                  }} />
                  <span style={{ flex: 1, letterSpacing: 1 }}>
                    {typeId.charAt(0).toUpperCase() + typeId.slice(1)}
                  </span>
                  <span style={{ color: '#ffffff' }}>{count}</span>
                </div>
              ))
            }
            {hud?.selectedComposition && (hud.selectedComposition.veteranCount > 0 || hud.selectedComposition.eliteCount > 0 || hud.selectedComposition.legendCount > 0) && (
              <div style={{ fontSize: 8, color: 'rgba(255,215,0,0.7)', marginTop: 3, letterSpacing: 1 }}>
                {hud.selectedComposition.legendCount > 0 && <span style={{ color: '#cc44ff' }}>{`✦✦ ${hud.selectedComposition.legendCount} legend  `}</span>}
                {hud.selectedComposition.eliteCount > 0 && `✦ ${hud.selectedComposition.eliteCount} elite  `}
                {hud.selectedComposition.veteranCount > 0 && `⭐ ${hud.selectedComposition.veteranCount} vet`}
              </div>
            )}
            {/* Unit action buttons */}
            {(hud?.selectedSpeckCount ?? 0) > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8,
              }}>
                {[
                  { label: 'Stop', key: 'S', action: gameActions.stop },
                  { label: 'Hold', key: 'H', action: gameActions.hold },
                  { label: 'Defend', key: 'D', action: gameActions.defend },
                  { label: 'Advance', key: 'N', action: gameActions.advance },
                  { label: 'Rush', key: 'B', action: gameActions.rush },
                  { label: 'Guard', key: 'G', action: gameActions.guard },
                ].map(({ label, key, action }) => (
                  <button
                    key={label}
                    onClick={() => action?.()}
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: 4,
                      color: '#ddd',
                      fontSize: 12,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                      userSelect: 'none',
                      fontFamily: 'monospace',
                      minHeight: 44,
                    }}
                  >
                    {label}
                    {!isTouchDevice && <span style={{ color: '#888', fontSize: 10 }}>[{key}]</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Touch gesture hint */}
            {isTouchDevice && <div style={{ marginTop: 6, fontSize: 11, color: '#aaa', letterSpacing: 0.3, textAlign: 'center' }}>
              Tap: rally &bull; Long-press: attack-move
            </div>}
          </div>
        </div>
      )}

      {/* Mobile action buttons — bottom right */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
          pointerEvents: 'auto',
        }}>
          {/* Stance indicator */}
          <div style={{ fontSize: 11, letterSpacing: 1.5, opacity: 0.8, color: stance === 'aggressive' ? '#ff4f7b' : stance === 'hold' ? '#aaaaaa' : '#4af7c4', textAlign: 'right' }}>
            {stance === 'aggressive' ? 'AGGRO' : stance === 'hold' ? 'HOLD' : 'DEF'}
            {!isTouchDevice && <span style={{ opacity: 0.5, marginLeft: 4 }}>[Z]</span>}
          </div>
          <div style={{
            display: 'flex', gap: 6,
          }}>
          <button
            onClick={() => gameActions.defend?.()}
            title="[D] Defend — rally to your base"
            style={{
              padding: '8px 12px',
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
            title="[N] Advance — rally to nearest outpost"
            style={{
              padding: '8px 12px',
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
            → N
          </button>
          <button
            onClick={() => gameActions.rush?.()}
            title="[B] Rush — attack enemy base"
            style={{
              padding: '8px 12px',
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
          {(() => {
            const surgeActive = (hud?.surgeDuration ?? 0) > 0
            const surgeCd = hud?.surgeCooldown ?? 0
            const surgeReady = !surgeActive && surgeCd <= 0
            return (
              <button
                onClick={() => { if (surgeReady) gameActions.surge?.() }}
                title="[Q] Surge — 2× production for 8s (45s cooldown)"
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  cursor: surgeReady ? 'pointer' : 'default',
                  background: surgeActive ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.06)',
                  border: surgeActive
                    ? '1px solid rgba(255,215,0,0.9)'
                    : surgeReady
                      ? '1px solid rgba(255,215,0,0.4)'
                      : '1px solid rgba(255,215,0,0.15)',
                  borderRadius: 20,
                  color: surgeActive ? '#ffd700' : surgeReady ? '#c8a800' : 'rgba(200,168,0,0.4)',
                  letterSpacing: 1,
                  minHeight: 44,
                  fontFamily: 'monospace',
                  opacity: surgeReady || surgeActive ? 1 : 0.6,
                }}
              >
                {surgeActive
                  ? `★ ${Math.ceil((hud?.surgeDuration ?? 0) / 1000)}s`
                  : surgeCd > 0
                    ? `Q ${Math.ceil(surgeCd / 1000)}s`
                    : '★ Q'}
              </button>
            )
          })()}
          {(() => {
            const cd = hud?.sacrificeCooldown ?? 0
            const speckCount = hud?.players.player?.speckCount ?? 0
            const baseHp = hud?.players.player?.buildingHp['building-player-base'] ?? 100
            const ready = cd <= 0 && speckCount >= 10 && baseHp < 90
            return (
              <button
                onClick={() => { if (ready) gameActions.sacrifice?.() }}
                title="[F] Sacrifice 10 specks → repair +15 HP base (45s cooldown)"
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  cursor: ready ? 'pointer' : 'default',
                  background: ready ? 'rgba(100,200,100,0.12)' : 'rgba(100,200,100,0.04)',
                  border: ready ? '1px solid rgba(100,200,100,0.5)' : '1px solid rgba(100,200,100,0.15)',
                  borderRadius: 20,
                  color: ready ? '#64c864' : 'rgba(100,200,100,0.35)',
                  letterSpacing: 1,
                  minHeight: 44,
                  fontFamily: 'monospace',
                  opacity: ready ? 1 : 0.6,
                }}
              >
                {cd > 0 ? `F ${Math.ceil(cd / 1000)}s` : '🔧 F'}
              </button>
            )
          })()}
          <button
            onClick={() => gameActions.clearRally?.()}
            title="[R] Clear rally"
            style={{
              padding: '8px 12px',
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
            {/* Production rate */}
            {(hud.spawnRates?.player ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: colorHex(PLAYER_COLOR), opacity: 0.6, minWidth: 20, textAlign: 'right' }}>
                  {hud.spawnRates.player}/m
                </span>
                <div style={{ width: 100, textAlign: 'center', fontSize: 8, letterSpacing: 0.5, color: 'rgba(255,255,255,0.3)' }}>
                  ⚡prod
                </div>
                <span style={{ fontSize: 9, color: colorHex(AI_COLOR), opacity: 0.6, minWidth: 20 }}>
                  {hud.spawnRates.ai}/m
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
            {/* Veteran / elite / legend count */}
            {(() => {
              const vets = hud.players.player?.veteranCount ?? 0
              const elites = hud.players.player?.eliteCount ?? 0
              const legends = hud.players.player?.legendCount ?? 0
              if (vets + elites + legends === 0) return null
              return (
                <div style={{ display: 'flex', gap: 8, fontSize: 9, letterSpacing: 0.5 }}>
                  {legends > 0 && (
                    <span style={{ color: '#cc44ff', opacity: 0.9 }}>✦✦ {legends} legend</span>
                  )}
                  {elites > 0 && (
                    <span style={{ color: '#ffffff', opacity: 0.8 }}>✦ {elites} elite</span>
                  )}
                  {vets > 0 && (
                    <span style={{ color: '#ffd700', opacity: 0.65 }}>⭐ {vets} vet</span>
                  )}
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
            {/* Army upgrade tier */}
            {kills >= 20 && (() => {
              const upgradeLevel = kills >= 300 ? 3 : kills >= 150 ? 2 : kills >= 50 ? 1 : 0
              const tiers: Array<{ icon: string; label: string; color: string } | null> = [
                null,
                { icon: '⚡', label: 'BLOODED', color: '#88ffaa' },
                { icon: '🛡', label: 'HARDENED', color: '#44aaff' },
                { icon: '🔥', label: 'VETERAN ARMY', color: '#ff8844' },
              ]
              const tier = tiers[upgradeLevel]
              const nextKills = upgradeLevel === 0 ? 50 : upgradeLevel === 1 ? 150 : upgradeLevel === 2 ? 300 : null
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, letterSpacing: 0.5 }}>
                  {tier ? (
                    <span style={{ color: tier.color, opacity: 0.8 }}>{tier.icon} {tier.label}</span>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>army upgrade: {kills}/50</span>
                  )}
                  {tier && nextKills && (
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}>→ {nextKills}k</span>
                  )}
                </div>
              )
            })()}
          </div>
        )
      })()}

    </div>
  )
}

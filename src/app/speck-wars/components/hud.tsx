'use client'
import { useState, useEffect, useRef } from 'react'
import { useSpeckWarsStore } from '../store'
import { PLAYER_COLOR, AI_COLOR, DAILY_MODIFIER_LABELS, FORTIFY_TIME } from '../domain/constants'
import { getBestTime, getWinStreak } from '../lib/personal-best'
import { onLongPressStart, onLongPressCancel, onTapRipple } from '../input/touch-feedback'

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
  const [controlGroupSizes, setControlGroupSizes] = useState<[number, number, number]>([0, 0, 0])
  const [touchSelectActive, setTouchSelectActive] = useState(false)
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false
  )
  const [showPortraitHint, setShowPortraitHint] = useState(true)
  const [minimapExpanded, setMinimapExpanded] = useState(false)
  const [buildingPanelExpanded, setBuildingPanelExpanded] = useState(false)
  const [longPressRing, setLongPressRing] = useState<{ x: number; y: number } | null>(null)
  const [tapRippleState, setTapRippleState] = useState<{ x: number; y: number; key: number } | null>(null)
  const tapRippleKeyRef = useRef(0)
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    setWinStreak(getWinStreak())
  }, [])

  useEffect(() => {
    const update = () => {
      const portrait = window.innerWidth < window.innerHeight
      setIsPortrait(portrait)
      if (portrait) setShowPortraitHint(true)  // re-show if user rotates back
    }
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update) }
  }, [])

  // Auto-dismiss portrait hint after 4s
  useEffect(() => {
    if (!showPortraitHint) return
    const t = setTimeout(() => setShowPortraitHint(false), 4000)
    return () => clearTimeout(t)
  }, [showPortraitHint])

  // Auto-reset touch select mode after 5s
  useEffect(() => {
    if (!touchSelectActive) return
    const t = setTimeout(() => setTouchSelectActive(false), 5000)
    return () => clearTimeout(t)
  }, [touchSelectActive])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Slash' && e.shiftKey) { e.preventDefault(); setShowHelp(h => !h) }
      if (e.code === 'Escape') { setShowHelp(false); setMinimapExpanded(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isTouchDevice) return
    const unsub1 = onLongPressStart((x, y) => setLongPressRing({ x, y }))
    const unsub2 = onLongPressCancel(() => setLongPressRing(null))
    const unsub3 = onTapRipple((x, y) => {
      tapRippleKeyRef.current += 1
      setTapRippleState({ x, y, key: tapRippleKeyRef.current })
    })
    return () => { unsub1(); unsub2(); unsub3() }
  }, [isTouchDevice])

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
  const difficulty = useSpeckWarsStore(s => s.difficulty)
  const surrender = useSpeckWarsStore(s => s.surrender)
  const gameActions = useSpeckWarsStore(s => s.gameActions)
  const stance = useSpeckWarsStore(s => s.stance)

  // Auto-collapse building drawer when building is deselected
  useEffect(() => {
    if (!hud?.selectedBuilding) setBuildingPanelExpanded(false)
  }, [hud?.selectedBuilding])

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
        @keyframes long-press-ring {
          from { stroke-dashoffset: 126; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes tap-ripple-expand {
          from { transform: scale(1); opacity: 0.8; }
          to   { transform: scale(4); opacity: 0; }
        }
        @keyframes panel-slide-up {
          from { transform: translateX(-50%) translateY(12px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
      {/* Portrait mode hint — shown briefly for touch users in portrait orientation, auto-dismisses */}
      {isTouchDevice && isPortrait && showPortraitHint && phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6, padding: '6px 14px', fontSize: 12, color: 'rgba(255,255,255,0.7)',
          letterSpacing: 0.5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 90,
        }}>
          ↺ Rotate to landscape for best experience
        </div>
      )}
      {hud?.baseUnderThreat && (
        <div style={{
          position: 'fixed',
          inset: 0,
          border: '4px solid rgba(255, 50, 50, 0.85)',
          borderRadius: 2,
          pointerEvents: 'none',
          zIndex: 100,
          animation: prefersReducedMotion ? 'none' : 'pulse-red 0.8s ease-in-out infinite alternate',
          boxShadow: 'inset 0 0 40px rgba(255, 0, 0, 0.25)',
        }} />
      )}
      {hud?.baseUnderThreat && (
        <button
          onClick={() => { gameActions?.snapToBase?.(); navigator.vibrate?.(25) }}
          style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(200,0,0,0.9)', color: '#fff', fontWeight: 700,
            padding: '4px 14px', borderRadius: 6, fontSize: 13, letterSpacing: 1,
            zIndex: 110, pointerEvents: 'auto', cursor: 'pointer',
            animation: prefersReducedMotion ? 'none' : 'pulse-red 0.6s ease-in-out infinite alternate',
            border: 'none', fontFamily: 'monospace',
          }}
        >⚠ BASE UNDER ATTACK ↑</button>
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
        <button
          onClick={() => { gameActions?.snapToAction?.(); navigator.vibrate?.(20) }}
          style={{
            position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(200,80,0,0.88)', color: '#ffe0c0', fontWeight: 700,
            padding: '3px 12px', borderRadius: 6, fontSize: 12, letterSpacing: 1,
            zIndex: 108, pointerEvents: 'auto', cursor: 'pointer',
            border: 'none', fontFamily: 'monospace',
          }}
        >ENEMY ADVANCING ↑</button>
      )}
      {hud?.rallyCryActive && !hud?.baseUnderThreat && (
        <div style={{
          position: 'fixed', top: 108, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,136,0,0.88)', color: '#fff', fontWeight: 700,
          padding: '3px 12px', borderRadius: 6, fontSize: 11, letterSpacing: 1,
          zIndex: 107, pointerEvents: 'none',
          animation: prefersReducedMotion ? 'none' : 'pulse-red 0.9s ease-in-out infinite alternate',
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
            animation: prefersReducedMotion ? 'none' : `danger-pulse ${isCritical ? '0.5s' : '1s'} ease-in-out infinite alternate`,
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
            animation: prefersReducedMotion ? 'none' : 'win-pulse 1.2s ease-in-out infinite alternate',
            pointerEvents: 'none',
          }} />
        </>
      )}
      {/* Dual base HP bars — top edge, fighting-game style */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', height: isTouchDevice ? 6 : 3, pointerEvents: 'none',
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

      {/* Supply bars — below HP bars, two-side player/enemy */}
      {phase === 'playing' && hud && (
        <div style={{
          position: 'absolute', top: isTouchDevice ? 6 : 3, left: 0, right: 0,
          display: 'flex', height: 2, pointerEvents: 'none',
        }}>
          {(() => {
            const supplyUsed = hud.players.player?.supplyUsed ?? 0
            const supplyCap = hud.players.player?.supplyCap ?? 120
            const SOFT_CAP = 60
            const frac = Math.min(1, supplyUsed / supplyCap)
            const color = supplyUsed >= supplyCap ? '#ff4f7b'
              : supplyUsed >= SOFT_CAP ? '#ffaa44' : '#4af7c4'
            return (
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0,
                  width: `${frac * 100}%`,
                  background: color,
                  transition: 'width 0.5s ease, background 0.3s ease',
                  opacity: 0.7,
                }} />
              </div>
            )
          })()}
          <div style={{ width: 2, background: 'rgba(0,0,0,0.6)' }} />
          {(() => {
            const supplyUsed = hud.players.ai?.supplyUsed ?? 0
            const supplyCap = hud.players.ai?.supplyCap ?? 120
            const SOFT_CAP = 60
            const frac = Math.min(1, supplyUsed / supplyCap)
            const color = supplyUsed >= supplyCap ? '#ff4f7b'
              : supplyUsed >= SOFT_CAP ? '#ffaa44' : '#ff4f7b'
            return (
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0,
                  width: `${frac * 100}%`,
                  background: color,
                  transition: 'width 0.5s ease, background 0.3s ease',
                  opacity: 0.5,
                }} />
              </div>
            )
          })()}
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
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: isTouchDevice ? 10 : 8, letterSpacing: 0.5 }}>
              DAILY MAP · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </span>
            {hud?.dailyModifier && hud.dailyModifier !== 'standard' && (
              <span
                title={DAILY_MODIFIER_LABELS[hud.dailyModifier]}
                style={{ color: '#ffd700', fontSize: isTouchDevice ? 10 : 8, letterSpacing: 0.5, opacity: 0.7, textAlign: 'right', cursor: 'help' }}
              >
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
            <button
              onClick={() => { gameActions?.snapToBase?.(); navigator.vibrate?.(inProgress ? [20, 30, 20] : 15) }}
              style={{
                position: 'absolute', top: isTouchDevice ? 175 : 240, right: 16,
                padding: isTouchDevice ? '8px 12px' : '4px 10px',
                background: inProgress ? 'rgba(255,80,80,0.25)' : 'rgba(255,140,0,0.15)',
                border: `1px solid ${inProgress ? 'rgba(255,80,80,0.6)' : 'rgba(255,140,0,0.5)'}`,
                borderRadius: 4,
                fontSize: 10,
                letterSpacing: 1.5,
                color: inProgress ? '#ff5050' : '#ffa030',
                animation: (!prefersReducedMotion && inProgress) ? 'danger-pulse 0.6s ease-in-out infinite alternate' : 'none',
                cursor: 'pointer',
                fontFamily: 'monospace',
                minHeight: isTouchDevice ? 44 : undefined,
                display: 'flex', alignItems: 'center',
              }}
            >
              {inProgress ? '⚠ WAVE INCOMING! ↑' : `⚠ WAVE IN ${secs}s ↑`}
            </button>
          </>
        )
      })()}

      {/* Mini-map — top right, below difficulty badge */}
      {hud && (() => {
        const isNarrowDevice = typeof window !== 'undefined' && window.innerWidth < 768
        const MINIMAP_SIZE = minimapExpanded ? 280 : (isTouchDevice && isNarrowDevice ? 110 : 160)
        const SCALE = MINIMAP_SIZE / 3000  // world→screen
        return (
          <div style={{
            position: 'absolute',
            top: minimapExpanded ? '50%' : 72,
            right: minimapExpanded ? '50%' : 16,
            transform: minimapExpanded ? 'translate(50%, -50%)' : 'none',
            width: MINIMAP_SIZE, height: MINIMAP_SIZE,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            overflow: 'hidden',
            cursor: 'crosshair',
            zIndex: minimapExpanded ? 150 : undefined,
          }}>
            {isTouchDevice && (
              <button
                onClick={(e) => { e.stopPropagation(); setMinimapExpanded(v => !v); navigator.vibrate?.(8) }}
                style={{
                  position: 'absolute',
                  top: 2, right: 2,
                  width: 18, height: 18,
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 3,
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 10,
                  lineHeight: '18px',
                  textAlign: 'center',
                  padding: 0,
                  cursor: 'pointer',
                  zIndex: 10,
                  pointerEvents: 'auto',
                }}
                aria-label={minimapExpanded ? 'Collapse minimap' : 'Expand minimap'}
              >
                {minimapExpanded ? '⊖' : '⊕'}
              </button>
            )}
            <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE} style={{ display: 'block' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - rect.left
                const py = e.clientY - rect.top
                // Check if tap is near a player-owned building on the minimap
                const TAP_THRESHOLD = 10  // px in minimap space
                const nearBuilding = hud?.minimap?.buildings?.find(b => {
                  if (b.ownerId !== 'player') return false
                  const bx = b.x * SCALE
                  const by = b.y * SCALE
                  return Math.hypot(px - bx, py - by) < TAP_THRESHOLD
                })
                if (nearBuilding && gameActions?.panCamera) {
                  gameActions.panCamera(nearBuilding.x, nearBuilding.y)
                  gameActions?.selectBuilding?.(nearBuilding.id)
                  return
                }
                if (!gameActions?.rally) return
                const worldX = (px / MINIMAP_SIZE) * 3000
                const worldY = (py / MINIMAP_SIZE) * 3000
                gameActions.rally(worldX, worldY)
                if (minimapExpanded) setMinimapExpanded(false)
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
                // Check if tap is near a player-owned building on the minimap
                const TAP_THRESHOLD = 10  // px in minimap space
                const nearBuilding = hud?.minimap?.buildings?.find(b => {
                  if (b.ownerId !== 'player') return false
                  const bx = b.x * SCALE
                  const by = b.y * SCALE
                  return Math.hypot(px - bx, py - by) < TAP_THRESHOLD
                })
                if (nearBuilding) {
                  gameActions.panCamera(nearBuilding.x, nearBuilding.y)
                  gameActions?.selectBuilding?.(nearBuilding.id)
                  navigator.vibrate?.(15)
                  return
                }
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
                              animation: prefersReducedMotion ? 'none' : `minimap-capture-pulse 1.1s ease-out infinite`,
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
          position: 'absolute', top: isTouchDevice ? 210 : 250, right: 16,
          display: 'flex', flexDirection: 'column', gap: 3,
          pointerEvents: 'none',
          width: 140,
        }}>
          {killFeed.slice(0, isTouchDevice ? 3 : 6).map(entry => {
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
          aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
          style={{
            pointerEvents: 'auto',
            padding: isTouchDevice ? '8px 10px' : '8px 14px',
            fontSize: isTouchDevice ? 16 : 12,
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 4,
            color: '#fff',
            letterSpacing: 1,
            minHeight: 44, minWidth: 44,
          }}
        >
          {isTouchDevice
            ? (phase === 'paused' ? '▶' : '⏸')
            : (phase === 'paused' ? 'RESUME' : 'PAUSE')}
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
        {/* Spawn type selector removed — set per-building in the building panel */}
        {/* Stance toggle — cycles through aggressive/defensive/hold — hidden on touch (bottom-right panel has it) */}
        {!isTouchDevice && gameActions?.cycleStance && (() => {
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
            aria-label="Select all friendly specks"
            style={{
              pointerEvents: 'auto',
              padding: isTouchDevice ? '8px 10px' : '8px 12px',
              fontSize: isTouchDevice ? 16 : 12,
              cursor: 'pointer',
              background: 'rgba(74,247,196,0.12)',
              border: '1px solid rgba(74,247,196,0.4)',
              borderRadius: 4,
              color: '#4af7c4',
              letterSpacing: 0.5,
              lineHeight: 1.3,
              textAlign: 'center',
              minHeight: 44,
              minWidth: isTouchDevice ? 44 : undefined,
            }}
          >
            {isTouchDevice ? '⬡' : <><div style={{ fontWeight: 700 }}>⬡ ALL</div><div style={{ fontSize: 8, opacity: 0.7 }}>E</div></>}
          </button>
        )}
        {/* Snap to base button — essential for mobile (no keyboard shortcut) */}
        {gameActions?.snapToBase && (
          <button
            onClick={() => { gameActions.snapToBase?.(); navigator.vibrate?.(20) }}
            title="[C] Center camera on home base"
            aria-label="Snap camera to home base"
            style={{
              pointerEvents: 'auto',
              padding: isTouchDevice ? '8px 10px' : '8px 12px',
              fontSize: isTouchDevice ? 16 : 12,
              cursor: 'pointer',
              background: hud?.baseUnderThreat ? 'rgba(255,0,0,0.2)' : 'rgba(74,247,196,0.08)',
              border: `1px solid ${hud?.baseUnderThreat ? 'rgba(255,60,60,0.8)' : 'rgba(74,247,196,0.3)'}`,
              borderRadius: 4,
              color: hud?.baseUnderThreat ? '#ff8080' : 'rgba(74,247,196,0.8)',
              letterSpacing: 0.5,
              lineHeight: 1.3,
              textAlign: 'center',
              minHeight: 44,
              minWidth: isTouchDevice ? 44 : undefined,
              animation: hud?.baseUnderThreat && !prefersReducedMotion ? 'pulse-red 0.6s ease-in-out infinite alternate' : 'none',
            }}
          >
            {isTouchDevice ? '⌂' : <><div style={{ fontWeight: 700 }}>⌂ HOME</div><div style={{ fontSize: 8, opacity: 0.7 }}>C</div></>}
          </button>
        )}
        {/* Snap to battle button — mobile: jump camera to where the fight is (V key) */}
        {gameActions?.snapToAction && (
          <button
            onClick={() => { gameActions.snapToAction?.(); navigator.vibrate?.(20) }}
            title="[V] Snap camera to active battle"
            aria-label="Snap camera to battle"
            style={{
              pointerEvents: 'auto',
              padding: isTouchDevice ? '8px 10px' : '8px 12px',
              fontSize: isTouchDevice ? 16 : 12,
              cursor: 'pointer',
              background: hud?.enemyAdvanceDetected ? 'rgba(255,100,0,0.2)' : 'rgba(255,80,80,0.1)',
              border: `1px solid ${hud?.enemyAdvanceDetected ? 'rgba(255,120,0,0.8)' : 'rgba(255,80,80,0.35)'}`,
              borderRadius: 4,
              color: hud?.enemyAdvanceDetected ? '#ffb060' : 'rgba(255,120,80,0.9)',
              letterSpacing: 0.5,
              lineHeight: 1.3,
              textAlign: 'center',
              minHeight: 44,
              minWidth: isTouchDevice ? 44 : undefined,
            }}
          >
            {isTouchDevice ? '⚔' : <><div style={{ fontWeight: 700 }}>⚔ FIGHT</div><div style={{ fontSize: 8, opacity: 0.7 }}>V</div></>}
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
                ['Double-tap canvas', 'Zoom in / out (toggle)'],
                ['Long-press canvas', 'Attack Move (aggressive)'],
                ['Two-finger tap', 'Stop specks in place'],
                ['Pinch + move', 'Zoom and pan simultaneously'],
                ['Single-finger drag', 'Pan camera'],
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
                  ['🔧 HEAL', 'Sacrifice 10 specks → +15 HP base'],
                  ['★ Y', 'Battle Roar (lvl2) / Last Stand (lvl3)'],
                  ['⊞ SEL', 'Tap then drag to box-select units'],
                  ['◆ TURRET', 'Build turret (need 20+ selected)'],
                  ['Z', 'Cycle stance (Aggressive / Defensive / Hold)'],
                  ['1× / 2× / 4×', 'Game speed'],
                  ['⊕ (minimap)', 'Expand/collapse minimap for overview'],
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
              <span>Left-click — move/rally · Left-drag — box select</span><span>Space — pause</span>
              <span>A + left-click — attack-move</span><span>Middle-drag — pan camera</span>
              <span>Ctrl+scroll — zoom · scroll — pan</span><span>R — clear rally</span>
              <span>E / Ctrl+A — select all · Esc — cancel/deselect</span><span>Arrow keys / W S — pan camera</span>
              <span>Ctrl+4-9 — save group</span><span>4-9 — recall group</span>
              <span style={{ color: 'rgba(74,247,196,0.7)' }}>Left-click with group selected → moves selected only</span><span style={{ color: 'rgba(74,247,196,0.7)' }}>Specks engage enemies en route (attack-move)</span>
              <span>Garrison btn — post 5 specks at outpost to defend</span><span>Recall btn — release garrisoned specks</span>
              <span style={{ color: 'rgba(255,180,80,0.75)' }}>Long-press canvas → Attack Move (mobile)</span><span style={{ color: 'rgba(255,180,80,0.75)' }}>Tap canvas → Rally (mobile)</span>
              <span>S — stop · H — hold position</span><span>C — center on base</span>
              <span>N — advance to outpost · D — defend base</span><span>B — rush enemy base</span>
              <span>Q — surge (2× spawn 8s)</span><span>V — snap camera to battle</span>
              <span>1/2/3 — set spawn type (click building first)</span><span>Minimap — left-click rally · right-click pan</span>
              <span>X — cycle speed (1×/2×/4×)</span><span>F — sacrifice 10 specks → +15 HP</span>
              <span>T — build turret (costs 20 selected specks)</span><span>? — this help</span>
              <span>Z — cycle stance (Aggressive/Defensive/Hold)</span><span>G — guard mode (follow selected)</span>
              <span>Y — Battle Roar (lvl2 Cmdr) / Last Stand (lvl3)</span><span style={{ opacity: 0.5 }}>Commander levels up from nearby kills</span>
              <span style={{ color: 'rgba(160,220,255,0.7)' }}>2 creep camps on each map — contest to earn +25% spawn for 30s</span><span style={{ color: 'rgba(160,220,255,0.7)' }}>50/150/300 kills → BLOODED/HARDENED/VETERAN ARMY upgrades</span>
              <span style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 2, color: 'rgba(255,215,0,0.5)', fontSize: 11 }}>
                Daily map seed changes each day · modifier shown top-right (bulwark/blitz/siege) · hold all 3 outposts 60s = domination win
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
              position: 'absolute', top: isTouchDevice ? 68 : 48, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 10, letterSpacing: 1, opacity: 0.5, marginRight: 4 }}>
                OUTPOSTS {playerCount}/{OUTPOST_IDS.length}
              </span>
              {dots.map(({ id, color, isUnderAttack, isPlayerOwned, cap, hpFrac }, i) => {
                const capColor = cap?.side === 'player' ? '#4af7c4' : '#ff4f7b'
                const building = hud.minimap.buildings.find(b => b.id === id)
                const canTap = isTouchDevice && !!building && !!gameActions?.panCamera
                const sharedStyle = {
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2,
                }
                const touchStyle = canTap ? {
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 8px', minWidth: 36, minHeight: 44, justifyContent: 'center',
                  borderBottom: '1px dotted rgba(255,255,255,0.2)',
                } : {}
                const handleTap = () => {
                  if (!building) return
                  gameActions?.panCamera?.(building.x, building.y)
                  navigator.vibrate?.(15)
                }
                const innerContent = (
                  <>
                    <div style={{
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: isUnderAttack && isPlayerOwned ? '#ff6b35' : color,
                      boxShadow: color !== '#888888' ? `0 0 6px ${isUnderAttack && isPlayerOwned ? '#ff6b35' : color}` : 'none',
                      animation: (!prefersReducedMotion && isUnderAttack && isPlayerOwned) ? 'outpost-alert 0.6s ease-in-out infinite' : 'none',
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
                  </>
                )
                return canTap ? (
                  <button key={i} onClick={handleTap} style={{ ...sharedStyle, ...touchStyle }}>
                    {innerContent}
                  </button>
                ) : (
                  <div key={i} style={sharedStyle}>
                    {innerContent}
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {/* Triple outpost production bonus + domination countdown */}
      {hud?.tripleOutpostOwner && phase === 'playing' && (() => {
        const isPlayer = hud.tripleOutpostOwner === 'player'
        const progress = hud.dominationProgress ?? 0
        const secsLeft = Math.ceil((1 - progress) * 60)
        return (
          <div style={{
            position: 'absolute', top: 100, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{
                fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
                color: isPlayer ? '#ffd700' : '#ff4f7b',
                textShadow: `0 0 8px ${isPlayer ? '#ffd700' : '#ff4f7b'}`,
                background: 'rgba(0,0,0,0.4)', padding: '2px 10px', borderRadius: 4,
              }}>
                {isPlayer ? `⬡ +PROD · DOMINATION ${secsLeft}s` : `⚠ ENEMY DOMINATING ${secsLeft}s`}
              </span>
              {progress > 0 && (
                <div style={{ width: 120, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${progress * 100}%`, height: '100%',
                    background: isPlayer ? '#ffd700' : '#ff4f7b',
                    transition: 'width 0.5s linear',
                  }} />
                </div>
              )}
            </div>
          </div>
        )
      })()}

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
              animation: prefersReducedMotion ? 'none' : 'countdown-pop 0.9s ease-out forwards',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Outpost capture/loss notification */}
      {notification && (
        <div style={{
          position: 'absolute', top: isTouchDevice ? 92 : 76, left: 0, right: 0,
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
              fontSize: isTouchDevice ? 15 : 13,
              fontWeight: 'bold',
              letterSpacing: 2,
              textShadow: `0 0 12px ${notification.color}`,
              animation: prefersReducedMotion ? 'none' : 'notif-in 0.18s ease-out',
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
            position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
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
                ⚡ MORALE SURGE
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
                ⚡ LAST STAND
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
            const playerSupply = hud.players.player?.supplyUsed ?? 0
            const aiSupply = hud.players.ai?.supplyUsed ?? 0
            const supplyCap = hud.players.player?.supplyCap ?? 120
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
            const BASE_MS = 800 // base interval for 'basic' type; spawn type is now set per-building
            const OUTPOST_MS = 1200
            const playerTriple = hud.tripleOutpostOwner === 'player'
            const aiOutpostCount = Math.max(0, (hud.players.ai?.buildingCount ?? 0) - 1)
            const aiTriple = hud.tripleOutpostOwner === 'ai'
            const playerProd = ((1000/BASE_MS) + playerOutpostCount * (1000/OUTPOST_MS)) * (playerTriple ? 2 : 1)
            const aiProd = ((1000/800) + aiOutpostCount * (1000/OUTPOST_MS)) * (aiTriple ? 2 : 1)
            return (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: isTouchDevice ? '8px 16px' : '8px 32px',
                fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.55)',
                background: 'rgba(0,0,0,0.3)',
                padding: isTouchDevice ? '12px 16px' : '16px 28px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                maxWidth: isTouchDevice ? 'calc(100vw - 48px)' : undefined,
              }}>
                <span style={{ color: colorHex(PLAYER_COLOR), opacity: 0.8 }}>YOUR ARMY</span>
                <span style={{ color: colorHex(AI_COLOR), opacity: 0.8 }}>ENEMY ARMY</span>
                <span>{playerSpecks} specks</span>
                <span>{aiSpecks} specks</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{fmtTypes(playerTypes)}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{fmtTypes(aiTypes)}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>~{playerProd.toFixed(1)}/s prod</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>~{aiProd.toFixed(1)}/s prod</span>
                <span style={{ fontSize: 10, color: playerSupply >= supplyCap ? '#ff4f7b' : playerSupply >= 60 ? '#ffaa44' : undefined }}>
                  Supply: {Math.round(playerSupply)}/{supplyCap}
                </span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>
                  Supply: {Math.round(aiSupply)}/{supplyCap}
                </span>
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

      {/* Action bar — slim 52px strip at the bottom, replaces stacked command panels */}
      {phase === 'playing' && (
        <>
          {/* Building drawer — slides up above the bar when expanded */}
          {hud?.selectedBuilding && buildingPanelExpanded && (() => {
            const b = hud.selectedBuilding!
            const hpFrac = b.hp / b.maxHp
            const hpColor = hpFrac > 0.5 ? '#4af7c4' : hpFrac > 0.2 ? '#ffaa44' : '#ff4f7b'
            return (
              <div style={{
                position: 'absolute',
                bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(360px, calc(100vw - 32px))',
                background: 'rgba(0,0,0,0.88)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderBottom: 'none',
                borderRadius: '10px 10px 0 0',
                padding: '12px 16px',
                fontFamily: 'monospace',
                animation: prefersReducedMotion ? undefined : 'panel-slide-up 150ms ease',
                zIndex: 10,
                pointerEvents: 'auto',
              }}>
                {/* Type + HP */}
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  {b.typeId.toUpperCase()}
                </div>
                <div style={{ fontSize: 9, color: hpColor, letterSpacing: 1, marginBottom: 3 }}>
                  HP {Math.ceil(b.hp)} / {b.maxHp}
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${hpFrac * 100}%`, background: hpColor, borderRadius: 2, transition: 'width 150ms' }} />
                </div>
                {/* Fortify status */}
                {b.typeId === 'outpost' && b.ownerId === 'player' && (b.fortifyDuration ?? 0) > 0 && (
                  <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.65)', letterSpacing: 0.5, marginBottom: 4 }}>
                    {(b.fortifyDuration ?? 0) >= FORTIFY_TIME
                      ? '⚒ FORTIFIED — +25% DMG nearby'
                      : `⚒ ${Math.round(((b.fortifyDuration ?? 0) / FORTIFY_TIME) * 100)}% fortified`}
                  </div>
                )}
                {(b.typeId === 'base' || b.typeId === 'outpost') && b.ownerId === 'player' && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 8, letterSpacing: 1.5, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>SPAWNING</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {([
                        { type: 'basic', label: isTouchDevice ? 'BSC' : '1 BASIC', color: '#4af7c4', title: 'Basic — balanced, beats Dart' },
                        { type: 'heavy', label: isTouchDevice ? 'HVY' : '2 HEAVY', color: '#ff8844', title: 'Heavy — 5× HP, 2× damage, slow spawn, beats Basic' },
                        { type: 'scout', label: isTouchDevice ? 'DRT' : '3 DART', color: '#50c8ff', title: 'Dart — 2× speed, half damage, fast spawn, beats Heavy' },
                      ] as const).map(({ type, label, color, title }) => {
                        const active = (b.spawnTypeOverride ?? 'basic') === type
                        return (
                          <button
                            key={type}
                            title={title}
                            onClick={() => { navigator.vibrate?.(8); gameActions?.setSpawnType?.(type) }}
                            style={{
                              flex: 1,
                              padding: isTouchDevice ? '6px 4px' : '3px 7px',
                              fontSize: isTouchDevice ? 10 : 8,
                              cursor: 'pointer', letterSpacing: 0.5,
                              background: active ? `${color}22` : 'rgba(0,0,0,0.35)',
                              border: `1px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
                              borderRadius: 3,
                              color: active ? color : 'rgba(255,255,255,0.4)',
                              fontFamily: 'monospace',
                              minHeight: isTouchDevice ? 40 : 24,
                              fontWeight: active ? 700 : 400,
                              pointerEvents: 'auto',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Rally hint */}
                <div style={{ marginTop: 8, fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: 0.5 }}>
                  {isTouchDevice ? 'tap canvas to set rally' : 'left-click canvas to set rally'}
                </div>
                {/* Garrison panel */}
                {b.typeId === 'outpost' && b.ownerId === 'player' && (() => {
                  const garCount = b.garrisonCount ?? 0
                  return (
                    <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                      <div style={{ fontSize: 10, letterSpacing: 1.5, color: garCount >= 5 ? '#ff8844' : '#44aaff', opacity: 0.8, marginBottom: 5 }}>
                        GARRISON {garCount}/5{garCount >= 5 ? ' · FULL' : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => gameActions?.garrison?.(b.id)} disabled={garCount >= 5} style={{
                          flex: 1, padding: '4px 8px', fontSize: 10, letterSpacing: 1,
                          background: 'rgba(0,0,0,0.5)', border: `1px solid ${garCount >= 5 ? 'rgba(255,136,68,0.15)' : '#44aaff44'}`,
                          color: garCount >= 5 ? 'rgba(255,136,68,0.35)' : '#44aaff', cursor: garCount >= 5 ? 'default' : 'pointer', borderRadius: 4,
                          fontFamily: 'monospace', minHeight: 36,
                        }}>
                          <div>GARRISON</div>
                          <div style={{ opacity: 0.6, fontSize: 9 }}>selected specks</div>
                        </button>
                        {garCount > 0 && (
                          <button onClick={() => gameActions?.recallGarrison?.(b.id)} style={{
                            flex: 1, padding: '4px 8px', fontSize: 10, letterSpacing: 1,
                            background: 'rgba(0,0,0,0.5)', border: '1px solid #ff884444',
                            color: '#ff8844', cursor: 'pointer', borderRadius: 4,
                            fontFamily: 'monospace', minHeight: 36,
                          }}>
                            <div>RECALL</div>
                            <div style={{ opacity: 0.6, fontSize: 9 }}>{garCount} specks</div>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
                {/* Research panel */}
                {b.typeId === 'outpost' && b.ownerId === 'player' && (b.fortifyDuration ?? 0) >= 20000 && (() => {
                  if (b.researchedUpgrade) {
                    const researchDescs: Record<string, string> = { carapace: '+1 HP', blades: '+15% DMG', afterburners: '+15% SPD' }
                    return (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, letterSpacing: 1, color: '#44aaff' }}>
                        <span>⚗</span><span>{b.researchedUpgrade.toUpperCase()} — all units {researchDescs[b.researchedUpgrade] ?? 'buffed'}</span>
                      </div>
                    )
                  }
                  const upgrades: Array<{ id: 'carapace' | 'blades' | 'afterburners'; label: string; desc: string; color: string }> = [
                    { id: 'carapace', label: 'CARAPACE', desc: '+1 HP', color: '#44ff88' },
                    { id: 'blades', label: 'BLADES', desc: '+15% DMG', color: '#ff4f7b' },
                    { id: 'afterburners', label: 'AFTRBRN', desc: '+15% SPD', color: '#44aaff' },
                  ]
                  return (
                    <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.45)' }}>⚗ RESEARCH</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 }}>global · pick 1</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {upgrades.map(u => (
                          <button key={u.id} onClick={() => gameActions?.researchUpgrade?.(b.id, u.id)} style={{
                            flex: 1, padding: '4px 4px', fontSize: 9, letterSpacing: 0.5,
                            background: 'rgba(0,0,0,0.5)', border: `1px solid ${u.color}44`,
                            color: u.color, cursor: 'pointer', borderRadius: 4,
                            fontFamily: 'monospace', minHeight: 40,
                          }}>
                            <div>{u.label}</div>
                            <div style={{ opacity: 0.7, fontSize: 8 }}>{u.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* 52px action bar */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            paddingLeft: 10,
            paddingRight: 10,
            background: 'rgba(0,0,0,0.62)',
            WebkitBackdropFilter: 'blur(10px)',
            backdropFilter: 'blur(10px)',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 5,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>
            {/* Building chip */}
            {hud?.selectedBuilding && (() => {
              const b = hud.selectedBuilding!
              const hpFrac = b.hp / b.maxHp
              const hpColor = hpFrac > 0.5 ? '#4af7c4' : hpFrac > 0.2 ? '#ffaa44' : '#ff4f7b'
              return (
                <button
                  onClick={() => { setBuildingPanelExpanded(v => !v); navigator.vibrate?.(8) }}
                  style={{
                    height: 36, borderRadius: 18, padding: '0 12px',
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: buildingPanelExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.45)',
                    border: `1px solid ${buildingPanelExpanded ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
                    fontSize: 10, letterSpacing: 1,
                    color: 'rgba(255,255,255,0.85)',
                    cursor: 'pointer', pointerEvents: 'auto',
                    fontFamily: 'monospace', flexShrink: 0,
                    transition: 'background 150ms, border-color 150ms',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: hpColor, flexShrink: 0 }} />
                  <span>{b.typeId.toUpperCase()}</span>
                  <span style={{ fontSize: 8, opacity: 0.5 }}>{buildingPanelExpanded ? '▲' : '▼'}</span>
                </button>
              )
            })()}
            {/* Center spacer */}
            <div style={{ flex: 1 }} />
            {/* Action buttons — when specks selected */}
            {(hud?.selectedSpeckCount ?? 0) > 0 && (
              <>
                {([
                  { label: 'Stop', icon: '■', key: 'S', action: () => gameActions?.stop?.() },
                  { label: 'Hold', icon: '⊕', key: 'H', action: () => gameActions?.hold?.() },
                  { label: 'Defend', icon: '🛡', key: 'D', action: () => gameActions?.defend?.() },
                  { label: 'Advance', icon: '→', key: 'N', action: () => gameActions?.advance?.() },
                  { label: 'Rush', icon: '⚡', key: 'B', action: () => gameActions?.rush?.() },
                  { label: 'Guard', icon: '◈', key: 'G', action: () => gameActions?.guard?.() },
                ] as const).map(({ label, icon, key, action }) => (
                  <button
                    key={label}
                    onClick={() => { navigator.vibrate?.(8); action() }}
                    title={`${label} [${key}]`}
                    style={{
                      width: 44, height: 44, borderRadius: 8,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 1,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#ddd', fontSize: 15,
                      cursor: 'pointer', pointerEvents: 'auto', flexShrink: 0,
                    }}
                  >
                    <span>{icon}</span>
                    {!isTouchDevice && <span style={{ fontSize: 7, color: '#888', letterSpacing: 0.5 }}>[{key}]</span>}
                  </button>
                ))}
                {/* Turret build button */}
                {(() => {
                  const selectedCount = hud?.selectedSpeckCount ?? 0
                  const TURRET_COST = 20
                  const canBuild = selectedCount >= TURRET_COST
                  const barFill = Math.min(1, selectedCount / TURRET_COST)
                  return (
                    <button
                      onClick={() => { if (canBuild) { (gameActions as { buildTurret?: () => void } | null)?.buildTurret?.(); navigator.vibrate?.(15) } }}
                      title={canBuild ? 'Build Turret' : `Build Turret (${selectedCount}/${TURRET_COST})`}
                      style={{
                        width: 44, height: 44, borderRadius: 8,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 1,
                        background: canBuild ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${canBuild ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: canBuild ? '#ffd700' : 'rgba(255,255,255,0.3)',
                        fontSize: 14, cursor: canBuild ? 'pointer' : 'default',
                        opacity: canBuild ? 1 : 0.55,
                        pointerEvents: 'auto', flexShrink: 0, position: 'relative', overflow: 'hidden',
                      }}
                    >
                      <span>◆</span>
                      {!canBuild && (
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0,
                          height: 2, width: `${barFill * 100}%`,
                          background: '#4af7c4', transition: 'width 200ms',
                        }} />
                      )}
                      {!isTouchDevice && <span style={{ fontSize: 7, color: canBuild ? '#ffd700aa' : '#888', letterSpacing: 0.5 }}>BLD</span>}
                    </button>
                  )
                })()}
                {/* Touch-only utility buttons */}
                {isTouchDevice && (
                  <>
                    <button
                      onClick={() => { gameActions?.clearSelection?.(); navigator.vibrate?.(8) }}
                      title="Clear selection"
                      style={{
                        width: 44, height: 44, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,79,123,0.08)',
                        border: '1px solid rgba(255,79,123,0.3)',
                        color: 'rgba(255,120,120,0.8)',
                        fontSize: 15, cursor: 'pointer', pointerEvents: 'auto', flexShrink: 0,
                      }}
                    >✗</button>
                    <button
                      onClick={() => {
                        const next = !touchSelectActive
                        setTouchSelectActive(next)
                        if (next) { navigator.vibrate?.([10, 20, 10]); gameActions?.activateSelectMode?.() }
                      }}
                      title="Drag-select"
                      style={{
                        width: 44, height: 44, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: touchSelectActive ? 'rgba(74,247,196,0.25)' : 'rgba(0,0,0,0.35)',
                        border: touchSelectActive ? '1px solid rgba(74,247,196,0.9)' : '1px solid rgba(255,255,255,0.2)',
                        color: touchSelectActive ? '#4af7c4' : 'rgba(255,255,255,0.5)',
                        fontSize: 15, cursor: 'pointer', pointerEvents: 'auto', flexShrink: 0,
                      }}
                    >⊞</button>
                  </>
                )}
              </>
            )}
            {/* Right spacer */}
            <div style={{ flex: 1 }} />
            {/* Selection count chip */}
            {(hud?.selectedSpeckCount ?? 0) > 0 && (
              <div style={{
                height: 36, borderRadius: 18, padding: '0 12px',
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 10, letterSpacing: 1,
                color: 'rgba(255,255,255,0.8)', flexShrink: 0,
              }}>
                <span>{hud?.selectedSpeckCount}</span>
                {hud?.selectedComposition && Object.entries(hud.selectedComposition.types).map(([typeId, count]) => {
                  if (!count) return null
                  const dotColor = typeId === 'heavy' ? '#ffa032' : typeId === 'scout' ? '#50c8ff' : '#4af7c4'
                  return (
                    <span key={typeId} style={{
                      width: 6, height: 6, borderRadius: typeId === 'heavy' ? 1 : '50%',
                      background: dotColor, flexShrink: 0, display: 'inline-block',
                      transform: typeId === 'heavy' ? 'rotate(45deg)' : 'none',
                    }} />
                  )
                })}
                {hud?.selectedComposition && (
                  hud.selectedComposition.legendCount > 0 ? <span style={{ fontSize: 9, color: '#cc44ff' }}>✦✦</span>
                  : hud.selectedComposition.eliteCount > 0 ? <span style={{ fontSize: 9, color: '#ffd700' }}>✦</span>
                  : hud.selectedComposition.veteranCount > 0 ? <span style={{ fontSize: 9, color: '#ffd70088' }}>⭐</span>
                  : null
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mobile action buttons — bottom right */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))', right: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
          pointerEvents: 'auto',
        }}>
          {/* Supply indicator — above spawn buttons */}
          {isTouchDevice && hud && (() => {
            const supplyUsed = hud.players.player?.supplyUsed ?? 0
            const supplyCap = hud.players.player?.supplyCap ?? 120
            const SOFT_CAP = 60
            const atHardCap = supplyUsed >= supplyCap
            const inPressure = supplyUsed >= SOFT_CAP
            const color = atHardCap ? '#ff4f7b' : inPressure ? '#ffaa44' : '#4af7c4'
            return (
              <div style={{ fontSize: 9, letterSpacing: 1, color, opacity: 0.75, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, supplyUsed / supplyCap * 100)}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
                </div>
                <span style={{ color: atHardCap ? '#ff4f7b' : inPressure ? '#ffaa44' : 'rgba(255,255,255,0.45)' }}>
                  {atHardCap ? 'SUP CAP!' : inPressure ? `SUP ${Math.round(supplyUsed)}` : `SUP ${Math.round(supplyUsed)}`}
                </span>
              </div>
            )
          })()}
          {/* Spawn type quick-select removed — set per-building via building panel */}
          {/* Stance indicator — tappable on mobile to cycle stance */}
          <div
            onClick={isTouchDevice ? (() => { navigator.vibrate?.(12); gameActions?.cycleStance?.() }) : undefined}
            style={{
              fontSize: 11, letterSpacing: 1.5, opacity: 0.8,
              color: stance === 'aggressive' ? '#ff4f7b' : stance === 'hold' ? '#aaaaaa' : '#4af7c4',
              textAlign: 'right',
              ...(isTouchDevice ? { cursor: 'pointer', padding: '4px 8px', minHeight: 44, display: 'flex', alignItems: 'center' } : {}),
            }}
          >
            {stance === 'aggressive' ? 'AGGRO' : stance === 'hold' ? 'HOLD' : 'DEF'}
            {isTouchDevice
              ? <span style={{ opacity: 0.4, marginLeft: 4, fontSize: 9 }}>tap</span>
              : <span style={{ opacity: 0.5, marginLeft: 4 }}>[Z]</span>}
          </div>
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end',
          }}>
          <button
            onClick={() => { navigator.vibrate?.(12); gameActions.defend?.() }}
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
            onClick={() => { navigator.vibrate?.(12); gameActions.advance?.() }}
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
            {isTouchDevice ? '→ ADV' : '→ N'}
          </button>
          <button
            onClick={() => { navigator.vibrate?.(20); gameActions.rush?.() }}
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
            {isTouchDevice ? '⚡ RUSH' : '⚡ B'}
          </button>
          {(() => {
            const surgeActive = (hud?.surgeDuration ?? 0) > 0
            const surgeCd = hud?.surgeCooldown ?? 0
            const surgeReady = !surgeActive && surgeCd <= 0
            return (
              <button
                onClick={() => { if (surgeReady) { navigator.vibrate?.(30); gameActions.surge?.() } }}
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
                    ? `${isTouchDevice ? 'SURGE' : 'Q'} ${Math.ceil(surgeCd / 1000)}s`
                    : isTouchDevice ? '⚡ SURGE' : '★ Q'}
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
                onClick={() => { if (ready) { navigator.vibrate?.(30); gameActions.sacrifice?.() } }}
                title="[F] Sacrifice 10 specks → repair +15 HP base (20s cooldown)"
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
                {cd > 0 ? `${isTouchDevice ? 'HEAL' : 'F'} ${Math.ceil(cd / 1000)}s` : isTouchDevice ? '🔧 HEAL' : '🔧 F'}
              </button>
            )
          })()}
          {(() => {
            const cmd = hud?.commander
            const respawnMs = hud?.commanderRespawnMs ?? 0
            if (!cmd || cmd.level < 2) {
              if (respawnMs > 0) {
                return (
                  <div style={{
                    padding: '8px 12px',
                    fontSize: 11,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,215,0,0.25)',
                    borderRadius: 20,
                    color: 'rgba(255,215,0,0.5)',
                    letterSpacing: 1,
                    fontFamily: 'monospace',
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    ★ {Math.ceil(respawnMs / 1000)}s
                  </div>
                )
              }
              return null
            }
            const cd = cmd.abilityCooldown
            const active = cmd.abilityActive > 0
            const ready = cd <= 0 && !active
            const isLastStand = cmd.level >= 3
            const baseColor = isLastStand ? '#00ffcc' : '#ffd700'
            return (
              <button
                onClick={() => { if (ready) { navigator.vibrate?.([30, 40, 50]); gameActions.commanderAbility?.() } }}
                title={`[Y] ${isLastStand ? 'Last Stand' : 'Battle Roar'} — ${isLastStand ? 'invuln + 3× dmg + speed (60s)' : 'stun enemies 80px (20s)'}`}
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  cursor: ready ? 'pointer' : 'default',
                  background: active ? `${baseColor}33` : ready ? `${baseColor}11` : 'rgba(0,0,0,0.3)',
                  border: active ? `1px solid ${baseColor}` : ready ? `1px solid ${baseColor}88` : `1px solid ${baseColor}30`,
                  borderRadius: 20,
                  color: active ? baseColor : ready ? `${baseColor}cc` : `${baseColor}50`,
                  letterSpacing: 1,
                  minHeight: 44,
                  fontFamily: 'monospace',
                  opacity: ready || active ? 1 : 0.6,
                  animation: active && !prefersReducedMotion ? 'pulse-red 0.4s ease-in-out infinite alternate' : 'none',
                }}
              >
                {active
                  ? `${isLastStand ? '★★' : '★'} ${Math.ceil(cmd.abilityActive / 1000)}s`
                  : cd > 0
                    ? `${isTouchDevice ? (isLastStand ? 'LAST' : 'ROAR') : 'Y'} ${Math.ceil(cd / 1000)}s`
                    : isTouchDevice
                      ? `${isLastStand ? '★★ LAST' : '★ ROAR'}`
                      : `${isLastStand ? '★★' : '★'} Y`}
              </button>
            )
          })()}
          <button
            onClick={() => { navigator.vibrate?.(8); gameActions.clearRally?.() }}
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
          {/* Control group buttons — touch only */}
          {isTouchDevice && (() => {
            const selectedSpeckCount = hud?.selectedSpeckCount ?? 0
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: 4 }}>
                <div style={{ fontSize: 8, letterSpacing: 1.5, color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>GROUPS</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([0, 1, 2] as const).map((i) => {
                    const slot = i + 1
                    const savedCount = controlGroupSizes[i]
                    const isSaveMode = selectedSpeckCount > 0
                    const isEmpty = savedCount === 0
                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          if (isSaveMode) {
                            gameActions?.saveControlGroup?.(slot)
                            setControlGroupSizes(prev => {
                              const n = [...prev] as [number, number, number]
                              n[i] = selectedSpeckCount
                              return n
                            })
                            navigator.vibrate?.([10, 30, 10])
                          } else {
                            if (isEmpty) return
                            gameActions?.recallControlGroup?.(slot)
                            navigator.vibrate?.(15)
                          }
                        }}
                        style={{
                          pointerEvents: 'auto',
                          padding: '8px',
                          fontSize: 10,
                          cursor: isSaveMode ? 'pointer' : isEmpty ? 'default' : 'pointer',
                          minHeight: 44,
                          minWidth: 48,
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          letterSpacing: 0.5,
                          textAlign: 'center',
                          lineHeight: 1.3,
                          opacity: !isSaveMode && isEmpty ? 0.4 : 1,
                          background: isSaveMode
                            ? 'rgba(74,247,196,0.08)'
                            : 'rgba(0,0,0,0.35)',
                          border: isSaveMode
                            ? '1px solid rgba(74,247,196,0.6)'
                            : isEmpty
                              ? '1px solid rgba(255,255,255,0.1)'
                              : '1px solid rgba(255,255,255,0.3)',
                          color: isSaveMode ? '#4af7c4' : isEmpty ? 'rgba(255,255,255,0.3)' : '#fff',
                        }}
                      >
                        {isSaveMode
                          ? <><div style={{ fontWeight: 700 }}>SAVE</div><div>G{slot}</div></>
                          : <><div style={{ fontWeight: 700 }}>G{slot}</div><div style={{ fontSize: 9, opacity: 0.7 }}>({savedCount})</div></>
                        }
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
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
          <div style={{ position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Force ratio bar */}
            {total >= 4 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: isTouchDevice ? 11 : 9, letterSpacing: 1, color: colorHex(PLAYER_COLOR), opacity: 0.7, minWidth: 20, textAlign: 'right' }}>
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
                <span style={{ fontSize: isTouchDevice ? 11 : 9, letterSpacing: 1, color: colorHex(AI_COLOR), opacity: 0.7, minWidth: 20 }}>
                  {aiSpecks}
                </span>
              </div>
            )}
            {/* Production rate */}
            {(hud.spawnRates?.player ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: isTouchDevice ? 11 : 9, color: colorHex(PLAYER_COLOR), opacity: 0.6, minWidth: 20, textAlign: 'right' }}>
                  {hud.spawnRates.player}/m
                </span>
                <div style={{ width: 100, textAlign: 'center', fontSize: isTouchDevice ? 10 : 8, letterSpacing: 0.5, color: 'rgba(255,255,255,0.3)' }}>
                  ⚡prod
                </div>
                <span style={{ fontSize: isTouchDevice ? 11 : 9, color: colorHex(AI_COLOR), opacity: 0.6, minWidth: 20 }}>
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
                    {playerHeavy > 0 && <span style={{ fontSize: isTouchDevice ? 10 : 8, color: '#ffa032', opacity: 0.7 }}>⬡{playerHeavy}</span>}
                  </div>
                  <div style={{ width: 100, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${Math.round(playerHeavyFrac * 100)}%`,
                      background: '#ffa032', opacity: 0.5, borderRadius: 2,
                    }} />
                  </div>
                  <div title={`Enemy: ${aiHeavy}⬡ heavy, ${aiBasic}· basic`} style={{ width: 20 }}>
                    {aiHeavy > 0 && <span style={{ fontSize: isTouchDevice ? 10 : 8, color: '#ff6b6b', opacity: 0.7 }}>⬡{aiHeavy}</span>}
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
                <div style={{ display: 'flex', gap: 8, fontSize: isTouchDevice ? 11 : 9, letterSpacing: 0.5 }}>
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
            <div style={{ display: 'flex', gap: 10, fontSize: isTouchDevice ? 12 : 10, letterSpacing: 0.5 }}>
              <span style={{ color: colorHex(PLAYER_COLOR), opacity: 0.7 }}>↑{kills} ↓{losses}</span>
              {aiBaseHpVal > 0 && (() => {
                const aiBase = hud?.minimap?.buildings?.find(b => b.typeId === 'base' && b.ownerId === 'ai')
                return (
                  <span
                    onClick={isTouchDevice && aiBase ? () => { gameActions?.panCamera?.(aiBase.x, aiBase.y); navigator.vibrate?.(15) } : undefined}
                    style={{
                      color: aiBaseColor, opacity: 0.8,
                      ...(isTouchDevice && aiBase ? { cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' } : {}),
                    }}
                    title={isTouchDevice ? 'Tap to jump to enemy base' : undefined}
                  >
                    ENEMY BASE {Math.round(aiBaseHpFrac * 100)}%
                  </span>
                )
              })()}
              {playerBaseHpVal > 0 && (
                <span
                  onClick={isTouchDevice ? () => { gameActions?.snapToBase?.(); navigator.vibrate?.(15) } : undefined}
                  style={{
                    color: hpFrac < 0.3 ? '#ff4f7b' : 'rgba(255,255,255,0.4)', opacity: 0.8,
                    ...(isTouchDevice ? { cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' } : {}),
                  }}
                  title={isTouchDevice ? 'Tap to jump to your base' : undefined}
                >
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: isTouchDevice ? 11 : 9, letterSpacing: 0.5 }}>
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

      {/* Long-press ring */}
      {longPressRing && isTouchDevice && (
        <svg
          key={`lp-${longPressRing.x}-${longPressRing.y}`}
          style={{
            position: 'fixed',
            left: longPressRing.x - 24,
            top: longPressRing.y - 24,
            width: 48,
            height: 48,
            pointerEvents: 'none',
            zIndex: 200,
            overflow: 'visible',
          }}
        >
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke="rgba(255, 100, 50, 0.9)"
            strokeWidth="3"
            strokeDasharray="126"
            strokeDashoffset="126"
            transform="rotate(-90, 24, 24)"
            style={{ animation: 'long-press-ring 500ms linear forwards' }}
            onAnimationEnd={() => setLongPressRing(null)}
          />
        </svg>
      )}

      {/* Tap ripple */}
      {tapRippleState && isTouchDevice && (
        <div
          key={tapRippleState.key}
          style={{
            position: 'fixed',
            left: tapRippleState.x - 30,
            top: tapRippleState.y - 30,
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px solid rgba(74, 247, 196, 0.8)',
            pointerEvents: 'none',
            zIndex: 200,
            animation: 'tap-ripple-expand 300ms ease-out forwards',
          }}
          onAnimationEnd={() => setTapRippleState(null)}
        />
      )}

    </div>
  )
}

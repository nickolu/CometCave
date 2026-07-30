'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GameInstance } from './game-instance'
import { useSpeckWarsStore } from './store'
import { HUD } from './components/hud'
import { PhaseRouter } from './components/phase-router'

function usePortraitMode() {
  const [isPortrait, setIsPortrait] = useState(false)

  useEffect(() => {
    const check = () => {
      const portrait = window.innerWidth < window.innerHeight && window.innerWidth < 768
      const hasTouch = navigator.maxTouchPoints > 0
      setIsPortrait(portrait && hasTouch)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return isPortrait
}

function PortraitNudge() {
  const [dismissed, setDismissed] = useState(false)
  const isPortrait = usePortraitMode()
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Auto-show again if user rotates back to portrait after dismissing
  const wasDismissedInPortrait = useRef(false)
  useEffect(() => {
    if (!isPortrait) wasDismissedInPortrait.current = false
  }, [isPortrait])

  const dismiss = useCallback(() => {
    setDismissed(true)
    wasDismissedInPortrait.current = true
  }, [])

  if (!isPortrait || dismissed) return null

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        background: 'rgba(1,2,8,0.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 32,
        pointerEvents: 'auto',
      }}
    >
      {/* Rotate icon — CSS-animated, disabled under prefers-reduced-motion */}
      <div style={{
        fontSize: 64,
        animation: prefersReducedMotion ? 'none' : 'speckRotateHint 2s ease-in-out infinite',
      }}>
        📱
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#4af7c4',
          letterSpacing: 1, marginBottom: 8,
        }}>
          Rotate for Battle
        </div>
        <div style={{
          fontSize: 13, color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.5, maxWidth: 240,
        }}>
          Speck Wars plays best in landscape. Rotate your device sideways for the full battlefield.
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          marginTop: 8,
          padding: '10px 24px',
          fontSize: 13, fontWeight: 600,
          background: 'rgba(74,247,196,0.1)',
          border: '1px solid rgba(74,247,196,0.35)',
          borderRadius: 6, color: '#4af7c4',
          cursor: 'pointer', letterSpacing: 0.5,
          minHeight: 44,
          pointerEvents: 'auto',
        }}
      >
        Play in Portrait Anyway
      </button>
      <style>{`
        @keyframes speckRotateHint {
          0%, 100% { transform: rotate(0deg); }
          40% { transform: rotate(-90deg); }
          60% { transform: rotate(-90deg); }
        }
      `}</style>
    </div>
  )
}

function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<GameInstance | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // Own the canvas element rather than letting React reuse one across mounts. Once a
    // Pixi Application is destroyed its WebGL context is gone, and initialising a new
    // one on the same canvas yields a context whose shaders fail to compile — a blank
    // canvas. React StrictMode mounts, tears down and remounts this effect in
    // development, so that path is hit on every dev page load.
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')  // purely visual — HUD handles screen-reader interaction
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    // Prevent browser from intercepting touch gestures (context menu, text selection, scroll)
    // so long-press attack-move and pinch-zoom work correctly on mobile.
    canvas.style.touchAction = 'none'
    canvas.style.userSelect = 'none'
    ;(canvas.style as CSSStyleDeclaration & { webkitUserSelect: string }).webkitUserSelect = 'none'
    host.appendChild(canvas)

    const game = new GameInstance(canvas)
    gameRef.current = game
    game.start()

    return () => {
      game.destroy()
      gameRef.current = null
      canvas.remove()
    }
  }, [])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: [
        'radial-gradient(ellipse at 25% 75%, rgba(15,5,40,0.9) 0%, transparent 55%)',
        'radial-gradient(ellipse at 75% 25%, rgba(5,15,35,0.7) 0%, transparent 50%)',
        'radial-gradient(ellipse at 50% 50%, rgba(2,6,18,1) 0%, #010208 100%)',
      ].join(', '),
    }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <HUD />
      <PortraitNudge />
    </div>
  )
}

export function SpeckWarsGame() {
  const phase = useSpeckWarsStore(s => s.phase)

  useEffect(() => {
    document.body.classList.add('game-active')
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.classList.remove('game-active')
      document.documentElement.style.overscrollBehavior = ''
      document.body.style.overscrollBehavior = ''
    }
  }, [])

  return (
    <div role="application" aria-label="Speck Wars" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PhaseRouter>
        {(phase === 'playing' || phase === 'paused') && <GameCanvas />}
      </PhaseRouter>
    </div>
  )
}

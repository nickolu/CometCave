'use client'

import { useEffect, useRef } from 'react'
import { GameInstance } from './game-instance'
import { useSpeckWarsStore } from './store'
import { HUD } from './components/hud'
import { PhaseRouter } from './components/phase-router'

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
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
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
    </div>
  )
}

export function SpeckWarsGame() {
  const phase = useSpeckWarsStore(s => s.phase)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PhaseRouter>
        {(phase === 'playing' || phase === 'paused') && <GameCanvas />}
      </PhaseRouter>
    </div>
  )
}

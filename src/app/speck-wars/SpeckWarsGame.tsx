'use client'

import { useEffect, useRef } from 'react'
import { GameInstance } from './game-instance'
import { useSpeckWarsStore } from './store'
import { HUD } from './components/hud'
import { PhaseRouter } from './components/phase-router'
import { Minimap } from './components/minimap'

function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameInstance | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const game = new GameInstance(canvas)
    gameRef.current = game
    game.start()

    return () => {
      game.destroy()
      gameRef.current = null
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
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <HUD />
      <Minimap gameRef={gameRef} />
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

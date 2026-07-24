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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
        {phase === 'playing' && <GameCanvas />}
      </PhaseRouter>
    </div>
  )
}

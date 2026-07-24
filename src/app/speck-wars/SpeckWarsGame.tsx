'use client'

import { useEffect, useRef } from 'react'
import { GameInstance } from './game-instance'

export function SpeckWarsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const game = new GameInstance(canvas)
    game.start()

    return () => {
      game.destroy()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: 'rgba(255,255,255,0.8)',
          fontSize: 24,
          fontWeight: 'bold',
          pointerEvents: 'none',
        }}
      >
        Speck Wars
      </div>
    </div>
  )
}

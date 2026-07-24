'use client'
import { useEffect, useRef } from 'react'
import type { GameInstance } from '../game-instance'
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_COLOR, AI_COLOR } from '../domain/constants'

const MAP_W = 160
const MAP_H = 160
const SCALE_X = MAP_W / WORLD_WIDTH
const SCALE_Y = MAP_H / WORLD_HEIGHT

function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

interface MinimapProps {
  gameRef: React.RefObject<GameInstance | null>
}

export function Minimap({ gameRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let rafId: number
    let lastDraw = 0

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw)
      if (now - lastDraw < 100) return  // ~10fps
      lastDraw = now

      const canvas = canvasRef.current
      const game = gameRef.current
      if (!canvas || !game) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const sim = game.getSim()
      const camera = game.getCamera()

      // Clear
      ctx.clearRect(0, 0, MAP_W, MAP_H)
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(0, 0, MAP_W, MAP_H)

      // Draw specks (sample every 4th for performance)
      const playerColor = hexColor(PLAYER_COLOR)
      const aiColor = hexColor(AI_COLOR)
      for (let i = 0; i < sim.speckCount; i += 4) {
        if (!sim.speckIds[i] || !sim.speckMeta[i]) continue
        const ownerId = sim.speckMeta[i]!.ownerId
        ctx.fillStyle = ownerId === 'player' ? playerColor : aiColor
        ctx.fillRect(
          sim.speckX[i] * SCALE_X,
          sim.speckY[i] * SCALE_Y,
          1.5, 1.5
        )
      }

      // Draw buildings
      const neutralColor = '#888888'
      for (const building of Object.values(sim.buildings)) {
        ctx.fillStyle = building.ownerId === 'player' ? playerColor
          : building.ownerId === 'ai' ? aiColor
          : neutralColor
        const bx = building.x * SCALE_X
        const by = building.y * SCALE_Y
        const buildingRadius = building.typeId === 'outpost' ? 3 : 4
        ctx.beginPath()
        ctx.arc(bx, by, buildingRadius, 0, Math.PI * 2)
        ctx.fill()
        // HP ring
        const hpFrac = building.hp / building.maxHp
        ctx.strokeStyle = hpFrac > 0.5 ? '#44ff88' : '#ff4444'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(bx, by, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac)
        ctx.stroke()
      }

      // Draw viewport rectangle
      // The camera maps world→screen as: screenX = worldX * zoom + camera.x
      // Use window dimensions as the screen size approximation
      const sw = window.innerWidth
      const sh = window.innerHeight
      const wLeft = (0 - camera.x) / camera.zoom
      const wTop = (0 - camera.y) / camera.zoom
      const wRight = (sw - camera.x) / camera.zoom
      const wBottom = (sh - camera.y) / camera.zoom

      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(
        wLeft * SCALE_X,
        wTop * SCALE_Y,
        (wRight - wLeft) * SCALE_X,
        (wBottom - wTop) * SCALE_Y
      )

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, MAP_W, MAP_H)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [gameRef])

  return (
    <canvas
      ref={canvasRef}
      width={MAP_W}
      height={MAP_H}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: MAP_W,
        height: MAP_H,
        borderRadius: 4,
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  )
}

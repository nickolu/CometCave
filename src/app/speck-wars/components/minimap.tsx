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
      const nowMs = Date.now()
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
        // Capture alert: pulsing colored ring around outpost being captured by enemy
        if (building.typeId === 'outpost' && building.captureSide && building.captureSide !== 'neutral') {
          const isEnemyCapturing = building.captureSide === 'ai'
          if (isEnemyCapturing || (building.ownerId === 'ai' && building.captureSide === 'player')) {
            const pulse = 0.4 + 0.6 * Math.abs(Math.sin(nowMs / 250))
            const captureColor = building.captureSide === 'player' ? playerColor : aiColor
            ctx.strokeStyle = captureColor
            ctx.lineWidth = 1.5
            ctx.globalAlpha = pulse * 0.85
            ctx.beginPath()
            ctx.arc(bx, by, 7, 0, Math.PI * 2)
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }

      // Draw command group rally markers (numbered crosshairs)
      if (sim.commandGroupRallies.size > 0) {
        ctx.lineWidth = 1.5
        for (const [groupId, rally] of sim.commandGroupRallies) {
          const rx = rally.x * SCALE_X
          const ry = rally.y * SCALE_Y
          ctx.strokeStyle = playerColor
          ctx.globalAlpha = 0.8
          ctx.beginPath()
          ctx.moveTo(rx - 4, ry); ctx.lineTo(rx + 4, ry)
          ctx.moveTo(rx, ry - 4); ctx.lineTo(rx, ry + 4)
          ctx.stroke()
          // Number badge
          ctx.globalAlpha = 0.9
          ctx.fillStyle = playerColor
          ctx.font = 'bold 7px monospace'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(String(groupId), rx + 4, ry - 8)
        }
        ctx.globalAlpha = 1
      }

      // Draw AI rally point (where enemy force is heading)
      const aiRp = sim.rallyPoints['ai']
      if (aiRp) {
        const rx = aiRp.x * SCALE_X
        const ry = aiRp.y * SCALE_Y
        ctx.strokeStyle = aiColor
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.45
        ctx.beginPath()
        ctx.moveTo(rx - 3, ry); ctx.lineTo(rx + 3, ry)
        ctx.moveTo(rx, ry - 3); ctx.lineTo(rx, ry + 3)
        ctx.stroke()
        ctx.globalAlpha = 1
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

  const isDragging = useRef(false)
  const didDrag = useRef(false)

  const getWorldCoords = (clientX: number, clientY: number, rect: DOMRect) => {
    const mx = clientX - rect.left
    const my = clientY - rect.top
    return { wx: mx / SCALE_X, wy: my / SCALE_Y }
  }

  const handleMouseDown = () => {
    isDragging.current = true
    didDrag.current = false
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return
    const game = gameRef.current
    if (!game) return
    didDrag.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    const { wx, wy } = getWorldCoords(e.clientX, e.clientY, rect)
    game.panCameraTo(wx, wy)
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (didDrag.current) return
    const game = gameRef.current
    if (!game) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { wx, wy } = getWorldCoords(e.clientX, e.clientY, rect)
    game.panCameraTo(wx, wy)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    isDragging.current = true
    didDrag.current = false
    e.preventDefault()
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const game = gameRef.current
    if (!game || !isDragging.current) return
    didDrag.current = true
    const touch = e.touches[0]
    if (!touch) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { wx, wy } = getWorldCoords(touch.clientX, touch.clientY, rect)
    game.panCameraTo(wx, wy)
    e.preventDefault()
  }

  const handleTouchEnd = () => {
    isDragging.current = false
  }

  return (
    <canvas
      ref={canvasRef}
      width={MAP_W}
      height={MAP_H}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      title="Click or drag to pan camera"
      aria-label="Minimap — click or drag to pan camera"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: MAP_W,
        height: MAP_H,
        borderRadius: 4,
        imageRendering: 'pixelated',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
    />
  )
}

'use client'
import { useEffect, useRef } from 'react'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

function firstPaletteColor(palette: Record<string, string>): string {
  const vals = Object.values(palette)
  return vals.length > 0 ? vals[0] : '#888888'
}

interface Props {
  blueprints: CreatureBlueprint[]
  aliveIds: Set<string>
  foodWeb: Record<string, string[]>  // eaterId → preyIds
}

export function SymbiosisWeb({ blueprints, aliveIds, foodWeb }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const radius = Math.min(W, H) / 2 - 24

    ctx.clearRect(0, 0, W, H)

    // Only show alive species that appear in food web relationships
    const relatedIds = new Set<string>()
    for (const [eaterId, preyIds] of Object.entries(foodWeb)) {
      if (aliveIds.has(eaterId)) {
        relatedIds.add(eaterId)
        for (const preyId of preyIds) {
          if (aliveIds.has(preyId)) relatedIds.add(preyId)
        }
      }
    }

    // Compute mutualism relationships inside effect to avoid stale closure issues
    const mutualismLinks: Array<{ from: string; to: string }> = []
    for (const helper of blueprints) {
      if (!helper.aura?.helps?.length || !aliveIds.has(helper.id)) continue
      for (const helpee of blueprints) {
        if (helpee.id === helper.id || !aliveIds.has(helpee.id)) continue
        if (helper.aura.helps.some(tag => helpee.tags.includes(tag))) {
          relatedIds.add(helper.id)
          relatedIds.add(helpee.id)
          mutualismLinks.push({ from: helper.id, to: helpee.id })
        }
      }
    }

    const nodes = blueprints.filter(bp => relatedIds.has(bp.id))

    if (nodes.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No relationships observed yet', cx, cy)
      return
    }

    // Position nodes on a circle
    const positions = new Map<string, { x: number; y: number }>()
    nodes.forEach((bp, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      positions.set(bp.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      })
    })

    // Draw predator→prey edges (solid lines)
    for (const [eaterId, preyIds] of Object.entries(foodWeb)) {
      const from = positions.get(eaterId)
      if (!from) continue
      for (const preyId of preyIds) {
        const to = positions.get(preyId)
        if (!to) continue
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.strokeStyle = 'rgba(239,68,68,0.5)'  // red for predation
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.stroke()
        // Arrow tip
        const angle = Math.atan2(to.y - from.y, to.x - from.x)
        const len = Math.hypot(to.x - from.x, to.y - from.y)
        const ax = from.x + Math.cos(angle) * (len - 8)
        const ay = from.y + Math.sin(angle) * (len - 8)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - 6 * Math.cos(angle - 0.4), ay - 6 * Math.sin(angle - 0.4))
        ctx.lineTo(ax - 6 * Math.cos(angle + 0.4), ay - 6 * Math.sin(angle + 0.4))
        ctx.fillStyle = 'rgba(239,68,68,0.5)'
        ctx.fill()
      }
    }

    // Draw mutualism edges (dashed green)
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(34,197,94,0.5)'  // green for mutualism
    for (const link of mutualismLinks) {
      const from = positions.get(link.from)
      const to = positions.get(link.to)
      if (!from || !to) continue
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Draw nodes (circles with species color)
    const NODE_R = 5
    for (const bp of nodes) {
      const pos = positions.get(bp.id)
      if (!pos) continue
      const color = firstPaletteColor(bp.art.palette)
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, NODE_R, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Species label
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '8px monospace'
      ctx.textAlign = pos.x < cx ? 'right' : 'left'
      const labelX = pos.x + (pos.x < cx ? -(NODE_R + 3) : (NODE_R + 3))
      ctx.fillText(bp.name, labelX, pos.y + 3)
    }

    ctx.textAlign = 'left'

    // Legend
    ctx.font = '8px monospace'
    ctx.fillStyle = 'rgba(239,68,68,0.6)'
    ctx.fillText('— eats', 8, H - 18)
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = 'rgba(34,197,94,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(48, H - 14)
    ctx.lineTo(70, H - 14)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(34,197,94,0.6)'
    ctx.fillText('helps', 74, H - 11)
  }, [blueprints, aliveIds, foodWeb])

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={240}
      style={{ display: 'block', width: '100%', maxWidth: 300, margin: '0 auto' }}
    />
  )
}

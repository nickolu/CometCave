'use client'

import { useEffect, useRef } from 'react'

import { useMicroLand } from '@/app/micro-land/store'

/** Picks the first opaque color from a blueprint's art palette. */
function firstPaletteColor(palette: Record<string, string>): string {
  const vals = Object.values(palette)
  return vals.length > 0 ? vals[0] : '#888888'
}

export function PopulationGraph() {
  const graphOpen = useMicroLand(s => s.graphOpen)
  const setGraphOpen = useMicroLand(s => s.setGraphOpen)
  const history = useMicroLand(s => s.populationHistory)
  const population = useMicroLand(s => s.population)
  const blueprints = useMicroLand(s => s.blueprints)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!graphOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const PAD = { top: 8, right: 10, bottom: 24, left: 34 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)

    if (history.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('collecting data…', W / 2, H / 2)
      return
    }

    // Gather the blueprint ids that appear in current population or history.
    const ids = [...new Set([
      ...population.map(p => p.blueprintId),
      ...history.flatMap(s => Object.keys(s.counts)),
    ])]

    const bpMap = new Map(blueprints.map(b => [b.id, b]))
    const colorOf = (id: string) => {
      const bp = bpMap.get(id)
      return bp ? firstPaletteColor(bp.art.palette) : '#888888'
    }

    const elMin = history[0].elapsed
    const elMax = history[history.length - 1].elapsed
    const elSpan = Math.max(1, elMax - elMin)

    const allCounts = history.flatMap(s => Object.values(s.counts))
    const maxCount = Math.max(1, ...allCounts)

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (chartH * i) / 4
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(PAD.left + chartW, y)
      ctx.stroke()
    }

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (chartH * i) / 4
      const val = Math.round(maxCount * (1 - i / 4))
      ctx.fillText(String(val), PAD.left - 4, y + 3)
    }

    // X-axis label (elapsed minutes)
    ctx.textAlign = 'center'
    ctx.fillText(
      `${Math.round(elSpan / 60)} min`,
      PAD.left + chartW / 2,
      H - 6
    )

    // Lines
    for (const id of ids) {
      const color = colorOf(id)
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      let first = true
      for (const snap of history) {
        const count = snap.counts[id] ?? 0
        const x = PAD.left + ((snap.elapsed - elMin) / elSpan) * chartW
        const y = PAD.top + chartH - (count / maxCount) * chartH
        if (first) { ctx.moveTo(x, y); first = false }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }, [graphOpen, history, population, blueprints])

  if (!graphOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 48,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.8)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        Population over time
        <button
          type="button"
          onClick={() => setGraphOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '0 2px',
          }}
          aria-label="Close population graph"
        >
          ×
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={160}
        style={{ display: 'block' }}
      />
    </div>
  )
}

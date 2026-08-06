'use client'

import { useEffect, useRef } from 'react'

import { type FocusedSpeciesStats, useMicroLand } from '@/app/micro-land/store'

/** Picks the first opaque color from a blueprint's art palette. */
function firstPaletteColor(palette: Record<string, string>): string {
  const vals = Object.values(palette)
  return vals.length > 0 ? vals[0] : '#888888'
}

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals)
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--cc-font-mono)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--cc-font-mono)', fontSize: 10 }}>
        {value}
      </span>
    </div>
  )
}

function SpeciesStatsPanel({
  blueprintId,
  stats,
  color,
  name,
  currentCount,
  peakCount,
  maxGeneration,
  onDismiss,
}: {
  blueprintId: string
  stats: FocusedSpeciesStats | null
  color: string
  name: string
  currentCount: number
  peakCount: number
  maxGeneration: number
  onDismiss: () => void
}) {
  const requestLocate = useMicroLand(s => s.requestLocate)

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '10px 12px',
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>
            {name}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
          aria-label="Close species panel"
        >
          ×
        </button>
      </div>

      <StatRow label="alive" value={`${currentCount}`} />
      <StatRow label="peak" value={`${peakCount}`} />
      <StatRow label="max gen" value={`${maxGeneration}`} />

      {stats && (
        <>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
          <StatRow label="speed" value={fmt(stats.avgSpeed)} />
          <StatRow label="sight" value={fmt(stats.avgSight)} />
          <StatRow label="size" value={fmt(stats.avgSize)} />
          {stats.avgToxicity > 0.05 && <StatRow label="toxicity" value={fmt(stats.avgToxicity)} />}
          {stats.avgImmunity > 0.25 && <StatRow label="immunity" value={fmt(stats.avgImmunity)} />}
        </>
      )}

      <button
        type="button"
        onClick={() => requestLocate(blueprintId)}
        style={{
          marginTop: 4,
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 9,
          letterSpacing: 1,
          textTransform: 'uppercase',
          padding: '3px 8px',
          border: '1px solid rgba(255,255,255,0.25)',
          color: 'rgba(255,255,255,0.6)',
          background: 'transparent',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Locate in world
      </button>
    </div>
  )
}

export function PopulationGraph() {
  const graphOpen = useMicroLand(s => s.graphOpen)
  const setGraphOpen = useMicroLand(s => s.setGraphOpen)
  const history = useMicroLand(s => s.populationHistory)
  const population = useMicroLand(s => s.population)
  const blueprints = useMicroLand(s => s.blueprints)
  const graphFocusId = useMicroLand(s => s.graphFocusId)
  const setGraphFocusId = useMicroLand(s => s.setGraphFocusId)
  const focusedSpeciesStats = useMicroLand(s => s.focusedSpeciesStats)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const PAD = { top: 8, right: 10, bottom: 24, left: 34 }

  useEffect(() => {
    if (!graphOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
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

    // Lines — unfocused at reduced opacity, focused bright and thick
    for (const id of ids) {
      const color = colorOf(id)
      const isFocused = id === graphFocusId
      const hasFocus = graphFocusId !== null

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = isFocused ? 2.5 : 1.5
      ctx.globalAlpha = hasFocus && !isFocused ? 0.3 : 1
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
      ctx.globalAlpha = 1
    }

    // Birth/death rate lines — green for births, red for deaths
    const allBirthValues = history.flatMap(s => Object.values(s.births ?? {}))
    const allDeathValues = history.flatMap(s => Object.values(s.deaths ?? {}))
    const maxBirthDeath = Math.max(1, ...allBirthValues, ...allDeathValues)

    if (allBirthValues.length > 0 || allDeathValues.length > 0) {
      for (const id of ids) {
        const isFocused = id === graphFocusId
        const hasFocus = graphFocusId !== null
        const baseAlpha = hasFocus && !isFocused ? 0.08 : 0.5

        ctx.setLineDash([3, 3])
        ctx.lineWidth = 1

        // Births line — green dashed
        ctx.strokeStyle = '#22c55e'
        ctx.globalAlpha = baseAlpha
        ctx.beginPath()
        let firstB = true
        for (const snap of history) {
          const b = snap.births?.[id] ?? 0
          const x = PAD.left + ((snap.elapsed - elMin) / elSpan) * chartW
          const y = PAD.top + chartH - (b / maxBirthDeath) * chartH
          if (firstB) { ctx.moveTo(x, y); firstB = false }
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Deaths line — red dashed
        ctx.strokeStyle = '#ef4444'
        let firstD = true
        ctx.beginPath()
        for (const snap of history) {
          const d = snap.deaths?.[id] ?? 0
          const x = PAD.left + ((snap.elapsed - elMin) / elSpan) * chartW
          const y = PAD.top + chartH - (d / maxBirthDeath) * chartH
          if (firstD) { ctx.moveTo(x, y); firstD = false }
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
  }, [graphOpen, history, population, blueprints, graphFocusId])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || history.length < 2) return

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    const W = canvas.width
    const H = canvas.height
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    const elMin = history[0].elapsed
    const elMax = history[history.length - 1].elapsed
    const elSpan = Math.max(1, elMax - elMin)

    const allCounts = history.flatMap(s => Object.values(s.counts))
    const maxCount = Math.max(1, ...allCounts)

    const ids = [...new Set([
      ...population.map(p => p.blueprintId),
      ...history.flatMap(s => Object.keys(s.counts)),
    ])]

    // Find the history snapshot nearest to the click's X
    const targetElapsed = elMin + ((cx - PAD.left) / chartW) * elSpan
    let nearestSnap = history[0]
    let minDt = Math.abs(history[0].elapsed - targetElapsed)
    for (const snap of history) {
      const dt = Math.abs(snap.elapsed - targetElapsed)
      if (dt < minDt) { minDt = dt; nearestSnap = snap }
    }

    // Find the species whose line is closest to the click Y
    let bestId: string | null = null
    let bestDist = 24  // px threshold
    for (const id of ids) {
      const count = nearestSnap.counts[id] ?? 0
      const lineY = PAD.top + chartH - (count / maxCount) * chartH
      const dist = Math.abs(cy - lineY)
      if (dist < bestDist) { bestDist = dist; bestId = id }
    }

    setGraphFocusId(bestId === graphFocusId ? null : bestId)
  }

  if (!graphOpen) return null

  const bpMap = new Map(blueprints.map(b => [b.id, b]))
  const focusedBp = graphFocusId ? bpMap.get(graphFocusId) : undefined
  const focusedEntry = graphFocusId ? population.find(p => p.blueprintId === graphFocusId) : undefined
  const peakCount = graphFocusId
    ? Math.max(0, ...history.map(s => s.counts[graphFocusId] ?? 0))
    : 0

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
        Population / activity over time
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
        style={{ display: 'block', cursor: 'crosshair' }}
        onClick={handleCanvasClick}
      />
      {graphFocusId && focusedBp && (
        <SpeciesStatsPanel
          blueprintId={graphFocusId}
          stats={focusedSpeciesStats?.blueprintId === graphFocusId ? focusedSpeciesStats : null}
          color={firstPaletteColor(focusedBp.art.palette)}
          name={focusedBp.name}
          currentCount={focusedEntry?.count ?? 0}
          peakCount={peakCount}
          maxGeneration={focusedEntry?.maxGeneration ?? 1}
          onDismiss={() => setGraphFocusId(null)}
        />
      )}
    </div>
  )
}

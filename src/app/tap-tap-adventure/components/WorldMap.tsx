'use client'

/**
 * The world, drawn as a road map in ink: each country a circle (filled once
 * visited, outlined when you could go, dotted while it is beyond you), joined
 * by dotted roads, with the one you stand in ringed in brass.
 */
import { REGIONS, canEnterRegion } from '@/app/tap-tap-adventure/config/regions'
import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { PlaybillCaption } from '@/app/tap-tap-adventure/stage/Playbill'

interface WorldMapProps {
  character: FantasyCharacter
}

const INK = 'var(--ps-ink)'
const INK_SOFT = 'var(--ps-ink-soft)'
const INK_FAINT = 'var(--ps-ink-faint)'
const PAPER = 'var(--ps-playbill)'
const BRASS = 'var(--ps-brass)'
const BRASS_DEEP = 'var(--ps-brass-deep)'
const LABEL_FONT = 'var(--font-playbill)'

const SHEET_W = 440
const ROW_H = 70
const TOP = 34
const BOTTOM = 40

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very hard',
  extreme: 'Extreme',
}

export function WorldMap({ character }: WorldMapProps) {
  const visitedRegions = new Set(character.visitedRegions ?? [])
  const currentRegion = character.currentRegion ?? 'green_meadows'
  const charLevel = character.level ?? 1

  // Build tree nodes from regions
  const regionIds = Object.keys(REGIONS)

  // Find root
  const root = 'green_meadows'

  // BFS to build ordered list with depth
  type TreeNode = { id: string; depth: number; parentId?: string }
  const visited = new Set<string>()
  const nodes: TreeNode[] = []
  const queue: TreeNode[] = [{ id: root, depth: 0 }]

  while (queue.length > 0) {
    const node = queue.shift()!
    if (visited.has(node.id)) continue
    visited.add(node.id)
    nodes.push(node)

    const region = REGIONS[node.id]
    const children = region?.childRegions ?? []
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, depth: node.depth + 1, parentId: node.id })
      }
    }
  }

  // Lay the tree out on the sheet: one row per depth, the countries in a row spread evenly.
  const byDepth = new Map<number, TreeNode[]>()
  for (const n of nodes) {
    const row = byDepth.get(n.depth) ?? []
    row.push(n)
    byDepth.set(n.depth, row)
  }
  const maxDepth = Math.max(0, ...nodes.map(n => n.depth))
  const pos = new Map<string, { x: number; y: number; stagger: boolean }>()
  for (const [depth, row] of byDepth) {
    row.forEach((n, i) => {
      // In a crowded row every other label drops a line so names do not run into each other.
      pos.set(n.id, { x: (SHEET_W / (row.length + 1)) * (i + 1), y: TOP + depth * ROW_H, stagger: row.length > 2 && i % 2 === 1 })
    })
  }
  const sheetH = TOP + maxDepth * ROW_H + BOTTOM

  // Every road, not only the tree's: a country can be reached from two others.
  const roads: { from: string; to: string }[] = []
  for (const n of nodes) {
    for (const childId of REGIONS[n.id]?.childRegions ?? []) {
      if (pos.has(childId)) roads.push({ from: n.id, to: childId })
    }
  }

  const facts = (id: string) => {
    const region = REGIONS[id]
    const isVisited = visitedRegions.has(id)
    const isCurrent = id === currentRegion
    const canEnter = canEnterRegion(region, charLevel)
    const bits = [DIFFICULTY_LABEL[region.difficulty] ?? region.difficulty, `Lv ${region.minLevel}+`]
    if (isCurrent) bits.push('you are here')
    else if (isVisited) bits.push('visited')
    else if (canEnter) bits.push('open to you')
    else bits.push(`needs level ${region.minLevel}`)
    if (region.isDeadEnd) bits.push('dead end')
    return `${region.name} · ${bits.join(' · ')}`
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <PlaybillCaption className="text-ps-ink">The known world</PlaybillCaption>
        <PlaybillCaption>
          <span className="font-playbill text-xs tracking-normal text-ps-ink">{visitedRegions.size}</span> of {regionIds.length} countries
        </PlaybillCaption>
      </div>

      <div className="ps-paper-flat relative w-full overflow-hidden rounded-[3px] border-2 border-ps-ink">
        <svg className="block h-auto w-full" viewBox={`0 0 ${SHEET_W} ${sheetH}`} role="img" aria-label="Map of the world">
          <title>Map of the world</title>
          <desc>
            {nodes.map(n => facts(n.id)).join('. ')}
          </desc>
          <rect x="5" y="5" width={SHEET_W - 10} height={sheetH - 10} fill="none" stroke={INK} strokeOpacity="0.6" strokeWidth="1" />

          {/* Roads */}
          {roads.map(r => {
            const a = pos.get(r.from)!
            const b = pos.get(r.to)!
            const known = visitedRegions.has(r.from) && (visitedRegions.has(r.to) || canEnterRegion(REGIONS[r.to], charLevel))
            return (
              <line
                key={`${r.from}-${r.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={known ? INK : INK_FAINT}
                strokeWidth={known ? 1.75 : 1.25}
                strokeDasharray="1 5"
                strokeLinecap="round"
              />
            )
          })}

          {/* Countries */}
          {nodes.map(node => {
            const region = REGIONS[node.id]
            if (!region) return null
            const p = pos.get(node.id)!
            const isVisited = visitedRegions.has(node.id)
            const isCurrent = node.id === currentRegion
            const canEnter = canEnterRegion(region, charLevel)
            const locked = !isVisited && !canEnter
            const labelY = p.y + (p.stagger ? 44 : 24)

            return (
              <g key={node.id}>
                <title>{facts(node.id)}</title>
                {isCurrent && <circle cx={p.x} cy={p.y} r={16} fill="none" stroke={BRASS} strokeWidth="3.5" />}
                {isCurrent && <circle cx={p.x} cy={p.y} r={16} fill="none" stroke={BRASS_DEEP} strokeWidth="0.75" />}
                <circle cx={p.x} cy={p.y} r={11} fill={PAPER} stroke="none" />
                {isVisited ? (
                  <circle cx={p.x} cy={p.y} r={9} fill={INK} stroke={INK} strokeWidth="2" />
                ) : canEnter ? (
                  <circle cx={p.x} cy={p.y} r={9} fill={PAPER} stroke={INK} strokeWidth="2" />
                ) : (
                  <circle cx={p.x} cy={p.y} r={9} fill="none" stroke={INK_FAINT} strokeWidth="1.5" strokeDasharray="2 3" />
                )}
                {region.isDeadEnd && <line x1={p.x - 5} y1={p.y + 13} x2={p.x + 5} y2={p.y + 13} stroke={locked ? INK_FAINT : INK} strokeWidth="2" strokeLinecap="round" />}
                <text
                  x={p.x}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="10"
                  fill={locked ? INK_FAINT : INK}
                  stroke={PAPER}
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ fontFamily: LABEL_FONT }}
                >
                  {region.icon} {region.name}
                </text>
                <text
                  x={p.x}
                  y={labelY + 10}
                  textAnchor="middle"
                  fontSize="7.5"
                  letterSpacing="0.6"
                  fill={locked ? INK_FAINT : INK_SOFT}
                  stroke={PAPER}
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ fontFamily: LABEL_FONT }}
                >
                  {locked ? `LV ${region.minLevel} NEEDED` : `LV ${region.minLevel}+`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft" aria-label="Key">
        <li className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="6" fill="none" stroke={BRASS} strokeWidth="2.5" /><circle cx="7" cy="7" r="3" fill={INK} /></svg>
          Here
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4.5" fill={INK} /></svg>
          Visited
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4.5" fill="none" stroke={INK} strokeWidth="1.5" /></svg>
          Open to you
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4.5" fill="none" stroke={INK_FAINT} strokeWidth="1.2" strokeDasharray="1.5 2" /></svg>
          Beyond you
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><line x1="2" y1="6" x2="10" y2="6" stroke={INK} strokeWidth="2" strokeLinecap="round" /></svg>
          Dead end
        </li>
        <li className="flex items-center gap-1">
          <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden><line x1="1" y1="6" x2="17" y2="6" stroke={INK} strokeWidth="1.75" strokeDasharray="1 4" strokeLinecap="round" /></svg>
          Road between countries
        </li>
      </ul>

      <ul className="sr-only" aria-label="Countries">
        {nodes.map(n => <li key={n.id}>{facts(n.id)}</li>)}
      </ul>
    </div>
  )
}

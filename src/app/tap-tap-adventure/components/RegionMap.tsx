'use client'

import { useRef, useEffect } from 'react'
import { REGIONS, canEnterRegion, Region } from '@/app/tap-tap-adventure/config/regions'

interface RegionMapProps {
  currentRegionId: string
  characterLevel: number
  visitedRegions?: string[]
  conqueredRegions?: string[]
  onRegionClick?: (regionId: string) => void
}

// Absolute SVG coordinates in 400x1100 viewBox (bottom = high y, top = low y)
const TREE_LAYOUT: Record<string, { x: number; y: number }> = {
  green_meadows:     { x: 200, y: 1040 },
  dark_forest:       { x:  95, y:  845 },
  sunken_ruins:      { x: 305, y:  845 },
  feywild_grove:     { x:  95, y:  755 },
  crystal_caves:     { x: 305, y:  755 },
  bone_wastes:       { x: 200, y:  660 },
  scorched_wastes:   { x:  95, y:  560 },
  frozen_peaks:      { x: 305, y:  560 },
  volcanic_forge:    { x:  95, y:  460 },
  shadow_realm:      { x: 305, y:  460 },
  dragons_spine:     { x: 200, y:  350 },
  sky_citadel:       { x: 200, y:  250 },
  abyssal_depths:    { x: 200, y:  160 },
  celestial_throne:  { x: 200, y:   60 },
}

const TERRAIN_GRADIENTS: Record<string, [string, string]> = {
  green_meadows:     ['#3a7d44', '#1e4d2b'],
  dark_forest:       ['#1a2e1a', '#0d1a0d'],
  sunken_ruins:      ['#1a3a4a', '#0d2233'],
  crystal_caves:     ['#2a1a4a', '#15103a'],
  feywild_grove:     ['#3a2a5e', '#1e1540'],
  bone_wastes:       ['#3a3228', '#221e16'],
  scorched_wastes:   ['#5e3a1a', '#3a1a0a'],
  frozen_peaks:      ['#1a3a5e', '#0d2040'],
  volcanic_forge:    ['#5e2a1a', '#3a0f0a'],
  shadow_realm:      ['#1a0d2e', '#0d0820'],
  dragons_spine:     ['#3a2010', '#1e100a'],
  sky_citadel:       ['#1a2e5e', '#0d1840'],
  abyssal_depths:    ['#0d1a3a', '#060d1a'],
  celestial_throne:  ['#4a3a6e', '#1e1540'],
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:      '#22c55e',
  medium:    '#eab308',
  hard:      '#f97316',
  very_hard: '#ef4444',
  extreme:   '#a855f7',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy:      'Easy',
  medium:    'Medium',
  hard:      'Hard',
  very_hard: 'Very Hard',
  extreme:   'Extreme',
}

// ─── ConnectionPath ──────────────────────────────────────────────────────────

function ConnectionPath({
  x1, y1, x2, y2, explored,
}: {
  x1: number; y1: number; x2: number; y2: number; explored: boolean
}) {
  // Build S-curve bezier
  let d: string
  if (x1 === x2) {
    // Vertical connection: gentle S with horizontal offset on control points
    const midY = (y1 + y2) / 2
    d = `M ${x1} ${y1} C ${x1 + 20} ${y1 * 0.6 + y2 * 0.4} ${x2 - 20} ${y1 * 0.4 + y2 * 0.6} ${x2} ${y2}`
    void midY // suppress unused warning
  } else {
    // Diagonal connection: horizontal S-curve
    const midY = (y1 + y2) / 2
    d = `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`
  }

  const pathId = `trail-${Math.round(x1)}-${Math.round(y1)}-${Math.round(x2)}-${Math.round(y2)}`

  if (!explored) {
    return (
      <path
        d={d}
        fill="none"
        stroke="rgba(100,116,139,0.2)"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
    )
  }

  return (
    <>
      {/* Wide dark road base */}
      <path
        id={pathId}
        d={d}
        fill="none"
        stroke="#7a5c30"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Thin gold highlight */}
      <path
        d={d}
        fill="none"
        stroke="#c8a96e"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Animated travelling dot */}
      <circle r={3} fill="rgba(251, 191, 36, 0.8)">
        <animateMotion dur="4s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </>
  )
}

// ─── RegionNode ───────────────────────────────────────────────────────────────

function RegionNode({
  region,
  x,
  y,
  isCurrent,
  isVisited,
  isConquered,
  accessible,
  characterLevel,
  onRegionClick,
}: {
  region: Region
  x: number
  y: number
  isCurrent: boolean
  isVisited: boolean
  isConquered: boolean
  accessible: boolean
  characterLevel: number
  onRegionClick?: (regionId: string) => void
}) {
  const diffColor = DIFFICULTY_COLOR[region.difficulty] ?? DIFFICULTY_COLOR.easy
  const displayName = region.name.length > 12 ? region.name.slice(0, 11) + '\u2026' : region.name
  const isLocked = !isVisited && !isCurrent
  const isClickable = isVisited && accessible && !isCurrent && !!onRegionClick

  if (isLocked) {
    // Fog-of-war: blurred dark box
    return (
      <g transform={`translate(${x},${y})`}>
        <rect
          x={-32} y={-26} width={64} height={52} rx={10}
          fill="rgba(15,20,15,0.8)"
          filter="url(#blur-fog)"
        />
        <text
          y={6}
          textAnchor="middle"
          fontSize={18}
          fontFamily="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
          fill="rgba(255,255,255,0.15)"
        >
          ❓
        </text>
        <text y={22} textAnchor="middle" fontSize={7} fill="rgba(100,116,139,0.4)">
          ???
        </text>
      </g>
    )
  }

  // Visited / current node
  return (
    <g
      transform={`translate(${x},${y})`}
      style={isClickable ? { cursor: 'pointer' } : undefined}
      onClick={isClickable ? () => onRegionClick!(region.id) : undefined}
    >
      {/* Pulse ring for current region */}
      {isCurrent && (
        <circle
          r={42}
          fill="none"
          stroke={diffColor}
          strokeWidth={2}
          opacity={0.4}
          className="animate-ping"
        />
      )}

      {/* Drop shadow + terrain background */}
      <rect
        x={-32} y={-26} width={64} height={52} rx={10}
        fill={`url(#grad-${region.id})`}
        filter="url(#drop-shadow)"
      />

      {/* Difficulty border */}
      <rect
        x={-32} y={-26} width={64} height={52} rx={10}
        fill="none"
        stroke={diffColor}
        strokeWidth={isCurrent ? 2.5 : 1.5}
      />

      {/* Inner top highlight */}
      <rect
        x={-30} y={-24} width={60} height={12} rx={8}
        fill="rgba(255,255,255,0.05)"
      />

      {/* Emoji icon */}
      <text
        y={-4}
        textAnchor="middle"
        fontSize={20}
        fontFamily="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
        style={{ pointerEvents: 'none' }}
      >
        {region.icon}
      </text>

      {/* Name label */}
      <text
        y={14}
        textAnchor="middle"
        fontSize={8}
        fontWeight="bold"
        fill="white"
        letterSpacing={0.3}
        style={{ pointerEvents: 'none' }}
      >
        {displayName}
      </text>

      {/* Difficulty pill */}
      <rect x={-18} y={18} width={36} height={11} rx={5} fill={diffColor} opacity={0.3} />
      <text y={27} textAnchor="middle" fontSize={7} fill={diffColor} style={{ pointerEvents: 'none' }}>
        {DIFFICULTY_LABELS[region.difficulty]}
      </text>

      {/* Level gate warning */}
      {!accessible && !isCurrent && (
        <text y={38} textAnchor="middle" fontSize={7} fill="#f87171" style={{ pointerEvents: 'none' }}>
          Lv.{region.minLevel}+
        </text>
      )}

      {/* Current location indicator */}
      {isCurrent && (
        <text
          y={42}
          textAnchor="middle"
          fontSize={8}
          fill="#34d399"
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          ▼ HERE
        </text>
      )}

      {/* Conquered star */}
      {isConquered && (
        <text
          x={28} y={-20}
          fontSize={10}
          fontFamily="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          ⭐
        </text>
      )}

      {/* Travel indicator for clickable nodes */}
      {isClickable && (
        <>
          <rect
            x={-32} y={-26} width={64} height={52} rx={10}
            fill="rgba(99,179,237,0.08)"
            stroke="rgba(99,179,237,0.35)"
            strokeWidth={1}
            className="hover:fill-[rgba(99,179,237,0.18)]"
            style={{ pointerEvents: 'all' }}
          />
          <text
            y={42}
            textAnchor="middle"
            fontSize={7}
            fill="#60a5fa"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            ▶ Travel
          </text>
        </>
      )}
    </g>
  )
}

// ─── SVG Defs ─────────────────────────────────────────────────────────────────

function MapDefs() {
  return (
    <defs>
      {/* Per-region terrain gradients */}
      {Object.entries(TERRAIN_GRADIENTS).map(([id, [top, bottom]]) => (
        <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      ))}

      {/* Vignette gradient */}
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.65)" />
      </radialGradient>

      {/* Parchment crosshatch pattern */}
      <pattern id="parchment" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M 0 0 L 6 6" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" fill="none" />
        <path d="M 6 0 L 0 6" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" fill="none" />
      </pattern>

      {/* Drop shadow filter for nodes */}
      <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity={0.6} />
      </filter>

      {/* Fog-of-war blur */}
      <filter id="blur-fog" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" />
      </filter>

      {/* Glow filter */}
      <filter id="glow-sm" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  )
}

// ─── RegionMap ────────────────────────────────────────────────────────────────

export function RegionMap({
  currentRegionId,
  characterLevel,
  visitedRegions = [],
  conqueredRegions = [],
  onRegionClick,
}: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const regions = Object.values(REGIONS)
  const visited = new Set([...visitedRegions, currentRegionId, 'green_meadows'])

  // Auto-scroll to current region on mount / change
  useEffect(() => {
    const pos = TREE_LAYOUT[currentRegionId]
    if (!pos || !containerRef.current) return
    const container = containerRef.current

    const doScroll = () => {
      const svgEl = container.querySelector('svg')
      const svgHeight = svgEl?.getBoundingClientRect().height ?? 0
      if (svgHeight === 0) return
      const containerHeight = container.clientHeight
      const frac = pos.y / 1100
      const targetScrollTop = frac * svgHeight - containerHeight / 2
      container.scrollTop = Math.max(0, targetScrollTop)
    }

    // Run after paint in case SVG hasn't laid out yet
    requestAnimationFrame(doScroll)
  }, [currentRegionId])

  // Build unique connection pairs
  const connections: { from: string; to: string }[] = []
  const seen = new Set<string>()
  for (const region of regions) {
    for (const connId of region.connectedRegions) {
      const key = [region.id, connId].sort().join('-')
      if (!seen.has(key)) {
        seen.add(key)
        connections.push({ from: region.id, to: connId })
      }
    }
  }

  // Separate explored vs unexplored connections
  const unexploredConns = connections.filter(
    ({ from, to }) => !(visited.has(from) && visited.has(to))
  )
  const exploredConns = connections.filter(
    ({ from, to }) => visited.has(from) && visited.has(to)
  )

  // Nodes: non-current first, current last (SVG stacking)
  const nonCurrentNodes = Object.keys(TREE_LAYOUT).filter(id => id !== currentRegionId)

  return (
    <div className="w-full">
      {/* Header with exploration progress */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">World Map</h3>
          <span className="text-xs text-slate-400">
            {visited.size}/{regions.length} discovered
            {conqueredRegions.length > 0 && (
              <span className="ml-1 text-amber-400">⭐{conqueredRegions.length}</span>
            )}
          </span>
        </div>
        {/* Exploration progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(visited.size / regions.length) * 100}%`,
                background: visited.size >= regions.length
                  ? 'linear-gradient(90deg, #f59e0b, #eab308)'
                  : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              }}
            />
          </div>
          <span className="text-[10px] text-slate-500 shrink-0">
            {Math.round((visited.size / regions.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="overflow-y-auto max-h-[70vh] rounded-xl border border-amber-800/30 bg-[#0a0f0a]"
      >
        <svg
          viewBox="0 0 400 1100"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <MapDefs />

          {/* Background layers */}
          <rect width="400" height="1100" fill="#0a100a" />
          <rect width="400" height="1100" fill="url(#parchment)" />

          {/* Zone tier labels on the right edge */}
          {([
            [1040, 'Haven'],
            [940,  'Outskirts'],
            [845,  'Frontier'],
            [755,  'Wilds'],
            [660,  'Crossroads'],
            [560,  'Badlands'],
            [460,  'Depths'],
            [350,  'Apex'],
            [250,  'Skyward'],
            [160,  'Abyss'],
            [60,   'Ascension'],
          ] as const).map(([y, label]) => (
            <text
              key={label}
              x={388}
              y={y}
              textAnchor="end"
              fontSize={7}
              fill="rgba(180, 160, 100, 0.2)"
              fontWeight={500}
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' } as React.CSSProperties}
            >
              {label}
            </text>
          ))}

          {/* Unexplored connections (rendered first, behind explored) */}
          {unexploredConns.map(({ from, to }) => {
            const fp = TREE_LAYOUT[from]
            const tp = TREE_LAYOUT[to]
            if (!fp || !tp) return null
            return (
              <ConnectionPath
                key={`${from}-${to}`}
                x1={fp.x} y1={fp.y}
                x2={tp.x} y2={tp.y}
                explored={false}
              />
            )
          })}

          {/* Explored connections (gold roads on top) */}
          {exploredConns.map(({ from, to }) => {
            const fp = TREE_LAYOUT[from]
            const tp = TREE_LAYOUT[to]
            if (!fp || !tp) return null
            return (
              <ConnectionPath
                key={`${from}-${to}`}
                x1={fp.x} y1={fp.y}
                x2={tp.x} y2={tp.y}
                explored={true}
              />
            )
          })}

          {/* Non-current region nodes */}
          {nonCurrentNodes.map(id => {
            const region = REGIONS[id]
            const pos = TREE_LAYOUT[id]
            if (!region || !pos) return null
            const isVisited = visited.has(id)
            const isConquered = conqueredRegions.includes(id)
            const accessible = canEnterRegion(region, characterLevel)
            return (
              <RegionNode
                key={id}
                region={region}
                x={pos.x}
                y={pos.y}
                isCurrent={false}
                isVisited={isVisited}
                isConquered={isConquered}
                accessible={accessible}
                characterLevel={characterLevel}
                onRegionClick={onRegionClick}
              />
            )
          })}

          {/* Current region node last (renders on top) */}
          {(() => {
            const region = REGIONS[currentRegionId]
            const pos = TREE_LAYOUT[currentRegionId]
            if (!region || !pos) return null
            return (
              <RegionNode
                key={currentRegionId}
                region={region}
                x={pos.x}
                y={pos.y}
                isCurrent={true}
                isVisited={true}
                isConquered={conqueredRegions.includes(currentRegionId)}
                accessible={true}
                characterLevel={characterLevel}
              />
            )
          })()}

          {/* Vignette overlay (on top of everything) */}
          <rect width="400" height="1100" fill="url(#vignette)" style={{ pointerEvents: 'none' }} />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
        {(
          [
            ['easy',      '#22c55e', 'Easy'   ],
            ['medium',    '#eab308', 'Med'    ],
            ['hard',      '#f97316', 'Hard'   ],
            ['very_hard', '#ef4444', 'V.Hard' ],
            ['extreme',   '#a855f7', 'Extreme'],
          ] as const
        ).map(([, color, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-slate-400">{label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <svg width="20" height="4">
            <line x1="0" y1="2" x2="20" y2="2" stroke="#c8a96e" strokeWidth="2" />
          </svg>
          <span className="text-slate-400">Road</span>
        </span>
        <span className="flex items-center gap-1">
          <svg width="20" height="4">
            <line x1="0" y1="2" x2="20" y2="2" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          <span className="text-slate-400">Unknown</span>
        </span>
      </div>
    </div>
  )
}

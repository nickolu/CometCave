'use client'

import { REGIONS, canEnterRegion, Region } from '@/app/tap-tap-adventure/config/regions'

interface RegionMapProps {
  currentRegionId: string
  characterLevel: number
  visitedRegions?: string[]
  conqueredRegions?: string[]
}

// Glow colors per difficulty for the circular nodes
const DIFFICULTY_GLOW: Record<string, { border: string; bg: string; shadow: string; ring: string }> = {
  easy:      { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)',  shadow: 'rgba(34, 197, 94, 0.4)',  ring: 'rgba(34, 197, 94, 0.6)' },
  medium:    { border: '#eab308', bg: 'rgba(234, 179, 8, 0.15)',  shadow: 'rgba(234, 179, 8, 0.4)',  ring: 'rgba(234, 179, 8, 0.6)' },
  hard:      { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', shadow: 'rgba(249, 115, 22, 0.4)', ring: 'rgba(249, 115, 22, 0.6)' },
  very_hard: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)',  shadow: 'rgba(239, 68, 68, 0.4)',  ring: 'rgba(239, 68, 68, 0.6)' },
  extreme:   { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', shadow: 'rgba(168, 85, 247, 0.5)', ring: 'rgba(168, 85, 247, 0.7)' },
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very Hard',
  extreme: 'Extreme',
}

// Tree layout: tiers from bottom (0) to top (10)
// Each tier has nodes positioned with x as fraction of width (0-1)
const TREE_LAYOUT: { id: string; tier: number; x: number }[] = [
  { id: 'starting_village',  tier: 0,  x: 0.5 },
  { id: 'green_meadows',     tier: 1,  x: 0.5 },
  { id: 'dark_forest',       tier: 2,  x: 0.3 },
  { id: 'sunken_ruins',      tier: 2,  x: 0.7 },
  { id: 'feywild_grove',     tier: 3,  x: 0.3 },
  { id: 'crystal_caves',     tier: 3,  x: 0.7 },
  { id: 'bone_wastes',       tier: 4,  x: 0.5 },
  { id: 'scorched_wastes',   tier: 5,  x: 0.3 },
  { id: 'frozen_peaks',      tier: 5,  x: 0.7 },
  { id: 'volcanic_forge',    tier: 6,  x: 0.3 },
  { id: 'shadow_realm',      tier: 6,  x: 0.7 },
  { id: 'dragons_spine',     tier: 7,  x: 0.5 },
  { id: 'sky_citadel',       tier: 8,  x: 0.5 },
  { id: 'abyssal_depths',    tier: 9,  x: 0.5 },
  { id: 'celestial_throne',  tier: 10, x: 0.5 },
]

const MAX_TIER = 10
const NODE_RADIUS = 28
const TIER_HEIGHT = 80
const SVG_PADDING_X = 50
const SVG_PADDING_TOP = 50
const SVG_PADDING_BOTTOM = 40
const SVG_WIDTH = 320
const SVG_HEIGHT = SVG_PADDING_TOP + (MAX_TIER * TIER_HEIGHT) + SVG_PADDING_BOTTOM

function getNodeCenter(tier: number, x: number): { cx: number; cy: number } {
  const usableWidth = SVG_WIDTH - SVG_PADDING_X * 2
  return {
    cx: SVG_PADDING_X + x * usableWidth,
    cy: SVG_PADDING_TOP + (MAX_TIER - tier) * TIER_HEIGHT, // bottom-up: tier 0 at bottom
  }
}

// Curved bezier path between two nodes
function ConnectionPath({ from, to, explored }: { from: { cx: number; cy: number }; to: { cx: number; cy: number }; explored: boolean }) {
  const midY = (from.cy + to.cy) / 2
  const d = `M ${from.cx} ${from.cy} C ${from.cx} ${midY}, ${to.cx} ${midY}, ${to.cx} ${to.cy}`
  return (
    <path
      d={d}
      fill="none"
      stroke={explored ? 'rgba(168, 185, 255, 0.5)' : 'rgba(100, 116, 139, 0.2)'}
      strokeWidth={explored ? 2.5 : 1.5}
      strokeDasharray={explored ? undefined : '6 4'}
      strokeLinecap="round"
    />
  )
}

// Pulsing ring animation for current node
function PulseRing({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={NODE_RADIUS + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.6}>
        <animate attributeName="r" from={String(NODE_RADIUS + 4)} to={String(NODE_RADIUS + 14)} dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={NODE_RADIUS + 4} fill="none" stroke={color} strokeWidth={2} opacity={0.3}>
        <animate attributeName="r" from={String(NODE_RADIUS + 4)} to={String(NODE_RADIUS + 10)} dur="1.5s" begin="0.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
      </circle>
    </>
  )
}

function RegionNode({
  region,
  cx,
  cy,
  isCurrent,
  isVisited,
  isConquered,
  accessible,
}: {
  region: Region
  cx: number
  cy: number
  isCurrent: boolean
  isVisited: boolean
  isConquered: boolean
  accessible: boolean
}) {
  const glow = DIFFICULTY_GLOW[region.difficulty] ?? DIFFICULTY_GLOW.easy
  const r = NODE_RADIUS

  // Determine visual state
  const isLocked = !isVisited && !isCurrent
  const isDimmed = isVisited && !accessible && !isCurrent

  return (
    <g style={{ cursor: isVisited ? 'default' : 'default' }}>
      {/* Current node pulse */}
      {isCurrent && <PulseRing cx={cx} cy={cy} color={glow.ring} />}

      {/* Glow filter for visited nodes */}
      {isVisited && !isLocked && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 3}
          fill="none"
          stroke={glow.border}
          strokeWidth={isCurrent ? 3 : 1.5}
          opacity={isCurrent ? 0.8 : isDimmed ? 0.3 : 0.5}
        />
      )}

      {/* Main circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={isLocked ? 'rgba(30, 31, 48, 0.8)' : glow.bg}
        stroke={isLocked ? 'rgba(71, 85, 105, 0.3)' : glow.border}
        strokeWidth={isCurrent ? 2.5 : isVisited ? 2 : 1}
        opacity={isLocked ? 0.5 : isDimmed ? 0.6 : 1}
        filter={isLocked ? 'url(#blur-locked)' : undefined}
      />

      {/* Inner gradient overlay for depth */}
      {isVisited && !isLocked && (
        <circle
          cx={cx}
          cy={cy}
          r={r - 2}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      )}

      {/* Icon */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isLocked ? 16 : 20}
        opacity={isLocked ? 0.4 : 1}
        style={{ pointerEvents: 'none' }}
      >
        {isVisited ? region.icon : '\u2753'}
      </text>

      {/* Conquered star */}
      {isConquered && (
        <text
          x={cx + r - 4}
          y={cy - r + 6}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          style={{ pointerEvents: 'none' }}
        >
          \u2B50
        </text>
      )}

      {/* Name label */}
      <text
        x={cx}
        y={cy + r + 14}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isLocked ? 'rgba(148, 163, 184, 0.3)' : 'rgba(255, 255, 255, 0.9)'}
        fontSize={9}
        fontWeight={isCurrent ? 700 : 600}
        style={{ pointerEvents: 'none' }}
      >
        {isVisited ? region.name : '???'}
      </text>

      {/* Difficulty label or level requirement */}
      {isVisited && (
        <text
          x={cx}
          y={cy + r + 25}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isDimmed ? 'rgba(239, 68, 68, 0.7)' : 'rgba(148, 163, 184, 0.6)'}
          fontSize={8}
          style={{ pointerEvents: 'none' }}
        >
          {isDimmed && !isCurrent ? `Lv.${region.minLevel}+` : DIFFICULTY_LABELS[region.difficulty]}
        </text>
      )}

      {/* Current location indicator */}
      {isCurrent && (
        <text
          x={cx}
          y={cy + r + 36}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(52, 211, 153, 0.9)"
          fontSize={8}
          fontWeight={700}
          style={{ pointerEvents: 'none' }}
        >
          {'\uD83D\uDCCD'} HERE
        </text>
      )}
    </g>
  )
}

export function RegionMap({ currentRegionId, characterLevel, visitedRegions = [], conqueredRegions = [] }: RegionMapProps) {
  const regions = Object.values(REGIONS)
  const visited = new Set([...visitedRegions, currentRegionId, 'starting_village'])

  // Build node position lookup
  const nodePositions: Record<string, { cx: number; cy: number }> = {}
  for (const node of TREE_LAYOUT) {
    nodePositions[node.id] = getNodeCenter(node.tier, node.x)
  }

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

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">World Map</h3>
        <span className="text-xs text-slate-400">
          {visited.size}/{regions.length} discovered
          {conqueredRegions.length > 0 && <span className="ml-1 text-amber-400">{'\u2B50'}{conqueredRegions.length}</span>}
        </span>
      </div>
      <div className="relative w-full overflow-x-hidden">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-auto"
          style={{ minHeight: 400 }}
        >
          {/* Defs for filters */}
          <defs>
            <filter id="blur-locked" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
            <radialGradient id="bg-gradient" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="rgba(30, 27, 75, 0.4)" />
              <stop offset="100%" stopColor="rgba(15, 15, 30, 0)" />
            </radialGradient>
          </defs>

          {/* Subtle background glow */}
          <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#bg-gradient)" />

          {/* Connection paths */}
          {connections.map(({ from, to }) => {
            const fromPos = nodePositions[from]
            const toPos = nodePositions[to]
            if (!fromPos || !toPos) return null
            const explored = visited.has(from) && visited.has(to)
            return (
              <ConnectionPath
                key={`${from}-${to}`}
                from={fromPos}
                to={toPos}
                explored={explored}
              />
            )
          })}

          {/* Region nodes — render current last so it's on top */}
          {TREE_LAYOUT
            .filter(n => n.id !== currentRegionId)
            .map(node => {
              const region = REGIONS[node.id]
              if (!region) return null
              const pos = nodePositions[node.id]
              if (!pos) return null
              const isVisited = visited.has(node.id)
              const isConquered = conqueredRegions.includes(node.id)
              const accessible = canEnterRegion(region, characterLevel)
              return (
                <RegionNode
                  key={node.id}
                  region={region}
                  cx={pos.cx}
                  cy={pos.cy}
                  isCurrent={false}
                  isVisited={isVisited}
                  isConquered={isConquered}
                  accessible={accessible}
                />
              )
            })}
          {/* Current node on top */}
          {(() => {
            const node = TREE_LAYOUT.find(n => n.id === currentRegionId)
            if (!node) return null
            const region = REGIONS[node.id]
            if (!region) return null
            const pos = nodePositions[node.id]
            if (!pos) return null
            return (
              <RegionNode
                key={node.id}
                region={region}
                cx={pos.cx}
                cy={pos.cy}
                isCurrent={true}
                isVisited={true}
                isConquered={conqueredRegions.includes(node.id)}
                accessible={true}
              />
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

'use client'

import { REGIONS, canEnterRegion, Region } from '@/app/tap-tap-adventure/config/regions'

interface RegionMapProps {
  currentRegionId: string
  characterLevel: number
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'border-green-500/60 bg-green-900/30',
  medium: 'border-yellow-500/60 bg-yellow-900/30',
  hard: 'border-orange-500/60 bg-orange-900/30',
  very_hard: 'border-red-500/60 bg-red-900/30',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very Hard',
}

// Fixed positions for the map layout (percentage-based)
const POSITIONS: Record<string, { x: number; y: number }> = {
  sky_citadel:      { x: 50, y: 3 },
  dragons_spine:    { x: 82, y: 10 },
  scorched_wastes:  { x: 15, y: 22 },
  frozen_peaks:     { x: 50, y: 18 },
  shadow_realm:     { x: 85, y: 28 },
  volcanic_forge:   { x: 15, y: 40 },
  bone_wastes:      { x: 85, y: 45 },
  dark_forest:      { x: 30, y: 55 },
  crystal_caves:    { x: 70, y: 55 },
  feywild_grove:    { x: 30, y: 70 },
  sunken_ruins:     { x: 70, y: 70 },
  green_meadows:    { x: 50, y: 82 },
  starting_village: { x: 50, y: 95 },
}

function ConnectionLine({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  return (
    <line
      x1={`${from.x}%`}
      y1={`${from.y}%`}
      x2={`${to.x}%`}
      y2={`${to.y}%`}
      stroke="rgba(148, 163, 184, 0.3)"
      strokeWidth="1.5"
      strokeDasharray="4 4"
    />
  )
}

export function RegionMap({ currentRegionId, characterLevel }: RegionMapProps) {
  const regions = Object.values(REGIONS)

  // Build unique connection pairs to avoid drawing duplicates
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
      <h3 className="text-lg font-semibold text-white mb-3">Region Map</h3>
      <div className="relative w-full" style={{ paddingBottom: '110%' }}>
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          {connections.map(({ from, to }) => {
            const fromPos = POSITIONS[from]
            const toPos = POSITIONS[to]
            if (!fromPos || !toPos) return null
            return (
              <ConnectionLine
                key={`${from}-${to}`}
                from={fromPos}
                to={toPos}
              />
            )
          })}
        </svg>

        {/* Region nodes */}
        {regions.map((region: Region) => {
          const pos = POSITIONS[region.id]
          if (!pos) return null
          const isCurrent = region.id === currentRegionId
          const accessible = canEnterRegion(region, characterLevel)

          return (
            <div
              key={region.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 w-24 sm:w-28 text-center rounded-lg border-2 px-1 py-1.5 transition-all ${
                DIFFICULTY_COLORS[region.difficulty]
              } ${
                isCurrent
                  ? 'ring-2 ring-white shadow-lg shadow-white/20 scale-110'
                  : accessible
                  ? 'opacity-80 hover:opacity-100'
                  : 'opacity-40 grayscale'
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                zIndex: isCurrent ? 10 : 1,
              }}
              title={region.description}
            >
              <div className="text-lg leading-none">{region.icon}</div>
              <div className="text-[10px] sm:text-xs font-bold text-white truncate">{region.name}</div>
              <div className="text-[9px] text-slate-400">
                {DIFFICULTY_LABELS[region.difficulty]}
              </div>
              {!accessible && (
                <div className="text-[9px] text-red-400 font-semibold">
                  Lv.{region.minLevel}+
                </div>
              )}
              {isCurrent && (
                <div className="text-[9px] text-emerald-400 font-bold">You are here</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

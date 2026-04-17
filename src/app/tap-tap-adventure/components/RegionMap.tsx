'use client'

import { REGIONS, canEnterRegion, Region } from '@/app/tap-tap-adventure/config/regions'

interface RegionMapProps {
  currentRegionId: string
  characterLevel: number
  visitedRegions?: string[]
  conqueredRegions?: string[]
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'border-green-500/60 bg-green-900/30',
  medium: 'border-yellow-500/60 bg-yellow-900/30',
  hard: 'border-orange-500/60 bg-orange-900/30',
  very_hard: 'border-red-500/60 bg-red-900/30',
  extreme: 'border-purple-500/60 bg-purple-900/30',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very Hard',
  extreme: 'Extreme',
}

// Fixed positions for the map layout (percentage-based)
// Linear top-to-bottom layout matching the progression path
const POSITIONS: Record<string, { x: number; y: number }> = {
  celestial_throne: { x: 50, y: 3 },
  abyssal_depths:   { x: 50, y: 12 },
  sky_citadel:      { x: 50, y: 16 },
  dragons_spine:    { x: 50, y: 25 },
  volcanic_forge:   { x: 28, y: 36 },
  shadow_realm:     { x: 72, y: 36 },
  scorched_wastes:  { x: 28, y: 48 },
  frozen_peaks:     { x: 72, y: 48 },
  bone_wastes:      { x: 50, y: 60 },
  feywild_grove:    { x: 28, y: 72 },
  crystal_caves:    { x: 72, y: 72 },
  dark_forest:      { x: 28, y: 83 },
  sunken_ruins:     { x: 72, y: 83 },
  green_meadows:    { x: 50, y: 92 },
  starting_village: { x: 50, y: 99 },
}

function ConnectionLine({ from, to, explored }: { from: { x: number; y: number }; to: { x: number; y: number }; explored: boolean }) {
  return (
    <line
      x1={`${from.x}%`}
      y1={`${from.y}%`}
      x2={`${to.x}%`}
      y2={`${to.y}%`}
      stroke={explored ? 'rgba(168, 185, 255, 0.5)' : 'rgba(148, 163, 184, 0.15)'}
      strokeWidth={explored ? 2 : 1.5}
      strokeDasharray={explored ? undefined : '4 4'}
    />
  )
}

export function RegionMap({ currentRegionId, characterLevel, visitedRegions = [], conqueredRegions = [] }: RegionMapProps) {
  const regions = Object.values(REGIONS)
  const visited = new Set([...visitedRegions, currentRegionId, 'starting_village'])

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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Region Map</h3>
        <span className="text-xs text-slate-400">
          {visited.size}/{regions.length} discovered
          {conqueredRegions.length > 0 && <span className="ml-1 text-amber-400">⭐{conqueredRegions.length}</span>}
        </span>
      </div>
      <div className="relative w-full" style={{ paddingBottom: '125%' }}>
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          {connections.map(({ from, to }) => {
            const fromPos = POSITIONS[from]
            const toPos = POSITIONS[to]
            if (!fromPos || !toPos) return null
            const explored = visited.has(from) && visited.has(to)
            return (
              <ConnectionLine
                key={`${from}-${to}`}
                from={fromPos}
                to={toPos}
                explored={explored}
              />
            )
          })}
        </svg>

        {/* Region nodes */}
        {regions.map((region: Region) => {
          const pos = POSITIONS[region.id]
          if (!pos) return null
          const isCurrent = region.id === currentRegionId
          const isVisited = visited.has(region.id)
          const isConquered = conqueredRegions.includes(region.id)
          const accessible = canEnterRegion(region, characterLevel)

          return (
            <div
              key={region.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 w-24 sm:w-28 text-center rounded-lg border-2 px-1 py-1.5 transition-all ${
                isCurrent
                  ? `${DIFFICULTY_COLORS[region.difficulty]} ring-2 ring-white shadow-lg shadow-white/20 scale-110`
                  : isVisited
                  ? `${DIFFICULTY_COLORS[region.difficulty]} ${accessible ? 'opacity-80 hover:opacity-100' : 'opacity-60'}`
                  : 'border-slate-700/40 bg-slate-900/60 opacity-40 blur-[1px]'
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                zIndex: isCurrent ? 10 : 1,
              }}
              title={isVisited ? region.description : 'Unexplored region'}
            >
              <div className="text-lg leading-none">{isVisited ? region.icon : '❓'}</div>
              <div className="text-[10px] sm:text-xs font-bold text-white truncate">
                {isVisited ? region.name : '???'}
              </div>
              {isVisited ? (
                <>
                  <div className="text-[9px] text-slate-400">
                    {DIFFICULTY_LABELS[region.difficulty]}
                    {isConquered && <span className="ml-1 text-amber-400">⭐</span>}
                  </div>
                  {!accessible && !isCurrent && (
                    <div className="text-[9px] text-red-400 font-semibold">
                      Lv.{region.minLevel}+
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[9px] text-slate-500">Unexplored</div>
              )}
              {isCurrent && (
                <div className="text-[9px] text-emerald-400 font-bold animate-pulse">📍 Here</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

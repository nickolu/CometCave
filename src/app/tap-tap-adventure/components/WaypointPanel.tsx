'use client'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { getRegion, REGIONS } from '@/app/tap-tap-adventure/config/regions'

interface WaypointPanelProps {
  character: FantasyCharacter
  currentTownName: string
  onTravel: (regionId: string, landmarkId: string, cost: number) => void
  onClose: () => void
}

export function WaypointPanel({ character, currentTownName, onTravel, onClose }: WaypointPanelProps) {
  const currentRegion = character.currentRegion ?? 'green_meadows'
  const visitedTowns = (character.visitedTowns ?? []).filter(
    t => !(t.regionId === currentRegion && t.name === currentTownName)
  )

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">🗺️ Waypoints</span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>✕</button>
      </div>

      <div className="text-[10px] text-slate-400 italic">
        Travel instantly to a town you&apos;ve visited before. Cost varies by distance.
      </div>

      <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
        {visitedTowns.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-3 text-center">
            No other waypoints discovered yet. Visit more towns to unlock fast travel!
          </div>
        ) : (
          visitedTowns.map((town, i) => {
            const region = REGIONS[town.regionId]
            const isSameRegion = town.regionId === currentRegion
            const baseCost = isSameRegion ? 15 : 30
            const regionMult = getRegion(town.regionId).difficultyMultiplier
            const cost = Math.round(baseCost * regionMult)
            const canAfford = (character.gold ?? 0) >= cost

            return (
              <button
                key={`${town.landmarkId}-${town.regionId}-${i}`}
                className={`w-full text-left bg-[#252638] border rounded p-2 flex items-center gap-2 transition-colors ${
                  canAfford
                    ? 'border-[#3a3c56] hover:border-indigo-500'
                    : 'border-[#3a3c56] opacity-50 cursor-not-allowed'
                }`}
                disabled={!canAfford}
                onClick={() => canAfford && onTravel(town.regionId, town.landmarkId, cost)}
              >
                <span className="text-lg">{town.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200">{town.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {region?.icon} {region?.name ?? town.regionId}
                    {isSameRegion && ' (same region)'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[10px] font-semibold ${canAfford ? 'text-amber-400' : 'text-red-400'}`}>
                    {cost}g
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      <button className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors" onClick={onClose}>
        ← Back to Town
      </button>
    </div>
  )
}

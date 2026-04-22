'use client'

import { useState } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'

export function StatsPanel() {
  const { gameState } = useGameStore()
  const [isExpanded, setIsExpanded] = useState(true)

  const characters = gameState.characters ?? []
  const meta = gameState.metaProgression

  // Aggregate Lifetime Stats
  const totalDistance = characters.reduce((sum, c) => sum + (c.distance ?? 0), 0)
  const totalGold = characters.reduce((sum, c) => sum + (c.gold ?? 0), 0)
  const totalCharacters = characters.length
  const totalDeaths =
    characters.reduce((sum, c) => sum + (c.deathCount ?? 0), 0) +
    characters.filter(c => c.status === 'dead').length

  const allRegions = characters.flatMap(c => c.visitedRegions ?? [])
  const uniqueRegions = Array.from(new Set(allRegions))
  const totalRegionsDiscovered = uniqueRegions.length

  // Records
  const highestLevel = characters.length > 0 ? Math.max(...characters.map(c => c.level ?? 1)) : 0
  const longestRun = characters.length > 0 ? Math.max(...characters.map(c => c.distance ?? 0)) : 0
  const mostGold = characters.length > 0 ? Math.max(...characters.map(c => c.gold ?? 0)) : 0
  const mostRegions =
    characters.length > 0
      ? Math.max(...characters.map(c => (c.visitedRegions ?? []).length))
      : 0

  // Class Breakdown
  const classCounts: Record<string, number> = {}
  for (const c of characters) {
    if (c.class) {
      classCounts[c.class] = (classCounts[c.class] ?? 0) + 1
    }
  }
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1])
  const maxClassCount = classEntries.length > 0 ? classEntries[0][1] : 1

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#252640] transition-colors"
      >
        <span className="text-sm font-semibold text-slate-200">
          📊 Adventure Statistics
        </span>
        <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Lifetime Stats */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Lifetime Stats
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#161723] border border-[#3a3c56] rounded-md p-2.5">
                <div className="text-lg font-bold text-indigo-300">
                  {totalDistance.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">🗺 Distance</div>
              </div>
              <div className="bg-[#161723] border border-[#3a3c56] rounded-md p-2.5">
                <div className="text-lg font-bold text-yellow-300">
                  {totalGold.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">💰 Gold</div>
              </div>
              <div className="bg-[#161723] border border-[#3a3c56] rounded-md p-2.5">
                <div className="text-lg font-bold text-green-300">
                  {totalCharacters.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">⚔ Characters</div>
              </div>
              <div className="bg-[#161723] border border-[#3a3c56] rounded-md p-2.5">
                <div className="text-lg font-bold text-red-300">
                  {totalDeaths.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">💀 Deaths</div>
              </div>
            </div>
            <div className="mt-2 bg-[#161723] border border-[#3a3c56] rounded-md px-3 py-2 text-sm text-slate-300">
              🌍 {totalRegionsDiscovered.toLocaleString()} region{totalRegionsDiscovered !== 1 ? 's' : ''} discovered
            </div>
          </div>

          {/* Records */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Records
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">🏆 Highest Level</span>
                <span className="text-slate-200 font-medium">{highestLevel.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">🏃 Longest Run</span>
                <span className="text-slate-200 font-medium">{longestRun.toLocaleString()} steps</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">💰 Most Gold</span>
                <span className="text-slate-200 font-medium">{mostGold.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">🗺 Most Regions</span>
                <span className="text-slate-200 font-medium">{mostRegions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Class Breakdown */}
          {classEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Class Breakdown
              </h3>
              <div className="space-y-2">
                {classEntries.map(([cls, count]) => (
                  <div key={cls} className="space-y-0.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{cls}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 bg-[#161723] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(count / maxClassCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta Progression */}
          {meta && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Meta Progression
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Runs</span>
                  <span className="text-slate-200 font-medium">{(meta.totalRuns ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Soul Essence</span>
                  <span className="text-purple-300 font-medium">{(meta.totalEssenceEarned ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Best Distance</span>
                  <span className="text-slate-200 font-medium">{(meta.bestDistance ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Best Level</span>
                  <span className="text-slate-200 font-medium">{(meta.bestLevel ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

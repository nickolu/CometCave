'use client'

import { useState } from 'react'
import { BASE_BUILDINGS } from '@/app/tap-tap-adventure/config/baseBuildings'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'

export function BasePanel() {
  const { getSelectedCharacter, upgradeBuilding } = useGameStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const character = getSelectedCharacter()
  const buildingLevels = character?.campState?.buildingLevels ?? {}
  const gold = character?.gold ?? 0

  if (!isExpanded) {
    const totalLevels = Object.values(buildingLevels).reduce((sum, v) => sum + v, 0)
    const maxLevels = BASE_BUILDINGS.length * 3
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-amber-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-amber-400">&#x1F3D5; Camp Buildings</span>
          <span className="text-xs text-slate-400">{totalLevels}/{maxLevels} levels</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${maxLevels > 0 ? (totalLevels / maxLevels) * 100 : 0}%` }}
          />
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          &#x1F3D5; Camp Buildings
        </button>
        <span className="text-xs text-amber-300 font-semibold">
          &#x1F4B0; {gold.toLocaleString()}g
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {BASE_BUILDINGS.map(building => {
          const level = buildingLevels[building.id] ?? 0
          const isMaxed = level >= building.maxLevel
          const cost = isMaxed ? null : building.costPerLevel[level]
          const canAfford = cost !== null && cost !== undefined && gold >= cost

          return (
            <div
              key={building.id}
              className={`rounded-lg p-2.5 border text-xs ${
                isMaxed
                  ? 'bg-amber-950/20 border-amber-600/30'
                  : 'bg-[#161723] border-[#2a2b3f]'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none mt-0.5">{building.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${isMaxed ? 'text-amber-400' : 'text-slate-200'}`}>
                      {building.name}
                    </span>
                    {/* Level pips */}
                    <div className="flex gap-0.5 shrink-0">
                      {Array.from({ length: building.maxLevel }).map((_, i) => (
                        <span
                          key={i}
                          className={`text-[10px] ${i < level ? 'text-amber-400' : 'text-slate-600'}`}
                        >
                          {i < level ? '\u25CF' : '\u25CB'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{building.description}</p>
                  <p className="text-[10px] text-amber-300/80 mt-0.5">{building.effectDescription}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 gap-2">
                {isMaxed ? (
                  <span className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">
                    Maxed
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] text-slate-400">
                      Cost: <span className={canAfford ? 'text-amber-300' : 'text-red-400'}>{cost}g</span>
                    </span>
                    <button
                      className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                        canAfford
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                      disabled={!canAfford}
                      onClick={() => upgradeBuilding(building.id)}
                    >
                      Upgrade
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

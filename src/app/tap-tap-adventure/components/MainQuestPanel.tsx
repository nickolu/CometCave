'use client'

import { getConqueredCount, CONQUERABLE_REGIONS, TOTAL_CONQUERABLE } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

export function MainQuestPanel({ character }: { character: FantasyCharacter }) {
  const mainQuest = character.mainQuest
  if (!mainQuest) return null

  const visited = character.visitedRegions ?? ['green_meadows']
  const conquered = getConqueredCount(visited)
  const progress = conquered / TOTAL_CONQUERABLE
  const isComplete = mainQuest.status === 'completed'

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isComplete ? 'bg-amber-950/30 border-amber-700/50' : 'bg-[#1e1f30] border-indigo-700/30'}`}>
      <div className="flex justify-between items-center">
        <span className={`text-sm font-bold ${isComplete ? 'text-amber-400' : 'text-indigo-400'}`}>
          {isComplete ? '👑 Quest Complete!' : '⚔️ Main Quest'}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-300">
          {conquered}/{TOTAL_CONQUERABLE}
        </span>
      </div>
      <p className="text-xs text-white font-semibold">{mainQuest.title}</p>
      <p className="text-[10px] text-slate-400">{mainQuest.description}</p>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Regions Conquered</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Region list */}
      <div className="grid grid-cols-2 gap-1">
        {CONQUERABLE_REGIONS.map(regionId => {
          const region = getRegion(regionId)
          const isVisited = visited.includes(regionId)
          return (
            <div key={regionId} className={`text-[10px] px-1.5 py-0.5 rounded ${isVisited ? 'text-emerald-400 bg-emerald-950/30' : 'text-slate-500 bg-slate-800/50'}`}>
              {region.icon} {region.name} {isVisited ? '✓' : ''}
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      <div className="space-y-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Milestones</p>
        {mainQuest.milestones.map(m => (
          <div key={m.regionsRequired} className={`flex justify-between text-[10px] ${m.claimed ? 'text-emerald-400' : conquered >= m.regionsRequired - 1 ? 'text-yellow-400' : 'text-slate-500'}`}>
            <span>{m.claimed ? '✓' : '○'} {m.title} ({m.regionsRequired} regions)</span>
            <span>+{m.goldReward} gold</span>
          </div>
        ))}
      </div>
    </div>
  )
}

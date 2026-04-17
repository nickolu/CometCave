'use client'

import { useState } from 'react'
import { RunHistoryEntry } from '@/app/tap-tap-adventure/models/runHistory'

const REASON_STYLES: Record<RunHistoryEntry['reason'], { icon: string; color: string; label: string }> = {
  death: { icon: '💀', color: 'text-red-400', label: 'Died' },
  permadeath: { icon: '💀', color: 'text-red-700', label: 'Permadeath' },
  retirement: { icon: '🏳️', color: 'text-amber-400', label: 'Retired' },
  victory: { icon: '👑', color: 'text-green-400', label: 'Victory' },
}

function formatDistance(d: number): string {
  if (d >= 1000) return `${(d / 1000).toFixed(1)}k`
  return `${d}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

export function RunHistoryPanel({ runHistory }: { runHistory: RunHistoryEntry[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const count = runHistory.length

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-indigo-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-indigo-400">Run History</span>
          <span className="text-xs text-slate-400">{count} {count === 1 ? 'run' : 'runs'}</span>
        </div>
      </button>
    )
  }

  // Compute best run indicators
  const bestLevel = count > 0 ? Math.max(...runHistory.map(r => r.level)) : 0
  const bestDistance = count > 0 ? Math.max(...runHistory.map(r => r.distance)) : 0

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          Run History
        </button>
        <span className="text-xs text-slate-400">{count} {count === 1 ? 'run' : 'runs'}</span>
      </div>

      {count === 0 && (
        <p className="text-xs text-slate-500 italic">No completed runs yet. Finish a run to see your history here.</p>
      )}

      <div className="space-y-2">
        {runHistory.map(entry => {
          const style = REASON_STYLES[entry.reason]
          const isBestLevel = entry.level === bestLevel && bestLevel > 0
          const isBestDistance = entry.distance === bestDistance && bestDistance > 0

          return (
            <div
              key={entry.id}
              className="rounded p-2 text-xs bg-[#161723] border border-[#2a2b3f]"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-white">{entry.characterName}</span>
                <span className="text-slate-400">{entry.characterClass}</span>
                {entry.difficultyMode && entry.difficultyMode !== 'normal' && (
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-purple-900/40 text-purple-300 border border-purple-700/30 rounded px-1 py-0.5">
                    {entry.difficultyMode}
                  </span>
                )}
                <span className={`ml-auto font-semibold ${style.color}`}>
                  {style.icon} {style.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-slate-400">
                <span>
                  Lv{' '}
                  <span className={isBestLevel ? 'text-amber-300 font-semibold' : 'text-slate-200'}>
                    {entry.level}
                  </span>
                  {isBestLevel && count > 1 && <span className="text-amber-400 ml-0.5">★</span>}
                </span>
                <span>
                  Dist{' '}
                  <span className={isBestDistance ? 'text-amber-300 font-semibold' : 'text-slate-200'}>
                    {formatDistance(entry.distance)}
                  </span>
                  {isBestDistance && count > 1 && <span className="text-amber-400 ml-0.5">★</span>}
                </span>
                <span>
                  Gold <span className="text-slate-200">{entry.gold}</span>
                </span>
                <span>
                  Regions <span className="text-slate-200">{entry.regionsConquered}</span>
                </span>
                <span>
                  Essence <span className="text-slate-200">{entry.essenceEarned}</span>
                </span>
              </div>

              <div className="mt-1 text-[9px] text-slate-500">
                {formatDate(entry.endedAt)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

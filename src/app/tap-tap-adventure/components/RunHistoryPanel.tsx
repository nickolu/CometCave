'use client'

import { useState } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

const REASON_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  dead: { label: 'Slain', color: 'text-red-400', icon: '💀' },
  retired: { label: 'Retired', color: 'text-amber-400', icon: '🏆' },
}

function RunCard({ character }: { character: FantasyCharacter }) {
  const [expanded, setExpanded] = useState(false)
  const reason = REASON_CONFIG[character.status] ?? REASON_CONFIG.dead
  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const regionsVisited = (character.visitedRegions ?? []).length

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left bg-[#161723] border border-[#3a3c56] rounded-lg p-2.5 hover:border-slate-500 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{reason.icon}</span>
          <span className="font-semibold text-sm text-slate-200 truncate">{character.name}</span>
          <span className="text-xs text-slate-500">Lv.{character.level}</span>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${reason.color} bg-slate-800/60`}>
          {reason.label}
        </span>
      </div>

      {/* Quick stats row */}
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
        <span>{character.class}</span>
        <span>·</span>
        <span>{(character.distance ?? 0).toLocaleString()} km</span>
        <span>·</span>
        <span>{(character.gold ?? 0).toLocaleString()} gold</span>
        <span>·</span>
        <span>{regionsVisited} region{regionsVisited !== 1 ? 's' : ''}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-[#3a3c56] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Last Region</span>
            <span className="text-slate-300">{region.icon} {region.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Stats</span>
            <span className="text-slate-300">
              STR {character.strength} · INT {character.intelligence} · LCK {character.luck} · CHA {character.charisma}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Deaths</span>
            <span className="text-slate-300">{character.deathCount ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Difficulty</span>
            <span className="text-slate-300 capitalize">{character.difficultyMode ?? 'normal'}</span>
          </div>
          {character.equipment?.weapon && (
            <div className="flex justify-between">
              <span className="text-slate-500">Weapon</span>
              <span className="text-slate-300 truncate ml-2">{character.equipment.weapon.name}</span>
            </div>
          )}
        </div>
      )}
    </button>
  )
}

export function RunHistoryPanel() {
  const { gameState } = useGameStore()
  const [isExpanded, setIsExpanded] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'dead' | 'retired'>('all')
  const [sortBy, setSortBy] = useState<'level' | 'distance' | 'gold'>('level')

  const pastRuns = (gameState.characters ?? [])
    .filter(c => c.status === 'dead' || c.status === 'retired')
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'distance') return (b.distance ?? 0) - (a.distance ?? 0)
      if (sortBy === 'gold') return (b.gold ?? 0) - (a.gold ?? 0)
      return (b.level ?? 0) - (a.level ?? 0)
    })

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#252640] transition-colors"
      >
        <span className="text-sm font-semibold text-slate-200">
          📜 Run History
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{pastRuns.length} run{pastRuns.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2">
          <div className="flex flex-wrap gap-1 items-center text-[10px]">
            {([['all', 'All'], ['dead', '💀 Slain'], ['retired', '🏆 Retired']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-1.5 py-0.5 rounded transition-colors ${statusFilter === val ? 'bg-indigo-700/50 text-indigo-200' : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/40'}`}
              >
                {label}
              </button>
            ))}
            <span className="text-slate-600 mx-1">|</span>
            {([['level', 'Level'], ['distance', 'Distance'], ['gold', 'Gold']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSortBy(val)}
                className={`px-1.5 py-0.5 rounded transition-colors ${sortBy === val ? 'bg-indigo-700/50 text-indigo-200' : 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/40'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {pastRuns.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              No completed runs yet. Your fallen and retired characters will appear here.
            </p>
          ) : (
            pastRuns.map(char => <RunCard key={char.id} character={char} />)
          )}
        </div>
      )}
    </div>
  )
}

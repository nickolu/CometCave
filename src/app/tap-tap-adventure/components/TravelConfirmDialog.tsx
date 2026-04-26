'use client'

import { Region } from '@/app/tap-tap-adventure/config/regions'

interface TravelConfirmDialogProps {
  region: Region
  onConfirm: () => void
  onCancel: () => void
}

const DIFFICULTY_BADGE: Record<string, { label: string; classes: string }> = {
  easy:      { label: 'Easy',      classes: 'bg-green-900/60 text-green-300 border border-green-600/40' },
  medium:    { label: 'Medium',    classes: 'bg-yellow-900/60 text-yellow-300 border border-yellow-600/40' },
  hard:      { label: 'Hard',      classes: 'bg-orange-900/60 text-orange-300 border border-orange-600/40' },
  very_hard: { label: 'Very Hard', classes: 'bg-red-900/60 text-red-300 border border-red-600/40' },
  extreme:   { label: 'Extreme',   classes: 'bg-purple-950/70 text-purple-200 border border-purple-400/50' },
}

const ELEMENT_BADGE: Record<string, { label: string; classes: string }> = {
  nature: { label: 'Nature', classes: 'bg-green-900/40 text-green-300' },
  shadow: { label: 'Shadow', classes: 'bg-slate-800/60 text-slate-300' },
  arcane: { label: 'Arcane', classes: 'bg-violet-900/40 text-violet-300' },
  fire:   { label: 'Fire',   classes: 'bg-orange-900/40 text-orange-300' },
  ice:    { label: 'Ice',    classes: 'bg-cyan-900/40 text-cyan-300' },
  none:   { label: 'Neutral', classes: 'bg-slate-800/40 text-slate-400' },
}

export function TravelConfirmDialog({ region, onConfirm, onCancel }: TravelConfirmDialogProps) {
  const difficulty = DIFFICULTY_BADGE[region.difficulty] ?? DIFFICULTY_BADGE.easy
  const element = ELEMENT_BADGE[region.element] ?? ELEMENT_BADGE.none

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">{region.icon}</span>
          <div>
            <h2 className="text-lg font-bold text-white">{region.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficulty.classes}`}>
                {difficulty.label}
              </span>
              {region.element !== 'none' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${element.classes}`}>
                  {element.label}
                </span>
              )}
              {region.minLevel > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300 border border-slate-600/40">
                  Lv.{region.minLevel}+
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-300 leading-relaxed">{region.description}</p>

        {/* Enemy types */}
        {region.enemyTypes.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Enemies</p>
            <p className="text-xs text-slate-400">{region.enemyTypes.join(', ')}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Travel
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

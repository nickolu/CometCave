'use client'

import { useState } from 'react'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

interface StatAllocationScreenProps {
  character: FantasyCharacter
  onConfirm: (strength: number, intelligence: number, luck: number) => void
}

const STAT_DESCRIPTIONS: Record<string, string> = {
  strength: 'Attack power, max HP',
  intelligence: 'Defense, mana pool',
  luck: 'Crit chance, loot drops, flee chance',
}

const STAT_LABELS: Record<string, string> = {
  strength: 'STR',
  intelligence: 'INT',
  luck: 'LCK',
}

export function StatAllocationScreen({ character, onConfirm }: StatAllocationScreenProps) {
  const [allocation, setAllocation] = useState({ strength: 0, intelligence: 0, luck: 0 })

  const totalAllocated = allocation.strength + allocation.intelligence + allocation.luck
  const remaining = (character.pendingStatPoints ?? 0) - totalAllocated
  const allSpent = remaining === 0

  const addPoint = (stat: keyof typeof allocation) => {
    if (remaining <= 0) return
    setAllocation(prev => ({ ...prev, [stat]: prev[stat] + 1 }))
  }

  const removePoint = (stat: keyof typeof allocation) => {
    if (allocation[stat] <= 0) return
    setAllocation(prev => ({ ...prev, [stat]: prev[stat] - 1 }))
  }

  const handleConfirm = () => {
    if (!allSpent) return
    onConfirm(allocation.strength, allocation.intelligence, allocation.luck)
  }

  const stats = ['strength', 'intelligence', 'luck'] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative w-full max-w-sm mx-4">
        <div className="bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 border-yellow-500/50 rounded-2xl px-6 py-8 text-center shadow-2xl shadow-yellow-500/20">
          {/* Stars */}
          <div className="text-4xl mb-2">
            <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>
              *
            </span>
            <span className="inline-block animate-bounce mx-2" style={{ animationDelay: '150ms' }}>
              *
            </span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>
              *
            </span>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-yellow-400 mb-1">Level Up!</h2>
          <div className="text-5xl font-black text-white my-2">{character.level}</div>

          {/* Remaining points */}
          <p className="text-slate-300 text-sm mb-6">
            {remaining} point{remaining !== 1 ? 's' : ''} remaining
          </p>

          {/* Stat rows */}
          <div className="space-y-3 mb-6">
            {stats.map(stat => (
              <div key={stat} className="flex items-center justify-between gap-2">
                <div className="text-left flex-1">
                  <div className="text-white font-semibold text-sm">
                    {STAT_LABELS[stat]}{' '}
                    <span className="text-slate-400 font-normal">
                      {character[stat]}
                      {allocation[stat] > 0 && (
                        <span className="text-green-400"> +{allocation[stat]}</span>
                      )}
                    </span>
                  </div>
                  <div className="text-slate-500 text-xs">{STAT_DESCRIPTIONS[stat]}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="w-8 h-8 rounded bg-[#2a2b3f] border border-[#3a3c56] text-white font-bold hover:bg-[#3a3c56] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    onClick={() => removePoint(stat)}
                    disabled={allocation[stat] <= 0}
                    aria-label={`Remove point from ${STAT_LABELS[stat]}`}
                  >
                    -
                  </button>
                  <button
                    className="w-8 h-8 rounded bg-[#2a2b3f] border border-[#3a3c56] text-white font-bold hover:bg-[#3a3c56] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    onClick={() => addPoint(stat)}
                    disabled={remaining <= 0}
                    aria-label={`Add point to ${STAT_LABELS[stat]}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Confirm button */}
          <button
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all duration-200 ${
              allSpent
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400 shadow-lg shadow-yellow-500/20'
                : 'bg-[#2a2b3f] text-slate-500 cursor-not-allowed border border-[#3a3c56]'
            }`}
            onClick={handleConfirm}
            disabled={!allSpent}
          >
            {allSpent ? 'Confirm' : `Allocate ${remaining} more point${remaining !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

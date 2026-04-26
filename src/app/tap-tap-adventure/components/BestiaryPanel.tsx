'use client'

import { useState } from 'react'
import { BestiaryEntry } from '@/app/tap-tap-adventure/models/bestiary'
import { getElementalMultiplier } from '@/app/tap-tap-adventure/config/elements'
import { SpellElement } from '@/app/tap-tap-adventure/models/spell'

const ELEMENT_STYLES: Record<string, string> = {
  nature: 'bg-green-900/40 text-green-300',
  shadow: 'bg-slate-800/60 text-slate-300',
  arcane: 'bg-violet-900/40 text-violet-300',
  fire: 'bg-orange-900/40 text-orange-300',
  ice: 'bg-cyan-900/40 text-cyan-300',
  none: 'bg-slate-800/40 text-slate-400',
}

const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥', ice: '❄️', lightning: '⚡', shadow: '🌑', nature: '🌿', arcane: '✨',
}

function getElementStyle(element?: string): string {
  if (!element) return ELEMENT_STYLES['none']
  return ELEMENT_STYLES[element] ?? ELEMENT_STYLES['none']
}

function getWeaknessResistance(enemyElement?: string): { weak: SpellElement[]; resists: SpellElement[] } {
  if (!enemyElement || enemyElement === 'none') return { weak: [], resists: [] }
  const allElements: SpellElement[] = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane']
  const weak: SpellElement[] = []
  const resists: SpellElement[] = []
  for (const atk of allElements) {
    const mult = getElementalMultiplier(atk, enemyElement as SpellElement)
    if (mult >= 2.0) weak.push(atk)
    else if (mult <= 0.5) resists.push(atk)
  }
  return { weak, resists }
}

export function BestiaryPanel({ bestiary }: { bestiary: BestiaryEntry[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const count = bestiary.length

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-indigo-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-indigo-400">Bestiary</span>
          <span className="text-xs text-slate-400">{count} discovered</span>
        </div>
      </button>
    )
  }

  // Group entries by region
  const byRegion = new Map<string, BestiaryEntry[]>()
  for (const entry of bestiary) {
    const existing = byRegion.get(entry.region)
    if (existing) {
      existing.push(entry)
    } else {
      byRegion.set(entry.region, [entry])
    }
  }

  const regionKeys = Array.from(byRegion.keys())

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          Bestiary
        </button>
        <span className="text-xs text-slate-400">{count} discovered</span>
      </div>

      {count === 0 && (
        <p className="text-xs text-slate-500 italic">No monsters encountered yet. Defeat enemies to fill your bestiary.</p>
      )}

      {regionKeys.map(region => {
        const entries = byRegion.get(region)!
        const regionLabel = region
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())

        return (
          <div key={region} className="space-y-1.5">
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {regionLabel}
            </h4>
            {entries.map(entry => (
              <div
                key={entry.name}
                className="rounded p-2 text-xs bg-[#161723] border border-[#2a2b3f]"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-white">{entry.name}</span>
                  {entry.isBoss && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-900/50 text-amber-300 border border-amber-600/40 rounded px-1 py-0.5">
                      Boss
                    </span>
                  )}
                  {entry.element && (
                    <span className={`text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-0.5 ${getElementStyle(entry.element)}`}>
                      {entry.element}
                    </span>
                  )}
                  <span className="text-slate-500 ml-auto">Lv {entry.level}</span>
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                  <span>HP <span className="text-slate-200">{entry.maxHp}</span></span>
                  <span>ATK <span className="text-slate-200">{entry.attack}</span></span>
                  <span>DEF <span className="text-slate-200">{entry.defense}</span></span>
                </div>
                {(() => {
                  const { weak, resists } = getWeaknessResistance(entry.element)
                  if (weak.length === 0 && resists.length === 0) return null
                  return (
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      {weak.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-green-500">Weak:</span>
                          {weak.map(e => <span key={e} className="text-green-400" title={`${e} deals 2x`}>{ELEMENT_ICONS[e]}</span>)}
                        </span>
                      )}
                      {resists.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-red-500">Resists:</span>
                          {resists.map(e => <span key={e} className="text-red-400" title={`${e} deals 0.5x`}>{ELEMENT_ICONS[e]}</span>)}
                        </span>
                      )}
                    </div>
                  )
                })()}
                {(entry.specialAbility || entry.statusAbility) && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {entry.specialAbility && (
                      <span className="text-[9px] bg-purple-900/30 text-purple-300 border border-purple-700/30 rounded px-1 py-0.5">
                        {entry.specialAbility.name}
                      </span>
                    )}
                    {entry.statusAbility && (
                      <span className="text-[9px] bg-rose-900/30 text-rose-300 border border-rose-700/30 rounded px-1 py-0.5">
                        {entry.statusAbility.type}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex justify-between mt-1 text-[9px] text-slate-500">
                  <span>Defeated <span className="text-slate-300">{entry.timesDefeated}x</span></span>
                  <span>First seen {new Date(entry.firstEncountered).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

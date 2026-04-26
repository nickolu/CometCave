'use client'

import { useState } from 'react'
import { SPELL_COMBOS } from '@/app/tap-tap-adventure/lib/spellCombos'

const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥',
  ice: '❄️',
  lightning: '⚡',
  shadow: '🌑',
  nature: '🌿',
  arcane: '✨',
}

/** Derive the stored combo ID from the combo name (mirrors useCombatActionMutation logic) */
function comboNameToId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function getEffectDescription(result: (typeof SPELL_COMBOS)[0]['result']): string {
  const parts: string[] = []
  if (result.damageMultiplier > 1.0) {
    parts.push(`${result.damageMultiplier}x damage`)
  }
  if (result.ignoreDefense) {
    parts.push('ignores defense')
  }
  if (result.bonusHealPct > 0) {
    parts.push(`heals ${Math.round(result.bonusHealPct * 100)}% max HP`)
  }
  if (result.chainHit) {
    parts.push('chain hit at 50% damage')
  }
  if (result.removeEnemyDefenseBuff) {
    parts.push('halves enemy defense')
  }
  if (result.slowEnemy) {
    parts.push('slows enemy')
  }
  return parts.join(', ')
}

interface SpellComboPanelProps {
  discoveredCombos: string[]
}

export function SpellComboPanel({ discoveredCombos }: SpellComboPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const discoveredCount = SPELL_COMBOS.filter(c =>
    discoveredCombos.includes(comboNameToId(c.result.comboName))
  ).length

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-indigo-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-indigo-400">Spell Combos</span>
          <span className="text-xs text-slate-400">{discoveredCount} / {SPELL_COMBOS.length} discovered</span>
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-indigo-400">Spell Combos</span>
        <button
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          Collapse
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Discovered: {discoveredCount} / {SPELL_COMBOS.length}
      </p>

      <div className="space-y-2">
        {SPELL_COMBOS.map((combo) => {
          const comboId = comboNameToId(combo.result.comboName)
          const isDiscovered = discoveredCombos.includes(comboId)
          const elementCount = combo.sequence.length

          if (isDiscovered) {
            return (
              <div
                key={comboId}
                className="bg-[#161723] border border-indigo-900/40 rounded-md p-2 space-y-1"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 text-sm">&#10003;</span>
                  <span className="text-sm font-semibold text-indigo-300">{combo.result.comboName}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {combo.sequence.map((el, i) => (
                    <span key={i} className="flex items-center gap-0.5 text-xs text-slate-300">
                      {i > 0 && <span className="text-slate-600 mx-0.5">+</span>}
                      <span>{ELEMENT_ICONS[el] ?? el}</span>
                      <span className="capitalize">{el}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400">{getEffectDescription(combo.result)}</p>
              </div>
            )
          }

          return (
            <div
              key={comboId}
              className="bg-[#161723] border border-slate-700/40 rounded-md p-2 space-y-1 opacity-60"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-sm">?</span>
                <span className="text-sm font-semibold text-slate-500">???</span>
                <span className="text-xs text-slate-600 ml-auto">{elementCount}-element combo</span>
              </div>
              <p className="text-xs text-slate-600">Discover by casting the right sequence!</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

import { SPELL_COMBOS } from '@/app/tap-tap-adventure/lib/spellCombos'
import { PaperButton, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

/** The printer's ink for each element. */
const ELEMENT_TONE: Record<string, StampTone> = {
  fire: 'red',
  ice: 'blue',
  lightning: 'gold',
  shadow: 'violet',
  nature: 'green',
  arcane: 'violet',
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
  const [isExpanded, setIsExpanded] = useState(true)

  const discoveredCount = SPELL_COMBOS.filter(c =>
    discoveredCombos.includes(comboNameToId(c.result.comboName))
  ).length

  const tally = (
    <Stamp tone="ink" tilt={false} title={`${discoveredCount} of ${SPELL_COMBOS.length} combos found`}>
      {discoveredCount}/{SPELL_COMBOS.length} found
    </Stamp>
  )

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-[3px] border-2 border-ps-ink p-3 text-left transition-colors hover:bg-ps-playbill-shade focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        onClick={() => setIsExpanded(true)}
        aria-expanded={false}
      >
        <PlaybillTitle size="sm" rules={false} className="text-left">Spell combos</PlaybillTitle>
        {tally}
      </button>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ps-ink pb-2">
        <PlaybillTitle size="sm" rules={false} className="text-left">Spell combos</PlaybillTitle>
        <div className="flex items-center gap-2">
          {tally}
          <PaperButton size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setIsExpanded(false)} aria-expanded>
            Fold
          </PaperButton>
        </div>
      </div>
      <p className="mt-2 font-body text-xs text-ps-ink-soft">Cast spells of these elements in order during a fight and the combo fires.</p>

      <ul className="m-0 mt-1 list-none p-0">
        {SPELL_COMBOS.map((combo) => {
          const comboId = comboNameToId(combo.result.comboName)
          const isDiscovered = discoveredCombos.includes(comboId)
          const elementCount = combo.sequence.length

          if (isDiscovered) {
            return (
              <li key={comboId} className="border-b-2 border-dotted border-ps-ink/40 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-body text-base font-medium leading-tight text-ps-ink">{combo.result.comboName}</span>
                  <Stamp tone="green" tilt={false}>Found</Stamp>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Sequence">
                  {combo.sequence.map((el, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="font-playbill text-xs text-ps-ink-soft" aria-hidden>+</span>}
                      <Stamp tone={ELEMENT_TONE[el] ?? 'ink'} tilt={false} className="capitalize">{el}</Stamp>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 font-body text-xs leading-snug text-ps-ink-soft">{getEffectDescription(combo.result)}</p>
              </li>
            )
          }

          return (
            <li key={comboId} className="border-b-2 border-dotted border-ps-ink/40 py-3 text-ps-ink-faint last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="font-playbill text-lg leading-none" aria-hidden>?</span>
                <span className="font-body text-base font-medium leading-tight">Not yet found</span>
                <span className="ml-auto font-label text-xs font-bold uppercase tracking-widest">{elementCount} elements</span>
              </div>
              <p className="mt-1 font-body text-xs italic leading-snug">Cast the right sequence in a fight to find it.</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

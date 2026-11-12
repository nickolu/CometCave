'use client'

/**
 * Status effects as the printer's stamps: a debuff is stamped in red, a buff
 * in green, and the number is the turns it has left. Tap a stamp to read
 * what it does on a small paper slip.
 */
import { useState } from 'react'

import { ActiveSpellEffect, CombatBuff, StatusEffect } from '@/app/tap-tap-adventure/models/combat'
import { Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

interface StatusEffectsHUDProps {
  statusEffects: StatusEffect[]
  activeBuffs: CombatBuff[]
  activeSpellEffects: ActiveSpellEffect[]
  side: 'player' | 'enemy'
}

const DEBUFF_TYPES = new Set(['poison', 'burn', 'curse', 'slow', 'fear'])
const BUFF_TYPES = new Set(['berserk', 'thorns', 'reflect', 'shield', 'defending'])

function getStatusEffectTone(type: string): StampTone {
  if (DEBUFF_TYPES.has(type)) return 'red'
  if (BUFF_TYPES.has(type)) return 'green'
  return 'ink'
}

function getSpellEffectTone(effectType: string): StampTone {
  if (effectType === 'heal_over_time') return 'green'
  if (effectType === 'damage_reduction') return 'green'
  if (effectType === 'damage_over_time' || effectType === 'bleed') return 'red'
  return 'violet'
}

function getStatusEffectDescription(effect: StatusEffect): string {
  if (effect.value > 0) {
    return `Takes ${effect.value} ${effect.type} damage per turn`
  }
  const descriptions: Record<string, string> = {
    slow: 'Movement and attack speed reduced',
    curse: 'Attack and defense lowered',
    fear: 'May skip attacks from fear',
    thorns: 'Reflects damage back to attacker',
    berserk: 'Attack increased but defense lowered',
    reflect: 'Reflects a portion of incoming damage',
    defending: 'Defense stance active',
  }
  return descriptions[effect.type] ?? `${effect.name} is active`
}

function getSpellEffectDescription(effect: ActiveSpellEffect): string {
  const descriptions: Record<string, string> = {
    heal_over_time: `Restores ${effect.value} HP per turn`,
    damage_reduction: `Reduces incoming damage by ${effect.percentage ?? effect.value}%`,
    damage_over_time: `Deals ${effect.value} damage per turn`,
    bleed: `Deals ${effect.value} bleed damage per turn`,
  }
  return descriptions[effect.effectType] ?? `${effect.effectType.replace(/_/g, ' ')} is active`
}

interface EffectPillProps {
  name: string
  turnsRemaining: number
  tone: StampTone
  tooltipTitle: string
  tooltipDescription: string
  isNew?: boolean
}

function EffectPill({ name, turnsRemaining, tone, tooltipTitle, tooltipDescription, isNew }: EffectPillProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const turnsText = `${turnsRemaining} turn${turnsRemaining !== 1 ? 's' : ''} remaining`

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        onClick={() => setShowTooltip(v => !v)}
        onBlur={() => setShowTooltip(false)}
        aria-expanded={showTooltip}
        aria-label={`${tooltipTitle}: ${tooltipDescription}. ${turnsText}`}
      >
        <Stamp tone={tone} tilt={false} animate={isNew} className="cursor-pointer select-none">
          <span className="max-w-[140px] truncate">{name}</span>
          <span className="border-l border-current pl-1 tabular-nums opacity-80">{turnsRemaining}</span>
        </Stamp>
      </button>
      {showTooltip && (
        <div className="ps-paper-flat absolute left-0 top-full z-50 mt-1 w-44 rounded-[3px] border-2 border-ps-ink p-2 text-left" role="tooltip">
          <p className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink">{tooltipTitle}</p>
          <p className="mt-0.5 font-body text-xs leading-snug text-ps-ink">{tooltipDescription}</p>
          <p className="mt-1 font-body text-xs text-ps-ink-soft">{turnsText}</p>
        </div>
      )}
    </div>
  )
}

export function StatusEffectsHUD({ statusEffects, activeBuffs, activeSpellEffects, side: _side }: StatusEffectsHUDProps) {
  const hasAny =
    statusEffects.length > 0 ||
    activeBuffs.length > 0 ||
    activeSpellEffects.length > 0

  if (!hasAny) return null

  const debuffs = statusEffects.filter(e => DEBUFF_TYPES.has(e.type))
  const buffs = statusEffects.filter(e => !DEBUFF_TYPES.has(e.type))

  return (
    <div className="ps-scroll flex max-h-20 flex-wrap gap-1.5 overflow-y-auto py-0.5">
      {/* Debuffs first */}
      {debuffs.map((effect, i) => (
        <EffectPill
          key={`debuff-${effect.id ?? i}`}
          name={effect.name}
          turnsRemaining={effect.turnsRemaining}
          tone={getStatusEffectTone(effect.type)}
          tooltipTitle={effect.name}
          tooltipDescription={getStatusEffectDescription(effect)}
        />
      ))}
      {/* Buffs (non-debuff status effects) */}
      {buffs.map((effect, i) => (
        <EffectPill
          key={`buff-status-${effect.id ?? i}`}
          name={effect.name}
          turnsRemaining={effect.turnsRemaining}
          tone={getStatusEffectTone(effect.type)}
          tooltipTitle={effect.name}
          tooltipDescription={getStatusEffectDescription(effect)}
        />
      ))}
      {/* Stat buffs */}
      {activeBuffs.map((buff, i) => (
        <EffectPill
          key={`statbuff-${i}`}
          name={`+${buff.value} ${buff.stat}`}
          turnsRemaining={buff.turnsRemaining}
          tone="green"
          tooltipTitle={`${buff.stat} Buff`}
          tooltipDescription={`Increases ${buff.stat} by ${buff.value}`}
        />
      ))}
      {/* Spell effects */}
      {activeSpellEffects.map((effect, i) => (
        <EffectPill
          key={`spell-${effect.spellId}-${i}`}
          name={effect.effectType.replace(/_/g, ' ')}
          turnsRemaining={effect.turnsRemaining}
          tone={getSpellEffectTone(effect.effectType)}
          tooltipTitle={effect.effectType.replace(/_/g, ' ')}
          tooltipDescription={getSpellEffectDescription(effect)}
        />
      ))}
    </div>
  )
}

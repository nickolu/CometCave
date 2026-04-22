'use client'

import { useState } from 'react'

import { StatusEffect, CombatBuff, ActiveSpellEffect } from '@/app/tap-tap-adventure/models/combat'

interface StatusEffectsHUDProps {
  statusEffects: StatusEffect[]
  activeBuffs: CombatBuff[]
  activeSpellEffects: ActiveSpellEffect[]
  side: 'player' | 'enemy'
}

const STATUS_EFFECT_ICONS: Record<string, string> = {
  poison: '☠️',
  burn: '🔥',
  slow: '🐌',
  curse: '💀',
  thorns: '🌿',
  berserk: '😡',
  fear: '😨',
  reflect: '🪞',
}

const SPELL_EFFECT_ICONS: Record<string, string> = {
  heal_over_time: '💚',
  damage_reduction: '🛡️',
  damage_over_time: '🩸',
  bleed: '🩸',
}

const DEBUFF_TYPES = new Set(['poison', 'burn', 'curse', 'slow', 'fear'])
const BUFF_TYPES = new Set(['berserk', 'thorns', 'reflect', 'shield', 'defending'])

function getStatusEffectStyle(type: string): string {
  if (DEBUFF_TYPES.has(type)) {
    const map: Record<string, string> = {
      poison: 'bg-green-950/60 border-green-700/60 text-green-300',
      burn: 'bg-orange-950/60 border-orange-700/60 text-orange-300',
      slow: 'bg-blue-950/60 border-blue-700/60 text-blue-300',
      curse: 'bg-purple-950/60 border-purple-700/60 text-purple-300',
      fear: 'bg-yellow-950/60 border-yellow-700/60 text-yellow-300',
    }
    return map[type] ?? 'bg-red-950/60 border-red-700/60 text-red-300'
  }
  if (BUFF_TYPES.has(type)) {
    const map: Record<string, string> = {
      berserk: 'bg-red-950/60 border-red-600/60 text-red-300',
      thorns: 'bg-green-950/60 border-green-600/60 text-green-300',
      reflect: 'bg-slate-800/60 border-slate-500/60 text-slate-300',
      shield: 'bg-cyan-950/60 border-cyan-600/60 text-cyan-300',
      defending: 'bg-blue-950/60 border-blue-600/60 text-blue-300',
    }
    return map[type] ?? 'bg-green-950/60 border-green-600/60 text-green-300'
  }
  return 'bg-slate-800/60 border-slate-600/60 text-slate-300'
}

function getSpellEffectStyle(effectType: string): string {
  if (effectType === 'heal_over_time') return 'bg-green-950/60 border-green-600/60 text-green-300'
  if (effectType === 'damage_reduction') return 'bg-cyan-950/60 border-cyan-600/60 text-cyan-300'
  if (effectType === 'damage_over_time' || effectType === 'bleed') return 'bg-red-950/60 border-red-600/60 text-red-300'
  return 'bg-purple-950/60 border-purple-600/60 text-purple-300'
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
  icon: string
  name: string
  turnsRemaining: number
  styleClass: string
  tooltipTitle: string
  tooltipDescription: string
  isNew?: boolean
}

function EffectPill({ icon, name, turnsRemaining, styleClass, tooltipTitle, tooltipDescription, isNew }: EffectPillProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-all cursor-pointer select-none ${styleClass} ${isNew ? 'animate-pulse' : ''}`}
        onClick={() => setShowTooltip(v => !v)}
        onBlur={() => setShowTooltip(false)}
      >
        <span>{icon}</span>
        <span className="max-w-[48px] truncate leading-tight">{name}</span>
        <span className="opacity-70 shrink-0">{turnsRemaining}t</span>
      </button>
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 z-50 w-44 bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-lg text-left">
          <p className="text-xs font-semibold text-white mb-0.5">{tooltipTitle}</p>
          <p className="text-[10px] text-slate-300 leading-snug">{tooltipDescription}</p>
          <p className="text-[10px] text-slate-400 mt-1">{turnsRemaining} turn{turnsRemaining !== 1 ? 's' : ''} remaining</p>
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
    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
      {/* Debuffs first */}
      {debuffs.map((effect, i) => (
        <EffectPill
          key={`debuff-${effect.id ?? i}`}
          icon={STATUS_EFFECT_ICONS[effect.type] ?? '⬡'}
          name={effect.name}
          turnsRemaining={effect.turnsRemaining}
          styleClass={getStatusEffectStyle(effect.type)}
          tooltipTitle={effect.name}
          tooltipDescription={getStatusEffectDescription(effect)}
        />
      ))}
      {/* Buffs (non-debuff status effects) */}
      {buffs.map((effect, i) => (
        <EffectPill
          key={`buff-status-${effect.id ?? i}`}
          icon={STATUS_EFFECT_ICONS[effect.type] ?? '⬡'}
          name={effect.name}
          turnsRemaining={effect.turnsRemaining}
          styleClass={getStatusEffectStyle(effect.type)}
          tooltipTitle={effect.name}
          tooltipDescription={getStatusEffectDescription(effect)}
        />
      ))}
      {/* Stat buffs */}
      {activeBuffs.map((buff, i) => (
        <EffectPill
          key={`statbuff-${i}`}
          icon="⬆️"
          name={`+${buff.value} ${buff.stat}`}
          turnsRemaining={buff.turnsRemaining}
          styleClass="bg-emerald-950/60 border-emerald-600/60 text-emerald-300"
          tooltipTitle={`${buff.stat} Buff`}
          tooltipDescription={`Increases ${buff.stat} by ${buff.value}`}
        />
      ))}
      {/* Spell effects */}
      {activeSpellEffects.map((effect, i) => (
        <EffectPill
          key={`spell-${effect.spellId}-${i}`}
          icon={SPELL_EFFECT_ICONS[effect.effectType] ?? '✨'}
          name={effect.effectType.replace(/_/g, ' ')}
          turnsRemaining={effect.turnsRemaining}
          styleClass={getSpellEffectStyle(effect.effectType)}
          tooltipTitle={effect.effectType.replace(/_/g, ' ')}
          tooltipDescription={getSpellEffectDescription(effect)}
        />
      ))}
    </div>
  )
}

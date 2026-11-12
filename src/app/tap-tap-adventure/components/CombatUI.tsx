'use client'


/**
 * The fight's bill. The hero and the enemy are already cut out on the
 * scenery above with their health meters; this is the printed sheet on the
 * apron under them: who you face, your figures on brass, the log of blows,
 * and the commands you can give. Comet Mint never appears here.
 */
import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { StatusEffectsHUD } from '@/app/tap-tap-adventure/components/StatusEffectsHUD'
import { AP_COSTS } from '@/app/tap-tap-adventure/config/apCosts'
import { CLASS_ABILITIES } from '@/app/tap-tap-adventure/config/characterOptions'
import { getElementalMultiplier } from '@/app/tap-tap-adventure/config/elements'
import { getWeatherType } from '@/app/tap-tap-adventure/config/weather'
import { useCombatActionMutation } from '@/app/tap-tap-adventure/hooks/useCombatActionMutation'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { isUsableInCombat } from '@/app/tap-tap-adventure/lib/combatItemEffects'
import { getDeathFlavorText, getPermadeathEpitaph, getStoryContext } from '@/app/tap-tap-adventure/lib/deathFlavorText'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { SPELL_COMBOS } from '@/app/tap-tap-adventure/lib/spellCombos'
import { getXpForNextLevel } from '@/app/tap-tap-adventure/lib/spellProgression'
import { CombatAction, CombatState } from '@/app/tap-tap-adventure/models/combat'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { Spell, SpellElement } from '@/app/tap-tap-adventure/models/spell'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { WeatherGlyph } from '@/app/tap-tap-adventure/stage/glyphs'
import {
  BrassFigure,
  BrassPlate,
  PaperButton,
  PlaybillCaption,
  PlaybillLine,
  type PlaybillLineProps,
  PlaybillRule,
  PlaybillTitle,
  PrintingDots,
  Stamp,
  type StampTone,
} from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

import type { DamageEvent } from './FloatingDamage'

/* ── Small printed parts ────────────────────────────────────────────── */

const ELEMENT_TONE: Record<string, StampTone> = {
  fire: 'red',
  ice: 'blue',
  lightning: 'gold',
  shadow: 'violet',
  nature: 'green',
  arcane: 'violet',
}

/** The printed key badge at the left of a command line (same circle as a PlaybillLine index). */
function KeyBadge({ letter }: { letter?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current font-playbill text-xs leading-none',
        !letter && 'invisible'
      )}
    >
      {letter ?? '·'}
    </span>
  )
}

/** A command on the bill: key badge, name, cost stamp. */
function CommandLine({
  letter,
  cost,
  trailing,
  children,
  className,
  ...rest
}: PlaybillLineProps & { letter?: string; cost?: React.ReactNode }) {
  return (
    <PlaybillLine
      className={cn('py-2', className)}
      trailing={
        <>
          {trailing}
          {cost && (
            <Stamp tone="ink" tilt={false} className="group-hover:border-ps-playbill group-hover:text-ps-playbill">
              {cost}
            </Stamp>
          )}
        </>
      }
      {...rest}
    >
      <span className="flex items-start gap-3">
        <KeyBadge letter={letter} />
        <span className="min-w-0 flex-1">{children}</span>
      </span>
    </PlaybillLine>
  )
}

/** A thin printed meter for a companion's health (the hero's own figures sit on brass). */
function PaperMeter({ current, max, label, tone = 'auto' }: { current: number; max: number; label: React.ReactNode; tone?: 'auto' | 'ink' | 'dim' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const fill = tone === 'dim' ? 'bg-ps-ink/40' : tone === 'ink' ? 'bg-ps-ink' : pct > 50 ? 'bg-ps-stamp-green' : pct > 25 ? 'bg-ps-ink' : 'bg-ps-stamp-red'
  const labelText = typeof label === 'string' ? label : undefined
  return (
    <div className="flex items-center gap-2">
      <span className={cn('min-w-0 flex-1 truncate font-label text-xs font-bold uppercase tracking-widest', tone === 'dim' ? 'text-ps-ink-soft line-through' : 'text-ps-ink')}>
        {label}
      </span>
      <span
        className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-ps-ink/20 sm:w-28"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={labelText}
      >
        <span className={cn('block h-full rounded-full transition-[width] duration-300', fill)} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-14 shrink-0 text-right font-playbill text-xs tabular-nums text-ps-ink">
        {current}/{max}
      </span>
    </div>
  )
}

/** Damage numbers that float off the bill: red when it lands on you, ink when it lands on them. */
function PaperDamage({ events }: { events: DamageEvent[] }) {
  return (
    <>
      {events.map(event => {
        const isPlayer = event.target === 'player'
        const offset = ((event.id.charCodeAt(0) ?? 0) % 5) * 12 - 30
        return (
          <span
            key={event.id}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-0 z-20 inline-flex items-center gap-1 animate-float-up font-playbill tabular-nums',
              isPlayer ? 'text-ps-stamp-red' : 'text-ps-ink',
              event.isCritical ? 'text-3xl' : event.isDot ? 'text-sm italic' : 'text-xl'
            )}
            style={{ left: `calc(50% + ${offset}px)` }}
          >
            {event.isDot ? event.amount : `−${event.amount}`}
            {event.isCritical && <Stamp tone="gold" className="bg-ps-playbill">Crit</Stamp>}
            {event.effectiveness === 'super' && <Stamp tone="gold" tilt={false} className="bg-ps-playbill">×2</Stamp>}
            {event.effectiveness === 'resisted' && <Stamp tone="blue" tilt={false} className="bg-ps-playbill">½</Stamp>}
          </span>
        )
      })}
    </>
  )
}

function ElementalMatchup({ enemyElement }: { enemyElement: SpellElement | undefined }) {
  if (!enemyElement || enemyElement === 'none') return null

  const allElements: SpellElement[] = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane']
  const strong: SpellElement[] = []
  const weak: SpellElement[] = []

  for (const atk of allElements) {
    const mult = getElementalMultiplier(atk, enemyElement)
    if (mult >= 2.0) strong.push(atk)
    else if (mult <= 0.5) weak.push(atk)
  }

  if (strong.length === 0 && weak.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {strong.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          <PlaybillCaption className="text-xs">Weak to</PlaybillCaption>
          {strong.map(e => (
            <Stamp key={e} tone="green" tilt={false} title={`${e} deals 2x damage`}>
              {e}
            </Stamp>
          ))}
        </span>
      )}
      {weak.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          <PlaybillCaption className="text-xs">Resists</PlaybillCaption>
          {weak.map(e => (
            <Stamp key={e} tone="red" tilt={false} title={`${e} deals 0.5x damage`}>
              {e}
            </Stamp>
          ))}
        </span>
      )}
    </div>
  )
}

function WeatherBanner({ weatherId }: { weatherId: string }) {
  if (!weatherId || weatherId === 'clear') return null
  const weather = getWeatherType(weatherId)
  if (weather.id === 'clear') return null

  const effects: string[] = []
  if (weather.accuracyMod > 0) effects.push(`-${Math.round(weather.accuracyMod * 100)}% enemy accuracy`)
  if (weather.critChanceMod > 0) effects.push(`+${Math.round(weather.critChanceMod * 100)}% crit chance`)
  if (weather.fireDamageMod > 0) effects.push(`+${Math.round(weather.fireDamageMod * 100)}% fire`)
  if (weather.fireDamageMod < 0) effects.push(`${Math.round(weather.fireDamageMod * 100)}% fire`)
  if (weather.iceDamageMod > 0) effects.push(`+${Math.round(weather.iceDamageMod * 100)}% ice`)
  if (weather.iceDamageMod < 0) effects.push(`${Math.round(weather.iceDamageMod * 100)}% ice`)
  if (weather.lightningDamageMod > 0) effects.push(`+${Math.round(weather.lightningDamageMod * 100)}% lightning`)

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-[3px] border border-ps-ink/50 bg-ps-playbill-shade px-2 py-1">
      <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink">
        <WeatherGlyph id={weather.id} className="mr-1" />
        {weather.name}
      </span>
      {effects.length > 0 && (
        <span className="font-body text-xs leading-none text-ps-ink-soft">
          {effects.map((e, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1">·</span>}
              <span className={e.startsWith('-') ? 'text-ps-stamp-red' : 'text-ps-stamp-green'}>{e}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

/* ── Spell combos (a reference list, folded by default) ─────────────── */

/** Derive the stored combo ID from the combo name (mirrors useCombatActionMutation logic) */
function comboNameToId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function getComboEffectDescription(result: (typeof SPELL_COMBOS)[0]['result']): string {
  const parts: string[] = []
  if (result.damageMultiplier > 1.0) parts.push(`${result.damageMultiplier}x damage`)
  if (result.ignoreDefense) parts.push('ignores defense')
  if (result.bonusHealPct > 0) parts.push(`heals ${Math.round(result.bonusHealPct * 100)}% max HP`)
  if (result.chainHit) parts.push('chain hit at 50% damage')
  if (result.removeEnemyDefenseBuff) parts.push('halves enemy defense')
  if (result.slowEnemy) parts.push('slows enemy')
  return parts.join(', ')
}

function SpellCombos({ discoveredCombos }: { discoveredCombos: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const discoveredCount = SPELL_COMBOS.filter(c => discoveredCombos.includes(comboNameToId(c.result.comboName))).length

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <PlaybillCaption>
          Spell combos <span className="text-ps-ink">· {discoveredCount} of {SPELL_COMBOS.length} found</span>
        </PlaybillCaption>
        <PaperButton variant="outline" size="sm" onClick={() => setIsExpanded(v => !v)} aria-expanded={isExpanded}>
          {isExpanded ? 'Fold' : 'Open'}
        </PaperButton>
      </div>
      {isExpanded && (
        <ul className="mt-2 divide-y divide-dotted divide-ps-ink/40 rounded-[3px] border-2 border-ps-ink px-3">
          {SPELL_COMBOS.map(combo => {
            const comboId = comboNameToId(combo.result.comboName)
            const isDiscovered = discoveredCombos.includes(comboId)
            return (
              <li key={comboId} className="py-2 font-body text-xs leading-snug">
                {isDiscovered ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-playbill text-sm uppercase tracking-wide text-ps-ink">{combo.result.comboName}</span>
                      {combo.sequence.map((el, i) => (
                        <Stamp key={i} tone={ELEMENT_TONE[el] ?? 'ink'} tilt={false}>{el}</Stamp>
                      ))}
                    </div>
                    <p className="mt-0.5 text-ps-ink-soft">{getComboEffectDescription(combo.result)}</p>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-ps-ink-soft">
                    <span className="font-playbill text-sm uppercase tracking-wide">? ? ?</span>
                    <span>{combo.sequence.length}-element combo · cast the right sequence to find it</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── The fight ──────────────────────────────────────────────────────── */

interface CombatUIProps {
  combatState: CombatState
}

export function CombatUI({ combatState }: CombatUIProps) {
  const { getSelectedCharacter, setMount } = useGameStore()
  const [pendingMountDrop, setPendingMountDrop] = useState<Mount | null>(null)
  const { mutate: combatAction, isPending } = useCombatActionMutation({
    onMountDrop: (mount) => setPendingMountDrop(mount),
  })
  const [showItemMenu, setShowItemMenu] = useState(false)
  const [showSpellMenu, setShowSpellMenu] = useState(false)
  const [showFullLog, setShowFullLog] = useState(false)
  const [showEnemyDesc, setShowEnemyDesc] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([])
  const [showCritFlash, setShowCritFlash] = useState(false)
  const [comboKey, setComboKey] = useState(0)
  const [spellComboFlash, setSpellComboFlash] = useState<string | null>(null)
  const prevLogLenRef = useRef(0)
  const [prevCombo, setPrevCombo] = useState(0)
  const [effectivenessFlash, setEffectivenessFlash] = useState<'super' | 'resisted' | null>(null)

  const character = getSelectedCharacter()
  const { enemy, playerState, combatLog, scenario, status } = combatState

  // Combo pulse detection: the stamp is re-keyed (and so re-stamped) when the combo grows.
  const currentCombo = playerState.comboCount ?? 0
  if (currentCombo !== prevCombo) {
    setPrevCombo(currentCombo)
    if (currentCombo > prevCombo && currentCombo > 0) {
      setComboKey(k => k + 1)
    }
  }

  // Detect new combat log entries and create floating damage events
  useEffect(() => {
    const prevLen = prevLogLenRef.current
    if (combatLog.length > prevLen) {
      const newEntries = combatLog.slice(prevLen)
      const newDamageEvents: DamageEvent[] = newEntries
        .filter(entry => entry.damage && entry.damage > 0)
        .map((entry, i) => {
          const isDot = entry.action === 'status_effect'
          const dotType = isDot
            ? entry.description.toLowerCase().includes('poison') ? 'poison' as const
              : entry.description.toLowerCase().includes('burn') ? 'burn' as const
              : undefined
            : undefined

          // Detect elemental effectiveness from description
          let effectiveness: 'super' | 'resisted' | null = null
          if (entry.description.includes('Super effective')) effectiveness = 'super'
          else if (entry.description.includes('Resisted')) effectiveness = 'resisted'

          return {
            id: `${combatLog.length}-${i}-${Date.now()}`,
            amount: entry.damage!,
            isCritical: entry.isCritical ?? false,
            target: (entry.actor === 'enemy' ? 'player' : 'enemy') as 'player' | 'enemy',
            isDot,
            dotType,
            effectiveness,
          }
        })

      if (newDamageEvents.length > 0) {
        setDamageEvents(prev => [...prev, ...newDamageEvents])
        // Auto-cleanup after animation
        setTimeout(() => {
          setDamageEvents(prev => prev.filter(e => !newDamageEvents.some(ne => ne.id === e.id)))
        }, 1100)
      }

      // Critical hit flash
      if (newEntries.some(e => e.isCritical)) {
        setShowCritFlash(true)
        setTimeout(() => setShowCritFlash(false), 500)
      }

      // Elemental effectiveness flash
      const effectivenessEntry = newEntries.find(e =>
        e.description.includes('Super effective') || e.description.includes('Resisted')
      )
      if (effectivenessEntry) {
        const type = effectivenessEntry.description.includes('Super effective') ? 'super' : 'resisted'
        setEffectivenessFlash(type)
        setTimeout(() => setEffectivenessFlash(null), 1200)
      }

      // Spell combo flash
      const comboEntry = newEntries.find(e => e.action === 'spell_combo')
      if (comboEntry) {
        const match = comboEntry.description.match(/^COMBO: ([^!]+)!/)
        setSpellComboFlash(match?.[1] ?? 'Combo!')
        setTimeout(() => setSpellComboFlash(null), 1800)
      }
    }
    prevLogLenRef.current = combatLog.length
  }, [combatLog])

  // Determine if player can attack at current distance based on weapon range
  const weaponRange = character?.equipment?.weapon?.effects?.range ?? 'close'
  const distanceOrder = ['close', 'mid', 'far'] as const
  const weaponReach = distanceOrder.indexOf(weaponRange as (typeof distanceOrder)[number])
  const currentDistIdx = distanceOrder.indexOf(
    (combatState.combatDistance ?? 'mid') as (typeof distanceOrder)[number]
  )
  const canAttackAtDistance = currentDistIdx <= weaponReach

  const combatItems = (character?.inventory ?? []).filter(
    (i: Item) => i.status !== 'deleted' && isUsableInCombat(i)
  )

  const classId = character?.class?.toLowerCase() ?? ''
  const classAbility = CLASS_ABILITIES[classId]
  const abilityCooldown = playerState.abilityCooldown ?? 0

  const spellbook = (character?.spellbook ?? []).filter(
    (s): s is Spell => !!s && !!s.id && !!s.name
  )
  const spellCooldowns = playerState.spellCooldowns ?? {}
  const currentMana = playerState.mana ?? 0
  const maxMana = playerState.maxMana ?? 0
  const readySpellCount = spellbook.filter(
    (s: Spell) => (spellCooldowns[s.id] ?? 0) === 0 && currentMana >= (s.manaCost ?? 0)
  ).length

  const handleAction = useCallback(
    (action: CombatAction, itemId?: string) => {
      setShowItemMenu(false)
      setShowSpellMenu(false)
      combatAction({ action, itemId })
    },
    [combatAction]
  )

  // Keyboard shortcuts for combat actions
  useEffect(() => {
    if (status !== 'active') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPending) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const ap = playerState.ap ?? 3
      switch (e.key.toLowerCase()) {
        case 'a': // Attack
          if (ap >= (AP_COSTS.attack ?? 1) && canAttackAtDistance) { e.preventDefault(); handleAction('attack') }
          break
        case 'h': // Heavy Attack
          if (ap >= (AP_COSTS.heavy_attack ?? 2) && canAttackAtDistance) { e.preventDefault(); handleAction('heavy_attack') }
          break
        case 'd': // Defend
          if (ap >= (AP_COSTS.defend ?? 1)) { e.preventDefault(); handleAction('defend') }
          break
        case 'f': // Flee
          if (ap >= (AP_COSTS.flee ?? 3)) { e.preventDefault(); handleAction('flee') }
          break
        case 'q': // Move Closer
          if ((ap >= (AP_COSTS.move_closer ?? 1) || (playerState.mountMovesRemaining ?? 0) > 0) && combatState.combatDistance !== 'close' && ((playerState.stamina ?? 6) > 0 || (playerState.mountMovesRemaining ?? 0) > 0)) { e.preventDefault(); handleAction('move_closer') }
          break
        case 'e': // Move Away
          if ((ap >= (AP_COSTS.move_away ?? 1) || (playerState.mountMovesRemaining ?? 0) > 0) && combatState.combatDistance !== 'far' && ((playerState.stamina ?? 6) > 0 || (playerState.mountMovesRemaining ?? 0) > 0)) { e.preventDefault(); handleAction('move_away') }
          break
        case 'z': // End Turn
          e.preventDefault(); handleAction('end_turn')
          break
        case '5': // Class Ability
          if (classAbility && abilityCooldown === 0 && ap >= (AP_COSTS.class_ability ?? 2) && canAttackAtDistance) {
            e.preventDefault(); handleAction('class_ability')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, isPending, playerState, combatState, canAttackAtDistance, classAbility, abilityCooldown, handleAction])

  const handleUseItem = (itemId: string) => {
    // Check if the item has healing effects
    const item = combatItems.find((i: Item) => i.id === itemId)
    if (item?.effects?.heal && item.effects.heal > 0) {
      soundEngine.playHeal()
    }
    setShowItemMenu(false)
    setShowSpellMenu(false)
    combatAction({ action: 'use_item', itemId })
  }

  const handleCastSpell = useCallback(
    (spellId: string) => {
      soundEngine.playSpellCast()
      setShowSpellMenu(false)
      setShowItemMenu(false)
      combatAction({ action: 'cast_spell', spellId })
    },
    [combatAction]
  )

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [combatLog.length])

  if (status !== 'active') return null

  const ap = playerState.ap ?? 3
  const maxAp = playerState.maxAp ?? 3
  const stamina = playerState.stamina ?? 6
  const maxStamina = playerState.maxStamina ?? 6
  const mountMoves = playerState.mountMovesRemaining ?? 0
  const hpPct = playerState.maxHp > 0 ? playerState.hp / playerState.maxHp : 0
  const turn = combatState.turnNumber ?? 1

  const canAttack = ap >= (AP_COSTS.attack ?? 1) && canAttackAtDistance
  const canHeavy = ap >= (AP_COSTS.heavy_attack ?? 2) && canAttackAtDistance
  const canDefend = ap >= (AP_COSTS.defend ?? 1)
  const canUseItem = combatItems.length > 0 && ap >= (AP_COSTS.use_item ?? 1)
  const canCast = spellbook.length > 0 && ap >= (AP_COSTS.cast_spell ?? 2)
  const canCloseIn = combatState.combatDistance !== 'close' && !(ap < (AP_COSTS.move_closer ?? 1) && mountMoves === 0) && !(stamina <= 0 && mountMoves === 0)
  const canBackAway = combatState.combatDistance !== 'far' && !(ap < (AP_COSTS.move_away ?? 1) && mountMoves === 0) && !(stamina <= 0 && mountMoves === 0)
  const canFlee = ap >= (AP_COSTS.flee ?? 3)
  const canAbility = !!classAbility && abilityCooldown === 0 && ap >= (AP_COSTS.class_ability ?? 2) && canAttackAtDistance
  const moveCost = mountMoves > 0 ? 'Free' : `${AP_COSTS.move_closer} AP · 1 STA`

  return (
    <div className="relative space-y-3">
      {/* Critical hit flash: a brief wash of brass light over the whole house */}
      {showCritFlash && (
        <div className="pointer-events-none fixed inset-0 z-[55] bg-ps-brass-light/25 animate-crit-flash" aria-hidden />
      )}
      {/* Elemental effectiveness flash */}
      {effectivenessFlash && (
        <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex justify-center animate-float-up" aria-hidden>
          <Stamp tone={effectivenessFlash === 'super' ? 'gold' : 'blue'} animate className="bg-ps-playbill px-2 py-1 text-xs">
            {effectivenessFlash === 'super' ? 'Super effective' : 'Resisted'}
          </Stamp>
        </div>
      )}

      {/* The scene */}
      <p className="break-words text-center font-body text-base italic leading-relaxed text-ps-ink-soft">{scenario}</p>

      {/* Weather note */}
      {(character?.currentWeather ?? 'clear') !== 'clear' && (
        <div className="flex justify-center">
          <WeatherBanner weatherId={character?.currentWeather ?? 'clear'} />
        </div>
      )}

      {/* The enemy's line on the bill */}
      <div className="relative space-y-2 rounded-[3px] border-2 border-ps-ink px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{enemy.name}</span>
          {combatState.isBoss ? (
            <Stamp tone="gold">Boss</Stamp>
          ) : combatState.isMiniBoss ? (
            <Stamp tone="gold">Mini-boss</Stamp>
          ) : null}
          <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Lv {enemy.level}</span>
          {enemy.element && enemy.element !== 'none' && (
            <Stamp tone={ELEMENT_TONE[enemy.element] ?? 'ink'} tilt={false}>{enemy.element}</Stamp>
          )}
          {enemy.specialAbility && (
            <Stamp tone="violet" tilt={false} title={enemy.specialAbility.description}>{enemy.specialAbility.name}</Stamp>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span className="font-playbill text-sm tabular-nums text-ps-ink" aria-label={`${enemy.name} health ${enemy.hp} of ${enemy.maxHp}`}>
              {enemy.hp}/{enemy.maxHp} HP
            </span>
            <PaperButton variant="outline" size="sm" className="h-7 px-2" onClick={() => setShowEnemyDesc(!showEnemyDesc)} aria-expanded={showEnemyDesc}>
              {showEnemyDesc ? 'Hide' : 'Info'}
            </PaperButton>
          </span>
        </div>
        {showEnemyDesc && (
          <p className="font-body text-sm italic leading-snug text-ps-ink-soft">{enemy.description}</p>
        )}
        <ElementalMatchup enemyElement={enemy.element as SpellElement | undefined} />
        <StatusEffectsHUD
          statusEffects={enemy.statusEffects ?? []}
          activeBuffs={[]}
          activeSpellEffects={[]}
          side="enemy"
        />
        {/* Distance indicator */}
        {combatState.combatDistance && (
          <div className="flex items-center gap-2" aria-label={`Range: ${combatState.combatDistance}`}>
            <PlaybillCaption className="text-xs">Range</PlaybillCaption>
            <div className="flex gap-1" aria-hidden>
              {['close', 'mid', 'far'].map(d => (
                <span
                  key={d}
                  className={cn(
                    'rounded-[2px] border px-2 py-0.5 font-label text-xs font-bold uppercase tracking-widest',
                    combatState.combatDistance === d ? 'border-ps-ink bg-ps-ink text-ps-playbill' : 'border-ps-ink/30 text-ps-ink-soft'
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
        <PaperDamage events={damageEvents.filter(e => e.target === 'enemy')} />
      </div>

      {/* Enemy telegraph warning */}
      {combatState.enemyTelegraph && (
        <div className="flex justify-center" role="status">
          <Stamp
            tone={
              combatState.enemyTelegraph.action === 'heavy_attack' || combatState.enemyTelegraph.action === 'special'
                ? 'red'
                : combatState.enemyTelegraph.action === 'defend'
                  ? 'blue'
                  : 'ink'
            }
            animate
            tilt={false}
            className="whitespace-normal px-2.5 py-1.5 text-center text-xs leading-snug"
          >
            {combatState.enemyTelegraph.description}
          </Stamp>
        </div>
      )}

      {/* Additional enemies */}
      {combatState.additionalEnemies && combatState.additionalEnemies.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {combatState.additionalEnemies.map((addEnemy, idx) => (
            addEnemy.hp > 0 ? (
              <div key={addEnemy.id} className="space-y-1.5 rounded-[3px] border-2 border-ps-ink/60 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-playbill text-sm uppercase tracking-wide text-ps-ink">{addEnemy.name}</span>
                  <span className="shrink-0 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Lv {addEnemy.level}</span>
                </div>
                <PaperMeter current={addEnemy.hp} max={addEnemy.maxHp} label="Health" />
                <PaperButton variant="outline" size="sm" onClick={() => handleAction('switch_target', idx.toString())}>
                  Target
                </PaperButton>
              </div>
            ) : (
              <div key={addEnemy.id} className="rounded-[3px] border-2 border-dotted border-ps-ink/40 px-2.5 py-2">
                <span className="font-playbill text-sm uppercase tracking-wide text-ps-ink-soft line-through">{addEnemy.name}</span>
                <span className="ml-2 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Defeated</span>
              </div>
            )
          ))}
        </div>
      )}

      {/* Your figures on brass */}
      <div className="relative space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{character?.name ?? 'You'}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(playerState.comboCount ?? 0) > 0 && (
              <Stamp key={comboKey} tone="gold" animate>
                {playerState.comboCount}× combo
              </Stamp>
            )}
            {spellComboFlash && (
              <Stamp tone="violet" animate>{spellComboFlash}</Stamp>
            )}
            {playerState.isDefending && <Stamp tone="blue" tilt={false}>Defending</Stamp>}
            {(playerState.shield ?? 0) > 0 && <Stamp tone="blue" tilt={false}>Shield {playerState.shield}</Stamp>}
            {mountMoves > 0 && (
              <Stamp tone="ink" tilt={false}>
                Mount: {mountMoves} free move{mountMoves !== 1 ? 's' : ''}
              </Stamp>
            )}
          </div>
        </div>
        <BrassPlate
          className={cn(
            'grid items-stretch divide-x-2 divide-ps-brass-deep/60',
            maxMana > 0 && combatState.combatDistance ? 'grid-cols-4' : maxMana > 0 || combatState.combatDistance ? 'grid-cols-3' : 'grid-cols-2'
          )}
          aria-label="Your figures"
        >
          <BrassFigure
            label="Health"
            value={playerState.hp}
            sub={`of ${playerState.maxHp}`}
            bar={hpPct}
            barTone={hpPct > 0.5 ? 'green' : hpPct > 0.25 ? 'ink' : 'red'}
            title={`HP ${playerState.hp} of ${playerState.maxHp}`}
          />
          {maxMana > 0 && (
            <BrassFigure label="Mana" value={currentMana} sub={`of ${maxMana}`} bar={currentMana / maxMana} title={`MP ${currentMana} of ${maxMana}`} />
          )}
          {combatState.combatDistance && (
            <BrassFigure label="Stamina" value={stamina} sub={`of ${maxStamina}`} bar={maxStamina > 0 ? stamina / maxStamina : 0} title={`Stamina ${stamina} of ${maxStamina}`} />
          )}
          <BrassFigure label="Action" value={ap} sub={`of ${maxAp} AP`} bar={maxAp > 0 ? ap / maxAp : 0} title={`${ap} of ${maxAp} action points`} />
        </BrassPlate>
        {/* Companions' meters */}
        {(
          (playerState.mountHp !== undefined && playerState.mountMaxHp !== undefined && playerState.mountHp > 0) ||
          (playerState.mercenaryHp !== undefined && playerState.mercenaryMaxHp !== undefined && playerState.mercenaryHp > 0) ||
          (combatState.partyMemberStates && combatState.partyMemberStates.length > 0)
        ) && (
          <div className="space-y-1.5 rounded-[3px] border-2 border-dotted border-ps-ink/50 px-2.5 py-2">
            {playerState.mountHp !== undefined && playerState.mountMaxHp !== undefined && playerState.mountHp > 0 && (
              <PaperMeter current={playerState.mountHp} max={playerState.mountMaxHp} label={`${character?.activeMount?.icon ?? ''} Mount`.trim()} />
            )}
            {playerState.mercenaryHp !== undefined && playerState.mercenaryMaxHp !== undefined && playerState.mercenaryHp > 0 && (
              <PaperMeter
                current={playerState.mercenaryHp}
                max={playerState.mercenaryMaxHp}
                label={`${character?.activeMercenary?.icon ?? ''} ${character?.activeMercenary?.customName ?? character?.activeMercenary?.name ?? 'Mercenary'}`.trim()}
              />
            )}
            {combatState.partyMemberStates?.map(member => (
              <PaperMeter
                key={member.memberId}
                current={member.hp}
                max={member.maxHp}
                label={`${member.icon} ${member.name}${member.isKnockedOut ? ' (KO)' : ''}`}
                tone={member.isKnockedOut ? 'dim' : 'auto'}
              />
            ))}
          </div>
        )}
        {/* Status effects HUD */}
        <StatusEffectsHUD
          statusEffects={playerState.statusEffects ?? []}
          activeBuffs={playerState.activeBuffs ?? []}
          activeSpellEffects={playerState.activeSpellEffects ?? []}
          side="player"
        />
        <PaperDamage events={damageEvents.filter(e => e.target === 'player')} />
      </div>

      {/* The log of blows, newest last */}
      {combatLog.length > 0 && (
        <div className="rounded-[3px] border-2 border-ps-ink px-3 py-2">
          <div
            ref={logRef}
            className={cn('ps-scroll space-y-1', showFullLog && 'max-h-40 overflow-y-auto')}
            aria-live="polite"
            aria-label="Combat log"
          >
            {(showFullLog ? combatLog : combatLog.slice(-2)).map((entry, i) => {
              const isHeal = entry.action === 'heal' || entry.action === 'use_item'
              const isSuper = entry.description.includes('Super effective')
              const isResisted = entry.description.includes('Resisted')
              return (
                <p
                  key={i}
                  className={cn(
                    'font-body text-xs leading-snug',
                    isHeal ? 'text-ps-stamp-green' : entry.actor === 'enemy' ? 'text-ps-stamp-red' : 'text-ps-ink',
                    entry.isCritical && 'font-bold'
                  )}
                >
                  <span className="mr-1.5 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">T{entry.turn}</span>
                  {entry.isCritical && <Stamp tone="gold" tilt={false} className="mr-1.5 align-middle">Crit</Stamp>}
                  {entry.action === 'spell_combo' ? (
                    <>
                      <Stamp tone="violet" tilt={false} className="mr-1.5 align-middle">Combo</Stamp>
                      {entry.description.replace(/^COMBO: [^!]+! /, '')}
                    </>
                  ) : isSuper ? (
                    <>
                      {entry.description.replace('Super effective!', '')}
                      <Stamp tone="gold" tilt={false} className="ml-1 align-middle">Super effective</Stamp>
                    </>
                  ) : isResisted ? (
                    <>
                      {entry.description.replace('Resisted!', '')}
                      <Stamp tone="blue" tilt={false} className="ml-1 align-middle">Resisted</Stamp>
                    </>
                  ) : (
                    entry.description
                  )}
                </p>
              )
            })}
          </div>
          {combatLog.length > 2 && (
            <button
              type="button"
              className="mt-1.5 w-full rounded-[2px] text-center font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft hover:text-ps-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              onClick={() => setShowFullLog(!showFullLog)}
              aria-expanded={showFullLog}
            >
              {showFullLog ? 'Fold the log' : `Whole log (${combatLog.length} lines)`}
            </button>
          )}
        </div>
      )}

      {/* Commands */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <PlaybillCaption>Your move</PlaybillCaption>
          {isPending && <PrintingDots label="The scene plays out" />}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {/* Class Ability */}
          {classAbility && (
            <CommandLine
              className="sm:col-span-2"
              letter="5"
              onClick={() => handleAction('class_ability')}
              disabled={isPending || !canAbility}
              title={classAbility.description}
              cost={abilityCooldown > 0 ? undefined : `${AP_COSTS.class_ability} AP`}
              trailing={abilityCooldown > 0 ? <Stamp tone="red" tilt={false}>{abilityCooldown} turn{abilityCooldown !== 1 ? 's' : ''}</Stamp> : undefined}
              note={classAbility.description}
            >
              {classAbility.name}
            </CommandLine>
          )}
          <CommandLine letter="A" onClick={() => handleAction('attack')} disabled={isPending || !canAttack} cost={`${AP_COSTS.attack} AP`}>
            Attack
          </CommandLine>
          <CommandLine letter="H" onClick={() => handleAction('heavy_attack')} disabled={isPending || !canHeavy} cost={`${AP_COSTS.heavy_attack} AP`}>
            Heavy attack
          </CommandLine>
          <CommandLine letter="D" onClick={() => handleAction('defend')} disabled={isPending || !canDefend} cost={`${AP_COSTS.defend} AP`}>
            Defend
          </CommandLine>
          <CommandLine
            onClick={() => { setShowItemMenu(!showItemMenu); setShowSpellMenu(false) }}
            disabled={isPending || !canUseItem}
            aria-expanded={showItemMenu}
            cost={`${AP_COSTS.use_item} AP`}
            trailing={combatItems.length > 0 ? <Stamp tone="green" tilt={false} className="group-hover:border-ps-playbill group-hover:text-ps-playbill">{combatItems.length}</Stamp> : undefined}
          >
            Use item
          </CommandLine>
          <CommandLine
            onClick={() => { setShowSpellMenu(!showSpellMenu); setShowItemMenu(false) }}
            disabled={isPending || !canCast}
            aria-expanded={showSpellMenu}
            cost={`${AP_COSTS.cast_spell} AP`}
            trailing={
              spellbook.length > 0 ? (
                <Stamp tone="violet" tilt={false} className="group-hover:border-ps-playbill group-hover:text-ps-playbill">
                  {readySpellCount === spellbook.length ? spellbook.length : `${readySpellCount}/${spellbook.length} ready`}
                </Stamp>
              ) : undefined
            }
          >
            Cast spell
          </CommandLine>
          <CommandLine letter="Q" onClick={() => handleAction('move_closer')} disabled={isPending || !canCloseIn} cost={moveCost}>
            Close in
          </CommandLine>
          <CommandLine letter="E" onClick={() => handleAction('move_away')} disabled={isPending || !canBackAway} cost={mountMoves > 0 ? 'Free' : `${AP_COSTS.move_away} AP · 1 STA`}>
            Back away
          </CommandLine>
          <CommandLine letter="F" tone="danger" onClick={() => handleAction('flee')} disabled={isPending || !canFlee} cost={`${AP_COSTS.flee} AP`}>
            Flee
          </CommandLine>
          <PaperButton className="w-full sm:col-span-2" onClick={() => handleAction('end_turn')} disabled={isPending}>
            <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current font-playbill text-xs leading-none">Z</span>
            End turn
          </PaperButton>
        </div>

        {/* Item selection */}
        {showItemMenu && combatItems.length > 0 && (
          <div className="ps-scroll max-h-48 space-y-1.5 overflow-y-auto rounded-[3px] border-2 border-dotted border-ps-ink/60 p-2" aria-label="Your items">
            <PlaybillCaption className="px-1">Reach into the pack</PlaybillCaption>
            {combatItems.map((item: Item) => {
              const effectText = item.effects
                ? Object.entries(item.effects)
                    .filter(([, v]) => v && v !== 0)
                    .map(([k, v]) => `+${v} ${k}`)
                    .join(', ')
                : ''
              return (
                <PlaybillLine
                  key={item.id}
                  className="py-2 text-sm"
                  onClick={() => handleUseItem(item.id)}
                  disabled={isPending}
                  note={effectText || undefined}
                  trailing={item.quantity > 1 ? <Stamp tone="ink" tilt={false} className="group-hover:border-ps-playbill group-hover:text-ps-playbill">×{item.quantity}</Stamp> : undefined}
                >
                  {item.name}
                </PlaybillLine>
              )
            })}
          </div>
        )}

        {/* Spell selection */}
        {showSpellMenu && spellbook.length > 0 && (
          <div className="ps-scroll max-h-56 space-y-1.5 overflow-y-auto rounded-[3px] border-2 border-dotted border-ps-ink/60 p-2" aria-label="Your spellbook">
            <PlaybillCaption className="px-1">Open the spellbook</PlaybillCaption>
            {[...spellbook].sort((a: Spell, b: Spell) => {
              const aReady = (spellCooldowns[a.id] ?? 0) === 0 ? 0 : 1
              const bReady = (spellCooldowns[b.id] ?? 0) === 0 ? 0 : 1
              return aReady - bReady
            }).map((spell: Spell, _idx: number, sortedArr: Spell[]) => {
              const onCooldown = (spellCooldowns[spell.id] ?? 0) > 0
              const notEnoughMana = currentMana < (spell.manaCost ?? 0)
              const disabled = isPending || onCooldown || notEnoughMana
              const isFirstCooldown = onCooldown && _idx > 0 && (spellCooldowns[sortedArr[_idx - 1].id] ?? 0) === 0

              // Determine spell's primary element and effectiveness vs enemy
              const spellElement = spell.effects?.find(e => e.element && e.element !== 'none')?.element as SpellElement | undefined
              const enemyElement = enemy.element as SpellElement | undefined
              const elemMult = spellElement && enemyElement ? getElementalMultiplier(spellElement, enemyElement) : 1
              const effectiveness = elemMult >= 2 ? { label: 'Super effective', tone: 'green' as const }
                : elemMult <= 0.5 ? { label: 'Resisted', tone: 'red' as const }
                : null

              const parts: string[] = []
              if (spell.effects && spell.effects.length > 0) {
                const dmg = spell.effects.filter(e => ['damage', 'true_damage', 'lifesteal'].includes(e.type)).reduce((s, e) => s + e.value, 0)
                const heal = spell.effects.filter(e => e.type === 'heal').reduce((s, e) => s + e.value, 0)
                const dot = spell.effects.find(e => ['damage_over_time', 'apply_poison', 'apply_burn', 'bleed'].includes(e.type))
                const shield = spell.effects.filter(e => e.type === 'shield').reduce((s, e) => s + e.value, 0)
                if (dmg > 0) parts.push(`${dmg} dmg`)
                if (heal > 0) parts.push(`${heal} heal`)
                if (shield > 0) parts.push(`${shield} shield`)
                if (dot) parts.push(`${dot.value}/${dot.duration ?? 1}t ${dot.type.replace('apply_', '').replace('damage_over_time', 'DoT')}`)
              }

              return (
                <div key={spell.id}>
                  {isFirstCooldown && <PlaybillCaption className="px-1 pb-1 pt-1.5">On cooldown</PlaybillCaption>}
                  <PlaybillLine
                    className="py-2 text-sm"
                    onClick={() => handleCastSpell(spell.id)}
                    disabled={disabled}
                    trailing={
                      <>
                        {effectiveness && !disabled && (
                          <Stamp tone={effectiveness.tone} tilt={false} className="group-hover:border-ps-playbill group-hover:text-ps-playbill">{effectiveness.label}</Stamp>
                        )}
                        {onCooldown && <Stamp tone="red" tilt={false}>{spellCooldowns[spell.id]} turn{spellCooldowns[spell.id] !== 1 ? 's' : ''}</Stamp>}
                        <Stamp tone={notEnoughMana ? 'red' : 'blue'} tilt={false} className="group-hover:border-ps-playbill group-hover:text-ps-playbill">
                          {spell.manaCost ?? 0} MP
                        </Stamp>
                      </>
                    }
                    note={
                      <>
                        {parts.length > 0 && (
                          <span className="block">
                            <span className="capitalize">{spell.school}</span> · {parts.join(' + ')}
                            {!onCooldown && spell.cooldown > 0 && <span> · {spell.cooldown}t cooldown</span>}
                          </span>
                        )}
                        <span className="block">{spell.description}</span>
                        {(spell.spellLevel ?? 1) < 5 && (
                          <span className="block tabular-nums">XP {spell.spellXp ?? 0}/{getXpForNextLevel(spell.spellLevel ?? 1)}</span>
                        )}
                        {spell.tags && spell.tags.length > 0 && <span className="block">{spell.tags.join(' · ')}</span>}
                      </>
                    }
                  >
                    {spell.name}
                    <span className="ml-1.5 font-label text-xs font-bold uppercase tracking-widest opacity-80">Lv {spell.spellLevel ?? 1}</span>
                  </PlaybillLine>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <PlaybillRule className="my-1" />

      {/* Spell combos reference (folded by default) */}
      <SpellCombos discoveredCombos={character?.discoveredCombos ?? []} />

      {/* Turn counter with combat pressure indicator */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
        {turn >= 10 ? (
          <Stamp tone="red" animate>Turn {turn} · the enemy grows desperate</Stamp>
        ) : turn >= 6 ? (
          <Stamp tone="gold" tilt={false}>Turn {turn} · the fight drags on</Stamp>
        ) : (
          <PlaybillCaption>Turn {turn}</PlaybillCaption>
        )}
      </div>

      {pendingMountDrop && (
        <MountNamingModal
          mount={pendingMountDrop}
          isOpen={true}
          onConfirm={(customName) => {
            setMount(pendingMountDrop, customName)
            soundEngine.playMountAcquired()
            setPendingMountDrop(null)
          }}
        />
      )}
    </div>
  )
}

/* ── How the fight ended ────────────────────────────────────────────── */

interface CombatResultProps {
  combatState: CombatState
  onContinue: () => void
}

export function CombatResult({ combatState, onContinue }: CombatResultProps) {
  const { status, enemy } = combatState
  const { getSelectedCharacter } = useGameStore()
  const character = getSelectedCharacter()

  // Find the most recent defeat story event to extract penalty info
  const lastStoryEvents = useGameStore(s => s.gameState.storyEvents)
  const lastDefeatEvent =
    status === 'defeat'
      ? [...lastStoryEvents].reverse().find(e => e.type === 'combat_defeat')
      : null
  const lastVictoryEvent =
    status === 'victory'
      ? [...lastStoryEvents].reverse().find(e => e.type === 'combat_victory' || e.type === 'boss_guardian_victory')
      : null

  const [showPenalties, setShowPenalties] = useState(status !== 'defeat')

  useEffect(() => {
    if (status === 'defeat') {
      const timer = setTimeout(() => setShowPenalties(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [status])

  const flavorText = status === 'defeat' ? getDeathFlavorText(character, enemy, combatState.combatLog) : null
  const storyContext = status === 'defeat' ? getStoryContext(character, lastStoryEvents) : null
  const epitaph = status === 'defeat' ? getPermadeathEpitaph(character, lastStoryEvents) : null

  const config = {
    victory: {
      title: 'Victory',
      message: `You defeated ${enemy.name}!`,
      buttonText: 'Carry on',
    },
    defeat: {
      title: 'Defeat',
      message: `You were slain by ${enemy.name}...`,
      buttonText: 'Rise again',
    },
    fled: {
      title: 'You fled',
      message: `You fled from ${enemy.name}.`,
      buttonText: 'Carry on',
    },
    active: {
      title: '',
      message: '',
      buttonText: 'Carry on',
    },
  }

  const c = config[status]

  return (
    <div className="space-y-4">
      <PlaybillTitle size="md">{c.title}</PlaybillTitle>
      <p className="text-center font-body text-base leading-relaxed text-ps-ink">{c.message}</p>
      {status === 'victory' && lastVictoryEvent && (() => {
        const allItems = [
          ...(lastVictoryEvent.resourceDelta?.rewardItems || []),
          ...(lastVictoryEvent.rewardItems || []),
        ]
        const gold = lastVictoryEvent.resourceDelta?.gold
        return (
          <div className="space-y-3">
            {(gold || allItems.length > 0) && (
              <div className="flex flex-wrap justify-center gap-2">
                {gold ? (
                  <Stamp tone="gold" animate className="text-xs">+{gold} gold</Stamp>
                ) : null}
                {allItems.map((item, idx) => (
                  <Stamp key={item.id + idx} tone="violet" animate className="text-xs">
                    Found: {item.name}
                    {item.quantity > 1 && ` ×${item.quantity}`}
                    {item.type === 'spell_scroll' && ' (scroll)'}
                  </Stamp>
                ))}
              </div>
            )}
            {lastVictoryEvent.outcomeDescription && (
              <p className="text-center font-body text-sm italic leading-relaxed text-ps-ink-soft">{lastVictoryEvent.outcomeDescription}</p>
            )}
          </div>
        )
      })()}
      {/* Combat performance summary */}
      {(status === 'victory' || status === 'defeat') && combatState.combatLog.length > 0 && (() => {
        const log = combatState.combatLog
        const playerDamage = log.filter(e => e.actor === 'player' && e.damage).reduce((sum, e) => sum + (e.damage ?? 0), 0)
        const damageTaken = log.filter(e => e.actor === 'enemy' && e.damage).reduce((sum, e) => sum + (e.damage ?? 0), 0)
        const crits = log.filter(e => e.actor === 'player' && e.isCritical).length
        const turns = combatState.turnNumber ?? 1
        const hpLeft = combatState.playerState.hp
        const maxHp = combatState.playerState.maxHp
        const hpPct = Math.round((hpLeft / maxHp) * 100)

        // Performance rating
        const rating = status === 'defeat' ? null
          : turns <= 3 ? { label: 'Flawless', tone: 'gold' as const }
          : turns <= 6 && hpPct > 50 ? { label: 'Efficient', tone: 'green' as const }
          : turns <= 9 ? { label: 'Solid', tone: 'blue' as const }
          : { label: 'Hard-fought', tone: 'red' as const }

        const row = (label: string, value: React.ReactNode, cls?: string) => (
          <div className="flex items-baseline justify-between gap-2 py-1">
            <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">{label}</span>
            <span className={cn('font-playbill text-sm tabular-nums text-ps-ink', cls)}>{value}</span>
          </div>
        )

        return (
          <div className="rounded-[3px] border-2 border-ps-ink px-3 py-2">
            <div className="flex items-center justify-between gap-2 border-b-2 border-dotted border-ps-ink/50 pb-1.5">
              <PlaybillCaption>How it went</PlaybillCaption>
              {rating && <Stamp tone={rating.tone} animate>{rating.label}</Stamp>}
            </div>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {row('Turns', turns)}
              {row('Damage dealt', playerDamage.toLocaleString(), 'text-ps-stamp-green')}
              {row('Damage taken', damageTaken.toLocaleString(), 'text-ps-stamp-red')}
              {row('HP left', `${hpLeft}/${maxHp} (${hpPct}%)`, hpPct > 50 ? 'text-ps-stamp-green' : hpPct > 25 ? 'text-ps-ink' : 'text-ps-stamp-red')}
              {crits > 0 && row('Critical hits', crits, 'text-ps-stamp-gold')}
            </div>
          </div>
        )
      })()}
      {status === 'defeat' && (
        <>
          {/* Flavor text - visible immediately */}
          {flavorText && (
            <div className="rounded-[3px] border-2 border-ps-stamp-red px-3 py-2.5">
              <p className="font-body text-sm italic leading-relaxed text-ps-ink">{flavorText}</p>
              {storyContext && (
                <p className="mt-2 font-body text-xs leading-snug text-ps-ink-soft">{storyContext}</p>
              )}
            </div>
          )}

          {/* Permadeath memorial */}
          {epitaph && (
            <div className="rounded-[3px] border-2 border-ps-ink px-3 py-2.5 text-center">
              <PlaybillCaption>In memoriam</PlaybillCaption>
              <p className="mt-1.5 font-body text-sm italic leading-relaxed text-ps-ink">{epitaph}</p>
            </div>
          )}

          {/* Penalties - fade in after delay */}
          <div className={cn('transition-opacity duration-500', showPenalties ? 'opacity-100' : 'opacity-0')}>
            {lastDefeatEvent && (
              <div className="space-y-2">
                <PlaybillCaption className="text-center">Penalties suffered</PlaybillCaption>
                <div className="flex flex-wrap justify-center gap-2">
                  {lastDefeatEvent.resourceDelta?.gold ? (
                    <Stamp tone="red" animate>−{Math.abs(lastDefeatEvent.resourceDelta.gold)} gold</Stamp>
                  ) : null}
                  {lastDefeatEvent.resourceDelta?.reputation ? (
                    <Stamp tone="red" animate>−{Math.abs(lastDefeatEvent.resourceDelta.reputation)} repute</Stamp>
                  ) : null}
                  <Stamp tone="red" animate>Pack scattered and lost</Stamp>
                </div>
                {character && (character.deathCount ?? 0) > 0 && (
                  <p className="text-center font-body text-xs text-ps-ink-soft">Total deaths: {character.deathCount}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <PaperButton className="w-full" onClick={onContinue} autoFocus>
        {c.buttonText}
      </PaperButton>
    </div>
  )
}

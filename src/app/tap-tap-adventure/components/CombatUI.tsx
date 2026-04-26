'use client'

import { LoaderCircle } from 'lucide-react'
import { useCallback, useRef, useEffect, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { CLASS_ABILITIES } from '@/app/tap-tap-adventure/config/characterOptions'
import { AP_COSTS } from '@/app/tap-tap-adventure/config/apCosts'
import { useCombatActionMutation } from '@/app/tap-tap-adventure/hooks/useCombatActionMutation'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { isUsableInCombat } from '@/app/tap-tap-adventure/lib/combatItemEffects'
import { ELEMENT_COLORS, getElementalMultiplier } from '@/app/tap-tap-adventure/config/elements'
import { SpellElement } from '@/app/tap-tap-adventure/models/spell'
import { getXpForNextLevel } from '@/app/tap-tap-adventure/lib/spellProgression'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { CombatAction, CombatState } from '@/app/tap-tap-adventure/models/combat'
import { getWeatherType } from '@/app/tap-tap-adventure/config/weather'
import { StatusEffectsHUD } from '@/app/tap-tap-adventure/components/StatusEffectsHUD'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { Spell } from '@/app/tap-tap-adventure/models/spell'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { getDeathFlavorText, getStoryContext, getPermadeathEpitaph } from '@/app/tap-tap-adventure/lib/deathFlavorText'
import { FloatingDamage, DamageEvent } from './FloatingDamage'
import { SpellComboPanel } from './SpellComboPanel'

function HpBar({ current, max, label, color }: { current: number; max: number; label: string; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const barColor = pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className={color}>{current}/{max} HP</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ManaBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">MP</span>
        <span className="text-blue-400">{current}/{max} MP</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥', ice: '❄️', lightning: '⚡', shadow: '🌑', nature: '🌿', arcane: '✨',
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
    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
      {strong.length > 0 && (
        <span className="flex items-center gap-1">
          <span className="text-green-500">Weak to</span>
          {strong.map(e => (
            <span key={e} className="text-green-400" title={`${e} deals 2x damage`}>
              {ELEMENT_ICONS[e] ?? e}
            </span>
          ))}
        </span>
      )}
      {weak.length > 0 && (
        <span className="flex items-center gap-1">
          <span className="text-red-500">Resists</span>
          {weak.map(e => (
            <span key={e} className="text-red-400" title={`${e} deals 0.5x damage`}>
              {ELEMENT_ICONS[e] ?? e}
            </span>
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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/40 border border-sky-800/30 text-xs">
      <span className="text-base leading-none">{weather.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sky-200">{weather.name}</span>
        {effects.length > 0 && (
          <span className="ml-2 text-sky-300/70">
            {effects.map((e, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1 text-sky-800">·</span>}
                <span className={e.startsWith('-') ? 'text-red-400/80' : 'text-green-400/80'}>{e}</span>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

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
  const prevComboRef = useRef(0)
  const [effectivenessFlash, setEffectivenessFlash] = useState<'super' | 'resisted' | null>(null)

  const character = getSelectedCharacter()
  const { enemy, playerState, combatLog, scenario, status } = combatState

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

  // Combo pulse detection
  useEffect(() => {
    const currentCombo = playerState.comboCount ?? 0
    if (currentCombo > prevComboRef.current && currentCombo > 0) {
      setComboKey(k => k + 1)
    }
    prevComboRef.current = currentCombo
  }, [playerState.comboCount])

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
  })

  const handleUseItem = useCallback(
    (itemId: string) => {
      // Check if the item has healing effects
      const item = combatItems.find((i: Item) => i.id === itemId)
      if (item?.effects?.heal && item.effects.heal > 0) {
        soundEngine.playHeal()
      }
      setShowItemMenu(false)
      setShowSpellMenu(false)
      combatAction({ action: 'use_item', itemId })
    },
    [combatAction, combatItems]
  )

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

  return (
    <div className="space-y-4">
      {/* Critical hit flash overlay */}
      {showCritFlash && (
        <div className="fixed inset-0 z-[55] pointer-events-none bg-yellow-400/20 animate-crit-flash" />
      )}
      {/* Elemental effectiveness flash */}
      {effectivenessFlash && (
        <div className="absolute inset-x-0 top-1 z-10 flex justify-center pointer-events-none">
          <span className={`text-sm font-bold px-3 py-1 rounded-full animate-float-up ${
            effectivenessFlash === 'super'
              ? 'text-yellow-300 bg-yellow-900/60 border border-yellow-500/40'
              : 'text-blue-300 bg-blue-900/60 border border-blue-500/40'
          }`}>
            {effectivenessFlash === 'super' ? '⚡ Super Effective!' : '🛡️ Resisted!'}
          </span>
        </div>
      )}
      {/* Header */}
      <div className="text-center">
        <h4 className="font-semibold uppercase border-b border-red-900/50 pb-2 mb-2">
          {combatState.isBoss ? (
            <span className="text-yellow-400">Boss Battle</span>
          ) : combatState.isMiniBoss ? (
            <span className="text-orange-400">Mini-Boss</span>
          ) : (
            <span className="text-red-400">Combat</span>
          )}
        </h4>
        <p className="text-sm text-slate-300 italic">{scenario}</p>
      </div>

      {/* Weather banner */}
      <WeatherBanner weatherId={character?.currentWeather ?? 'clear'} />

      {/* Enemy info — condensed for mobile */}
      <div className="relative bg-[#1e1f30] border border-red-900/30 rounded-lg p-2 sm:p-3 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-red-400 text-sm">{enemy.name}</span>
          <span className="text-xs text-slate-400">Lv.{enemy.level}</span>
          {enemy.element && enemy.element !== 'none' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${ELEMENT_COLORS[enemy.element]}`}>
              {enemy.element}
            </span>
          )}
          {enemy.specialAbility && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded">
              {enemy.specialAbility.name}
            </span>
          )}
          <button
            className="text-[10px] text-slate-500 underline ml-auto"
            onClick={() => setShowEnemyDesc(!showEnemyDesc)}
          >
            {showEnemyDesc ? 'Hide' : 'Info'}
          </button>
        </div>
        {showEnemyDesc && (
          <p className="text-xs text-slate-400">{enemy.description}</p>
        )}
        <ElementalMatchup enemyElement={enemy.element as SpellElement | undefined} />
        <HpBar current={enemy.hp} max={enemy.maxHp} label="Enemy" color="text-red-400" />
        <StatusEffectsHUD
          statusEffects={enemy.statusEffects ?? []}
          activeBuffs={[]}
          activeSpellEffects={[]}
          side="enemy"
        />
        {/* Distance indicator */}
        {combatState.combatDistance && (
          <div className="flex items-center justify-center gap-2 mt-2 text-xs">
            <span className="text-gray-500">Range:</span>
            <div className="flex gap-1">
              {['close', 'mid', 'far'].map(d => (
                <span
                  key={d}
                  className={`px-2 py-0.5 rounded ${
                    combatState.combatDistance === d
                      ? d === 'close' ? 'bg-red-900/60 text-red-300 border border-red-700'
                        : d === 'mid' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700'
                        : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                      : 'bg-slate-800/40 text-slate-600'
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}
        <FloatingDamage events={damageEvents.filter(e => e.target === 'enemy')} />
      </div>

      {/* Additional enemies */}
      {combatState.additionalEnemies?.map((addEnemy, idx) => (
        addEnemy.hp > 0 ? (
          <div key={addEnemy.id} className="bg-red-900/10 border border-red-900/30 rounded-lg p-2 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-red-300">{addEnemy.name}</span>
              <span className="text-[10px] text-slate-400">Lv {addEnemy.level}</span>
            </div>
            <HpBar current={addEnemy.hp} max={addEnemy.maxHp} label="" color="text-red-400" />
            <button
              className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-800/40 transition-colors"
              onClick={() => handleAction('switch_target', idx.toString())}
            >
              Target
            </button>
          </div>
        ) : (
          <div key={addEnemy.id} className="bg-slate-900/30 border border-slate-800 rounded-lg p-2">
            <span className="text-xs text-slate-600 line-through">{addEnemy.name} — Defeated</span>
          </div>
        )
      ))}

      {/* Enemy telegraph warning */}
      {combatState.enemyTelegraph && (
        <div className={`border rounded-lg p-2 text-center text-sm animate-pulse ${
          combatState.enemyTelegraph.action === 'heavy_attack' || combatState.enemyTelegraph.action === 'special'
            ? 'bg-red-950/50 border-red-700/50 text-red-300'
            : combatState.enemyTelegraph.action === 'defend'
              ? 'bg-blue-950/50 border-blue-700/50 text-blue-300'
              : 'bg-slate-800 border-slate-600 text-slate-300'
        }`}>
          {combatState.enemyTelegraph.description}
        </div>
      )}

      {/* Player info — compact for mobile */}
      <div className="relative bg-[#1e1f30] border border-blue-900/30 rounded-lg p-2 sm:p-3 space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-bold text-blue-400 text-sm">{character?.name ?? 'You'}</span>
          <div className="flex gap-1 flex-wrap">
            {(playerState.comboCount ?? 0) > 0 && (
              <span key={comboKey} className="text-[10px] px-1.5 py-0.5 bg-orange-900/50 text-orange-400 rounded font-bold animate-combo-pulse">
                {playerState.comboCount}x Combo
              </span>
            )}
            {spellComboFlash && (
              <span className="text-[11px] px-2 py-0.5 bg-purple-900/60 text-purple-300 rounded font-bold animate-combo-pulse">
                {spellComboFlash}
              </span>
            )}
            {playerState.isDefending && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded">
                Defending
              </span>
            )}
            {(playerState.shield ?? 0) > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-cyan-900/50 text-cyan-400 rounded">
                Shield: {playerState.shield}
              </span>
            )}
          </div>
        </div>
        {/* HP + Mana on compact rows */}
        <HpBar current={playerState.hp} max={playerState.maxHp} label="You" color="text-blue-400" />
        {playerState.mountHp !== undefined && playerState.mountMaxHp !== undefined && playerState.mountHp > 0 && (
          <HpBar current={playerState.mountHp} max={playerState.mountMaxHp} label={`${character?.activeMount?.icon ?? '🐴'} Mount`} color="text-amber-400" />
        )}
        {playerState.mercenaryHp !== undefined && playerState.mercenaryMaxHp !== undefined && playerState.mercenaryHp > 0 && (
          <HpBar
            current={playerState.mercenaryHp}
            max={playerState.mercenaryMaxHp}
            label={`${character?.activeMercenary?.icon ?? '⚔️'} ${character?.activeMercenary?.customName ?? character?.activeMercenary?.name ?? 'Mercenary'}`}
            color="text-amber-400"
          />
        )}
        {/* Party member HP bars */}
        {combatState.partyMemberStates?.map(member => (
          <HpBar
            key={member.memberId}
            current={member.hp}
            max={member.maxHp}
            label={`${member.icon} ${member.name}${member.isKnockedOut ? ' (KO)' : ''}`}
            color={member.isKnockedOut ? 'text-slate-500' : 'text-emerald-400'}
          />
        ))}
        {maxMana > 0 && (
          <ManaBar current={currentMana} max={maxMana} />
        )}
        {/* Stamina bar */}
        {combatState.combatDistance && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-amber-400 w-8">STA</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, ((playerState.stamina ?? 6) / (playerState.maxStamina ?? 6)) * 100))}%` }}
              />
            </div>
            <span className="text-amber-400 text-right w-6">{playerState.stamina ?? 6}/{playerState.maxStamina ?? 6}</span>
          </div>
        )}
        {/* Status effects HUD */}
        <StatusEffectsHUD
          statusEffects={playerState.statusEffects ?? []}
          activeBuffs={playerState.activeBuffs ?? []}
          activeSpellEffects={playerState.activeSpellEffects ?? []}
          side="player"
        />
        <FloatingDamage events={damageEvents.filter(e => e.target === 'player')} />
      </div>

      {/* Combat Log — collapsed by default on mobile, show last 2 entries */}
      {combatLog.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-1">
          <div
            ref={logRef}
            className={showFullLog ? 'max-h-40 overflow-y-auto space-y-1' : 'space-y-1'}
          >
            {(showFullLog ? combatLog : combatLog.slice(-2)).map((entry, i) => (
              <div
                key={i}
                className={`text-xs ${
                  entry.isCritical
                    ? 'text-yellow-300 font-bold'
                    : entry.action === 'heal' || entry.action === 'use_item'
                    ? 'text-emerald-300'
                    : entry.action === 'defend'
                    ? 'text-sky-300'
                    : entry.actor === 'player' ? 'text-blue-300' : 'text-red-300'
                }`}
              >
                <span className="text-slate-500">T{entry.turn}:</span>{' '}
                {entry.isCritical && <span className="text-yellow-400 mr-1">&#9733;</span>}
                {entry.action === 'status_effect' && <span className="mr-1">{entry.description.toLowerCase().includes('poison') ? '☠️' : '🔥'}</span>}
                {entry.action === 'heal' && <span className="mr-1">❤️</span>}
                {entry.action === 'defend' && <span className="mr-1">🛡️</span>}
                {entry.action === 'use_item' && <span className="mr-1">🧪</span>}
                {entry.action === 'flee' && <span className="mr-1">💨</span>}
                {entry.action === 'mercenary_attack' && <span className="mr-1">⚔️</span>}
                {entry.action === 'spell_combo' ? (
                  <><span className="text-purple-400 font-bold">COMBO! </span>{entry.description.replace(/^COMBO: [^!]+! /, '')}</>
                ) : entry.description.includes('Super effective') ? (
                  <>{entry.description.replace('Super effective!', '')}<span className="text-yellow-400 font-bold"> Super effective!</span></>
                ) : entry.description.includes('Resisted') ? (
                  <>{entry.description.replace('Resisted!', '')}<span className="text-blue-400 font-bold"> Resisted!</span></>
                ) : (
                  entry.description
                )}
              </div>
            ))}
          </div>
          {combatLog.length > 2 && (
            <button
              className="text-[10px] text-slate-400 hover:text-slate-200 w-full text-center pt-1"
              onClick={() => setShowFullLog(!showFullLog)}
            >
              {showFullLog ? 'Collapse log' : `Show full log (${combatLog.length} entries)`}
            </button>
          )}
        </div>
      )}

      {/* AP Indicator */}
      <div className="bg-[#1e1f30] border border-amber-900/30 rounded-lg p-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400">AP:</span>
          <span className="text-amber-400 tracking-wider">
            {Array.from({ length: playerState.maxAp ?? 3 }).map((_, i) => (
              <span key={i} className={i < (playerState.ap ?? 3) ? 'text-amber-400' : 'text-slate-600'}>
                {'\u25CF'}
              </span>
            ))}
          </span>
          <span className="text-xs text-amber-400">({playerState.ap ?? 3}/{playerState.maxAp ?? 3})</span>
          {(playerState.mountMovesRemaining ?? 0) > 0 && (
            <span className="text-xs text-cyan-400 ml-2">| Mount: {playerState.mountMovesRemaining} free move{(playerState.mountMovesRemaining ?? 0) !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Actions — sticky on mobile for always-visible buttons */}
      <div className="space-y-2 sticky bottom-0 bg-[#161723] pt-2 pb-1 -mx-4 px-4 border-t border-slate-700/50 md:static md:bg-transparent md:border-0 md:mx-0 md:px-0 md:pt-0 md:pb-0">
        {/* Class Ability */}
        {classAbility && (
          <Button
            className={`w-full text-base py-3 rounded-md transition-colors border ${
              abilityCooldown > 0 || (playerState.ap ?? 3) < (AP_COSTS.class_ability ?? 2) || !canAttackAtDistance
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-purple-900/50 border-purple-700 hover:bg-purple-800 text-white'
            }`}
            onClick={() => handleAction('class_ability')}
            disabled={isPending || abilityCooldown > 0 || (playerState.ap ?? 3) < (AP_COSTS.class_ability ?? 2) || !canAttackAtDistance}
            title={classAbility.description}
          >
            {isPending ? (
              <LoaderCircle className="animate-spin h-4 w-4" />
            ) : abilityCooldown > 0 ? (
              `${classAbility.name} (${abilityCooldown} turns)`
            ) : (
              `${classAbility.name} (${AP_COSTS.class_ability} AP)`
            )}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className={`text-base py-3 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.attack ?? 1) || !canAttackAtDistance
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-red-900/50 border-red-800 hover:bg-red-800 text-white'
            }`}
            onClick={() => handleAction('attack')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.attack ?? 1) || !canAttackAtDistance}
          >
            {isPending ? <LoaderCircle className="animate-spin h-4 w-4" /> : <><span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[A]</span>Attack ({AP_COSTS.attack} AP)</>}
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.heavy_attack ?? 2) || !canAttackAtDistance
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-orange-900/50 border-orange-800 hover:bg-orange-800 text-white'
            }`}
            onClick={() => handleAction('heavy_attack')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.heavy_attack ?? 2) || !canAttackAtDistance}
          >
            <span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[H]</span>Heavy Attack ({AP_COSTS.heavy_attack} AP)
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.defend ?? 1)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-blue-900/50 border-blue-800 hover:bg-blue-800 text-white'
            }`}
            onClick={() => handleAction('defend')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.defend ?? 1)}
          >
            <span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[D]</span>Defend ({AP_COSTS.defend} AP)
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors relative border ${
              combatItems.length === 0 || (playerState.ap ?? 3) < (AP_COSTS.use_item ?? 1)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-900/50 border-emerald-800 hover:bg-emerald-800 text-white'
            }`}
            onClick={() => { setShowItemMenu(!showItemMenu); setShowSpellMenu(false) }}
            disabled={isPending || combatItems.length === 0 || (playerState.ap ?? 3) < (AP_COSTS.use_item ?? 1)}
          >
            Use Item ({AP_COSTS.use_item} AP) {combatItems.length > 0 && `[${combatItems.length}]`}
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors relative border ${
              spellbook.length === 0 || (playerState.ap ?? 3) < (AP_COSTS.cast_spell ?? 2)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-900/50 border-indigo-800 hover:bg-indigo-800 text-white'
            }`}
            onClick={() => { setShowSpellMenu(!showSpellMenu); setShowItemMenu(false) }}
            disabled={isPending || spellbook.length === 0 || (playerState.ap ?? 3) < (AP_COSTS.cast_spell ?? 2)}
          >
            Cast Spell ({AP_COSTS.cast_spell} AP) {spellbook.length > 0 && (
              readySpellCount === spellbook.length
                ? `[${spellbook.length}]`
                : `[${readySpellCount}/${spellbook.length} ready]`
            )}
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors border ${
              combatState.combatDistance === 'close' || ((playerState.ap ?? 3) < (AP_COSTS.move_closer ?? 1) && (playerState.mountMovesRemaining ?? 0) === 0) || ((playerState.stamina ?? 6) <= 0 && (playerState.mountMovesRemaining ?? 0) === 0)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-900/50 border-cyan-800 hover:bg-cyan-800 text-white'
            }`}
            onClick={() => handleAction('move_closer')}
            disabled={isPending || combatState.combatDistance === 'close' || ((playerState.ap ?? 3) < (AP_COSTS.move_closer ?? 1) && (playerState.mountMovesRemaining ?? 0) === 0) || ((playerState.stamina ?? 6) <= 0 && (playerState.mountMovesRemaining ?? 0) === 0)}
          >
            <span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[Q]</span>Close In ({(playerState.mountMovesRemaining ?? 0) > 0 ? 'Free' : `${AP_COSTS.move_closer} AP · 1 STA`})
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors border ${
              combatState.combatDistance === 'far' || ((playerState.ap ?? 3) < (AP_COSTS.move_away ?? 1) && (playerState.mountMovesRemaining ?? 0) === 0) || ((playerState.stamina ?? 6) <= 0 && (playerState.mountMovesRemaining ?? 0) === 0)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-teal-900/50 border-teal-800 hover:bg-teal-800 text-white'
            }`}
            onClick={() => handleAction('move_away')}
            disabled={isPending || combatState.combatDistance === 'far' || ((playerState.ap ?? 3) < (AP_COSTS.move_away ?? 1) && (playerState.mountMovesRemaining ?? 0) === 0) || ((playerState.stamina ?? 6) <= 0 && (playerState.mountMovesRemaining ?? 0) === 0)}
          >
            <span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[E]</span>Back Away ({(playerState.mountMovesRemaining ?? 0) > 0 ? 'Free' : `${AP_COSTS.move_away} AP · 1 STA`})
          </Button>
          <Button
            className={`text-base py-3 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.flee ?? 3)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'
            }`}
            onClick={() => handleAction('flee')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.flee ?? 3)}
          >
            <span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[F]</span>Flee ({AP_COSTS.flee} AP)
          </Button>
          <Button
            className="col-span-2 bg-yellow-900/50 border border-yellow-800 hover:bg-yellow-800 text-white text-base py-3 rounded-md transition-colors"
            onClick={() => handleAction('end_turn')}
            disabled={isPending}
          >
            <span className="hidden sm:inline text-slate-400 text-xs font-mono mr-1">[Z]</span>End Turn
          </Button>
        </div>

        {/* Item selection dropdown */}
        {showItemMenu && combatItems.length > 0 && (
          <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto">
            {combatItems.map((item: Item) => (
              <Button
                key={item.id}
                className="w-full text-left whitespace-normal h-auto bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white text-xs py-2 px-3 rounded-md"
                onClick={() => handleUseItem(item.id)}
                disabled={isPending}
              >
                <span className="font-semibold">{item.name}</span>
                {item.quantity > 1 && <span className="text-slate-400 ml-1">x{item.quantity}</span>}
                {item.effects && (
                  <span className="text-emerald-400 ml-2 text-[10px]">
                    {Object.entries(item.effects)
                      .filter(([, v]) => v && v !== 0)
                      .map(([k, v]) => `+${v} ${k}`)
                      .join(', ')}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Spell selection dropdown */}
        {showSpellMenu && spellbook.length > 0 && (
          <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto">
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
              const effectiveness = elemMult >= 2 ? { label: 'Super effective!', color: 'text-green-400', border: 'border-green-600/50' }
                : elemMult <= 0.5 ? { label: 'Resisted', color: 'text-red-400', border: 'border-red-600/50' }
                : null

              return (
                <div key={spell.id}>
                  {isFirstCooldown && (
                    <div className="text-[9px] text-slate-500 uppercase tracking-wide px-2 pt-1 pb-0.5">On Cooldown</div>
                  )}
                <Button
                  className={`w-full text-left whitespace-normal h-auto text-xs py-2 px-3 rounded-md border ${
                    disabled
                      ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                      : effectiveness
                        ? `bg-[#2a2b3f] ${effectiveness.border} hover:bg-[#3a3c56] text-white`
                        : 'bg-[#2a2b3f] border-[#3a3c56] hover:bg-[#3a3c56] text-white'
                  }`}
                  onClick={() => handleCastSpell(spell.id)}
                  disabled={disabled}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{spell.name}<span className="text-[10px] text-amber-400 ml-1">Lv{spell.spellLevel ?? 1}</span></span>
                    <div className="flex items-center gap-2">
                      {effectiveness && !disabled && (
                        <span className={`text-[9px] font-bold ${effectiveness.color}`}>
                          {effectiveness.label}
                        </span>
                      )}
                      <span className={`text-[10px] ${notEnoughMana ? 'text-red-400' : 'text-blue-400'}`}>
                        {spell.manaCost ?? 0} MP
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {spell.description}
                  </div>
                  {(spell.spellLevel ?? 1) < 5 && (
                    <div className="text-[10px] text-slate-600">
                      XP: {spell.spellXp ?? 0}/{getXpForNextLevel(spell.spellLevel ?? 1)}
                    </div>
                  )}
                  {onCooldown && (
                    <span className="text-[10px] text-yellow-400">
                      Cooldown: {spellCooldowns[spell.id]} turns
                    </span>
                  )}
                  {spell.tags && spell.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {spell.tags.map((tag, i) => (
                        <span key={i} className="text-[9px] px-1 py-0.5 bg-indigo-900/50 text-indigo-400 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Spell Combos reference (collapsed by default) */}
      <SpellComboPanel discoveredCombos={character?.discoveredCombos ?? []} />

      {/* Turn counter with combat pressure indicator */}
      <div className="text-center text-xs">
        {(() => {
          const turn = combatState.turnNumber ?? 1
          if (turn >= 10) {
            return (
              <div className="flex items-center justify-center gap-2">
                <span className="text-red-400 font-semibold animate-pulse">Turn {turn}</span>
                <span className="text-red-500/70">— Prolonged fight! Enemy growing desperate</span>
              </div>
            )
          }
          if (turn >= 6) {
            return (
              <div className="flex items-center justify-center gap-2">
                <span className="text-yellow-400 font-medium">Turn {turn}</span>
                <span className="text-yellow-500/60">— Fight dragging on...</span>
              </div>
            )
          }
          return <span className="text-slate-500">Turn {turn}</span>
        })()}
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
      title: 'Victory!',
      color: 'text-yellow-400',
      borderColor: 'border-yellow-900/50',
      bgColor: 'bg-yellow-900/20',
      message: `You defeated ${enemy.name}!`,
      buttonText: 'Continue',
    },
    defeat: {
      title: 'Defeated',
      color: 'text-red-400',
      borderColor: 'border-red-900/50',
      bgColor: 'bg-red-900/20',
      message: `You were slain by ${enemy.name}...`,
      buttonText: 'Rise Again',
    },
    fled: {
      title: 'Escaped',
      color: 'text-slate-300',
      borderColor: 'border-slate-600',
      bgColor: 'bg-slate-800',
      message: `You fled from ${enemy.name}.`,
      buttonText: 'Continue',
    },
    active: {
      title: '',
      color: '',
      borderColor: '',
      bgColor: '',
      message: '',
      buttonText: 'Continue',
    },
  }

  const c = config[status]

  return (
    <div className={`${c.bgColor} border ${c.borderColor} rounded-lg p-6 text-center space-y-4`}>
      <h4 className={`text-xl font-bold ${c.color}`}>{c.title}</h4>
      <p className="text-slate-300">{c.message}</p>
      {status === 'victory' && lastVictoryEvent && (
        <div className="space-y-3">
          {lastVictoryEvent.resourceDelta?.gold ? (
            <p className="text-yellow-400 font-semibold">+{lastVictoryEvent.resourceDelta.gold} Gold</p>
          ) : null}
          {(() => {
            const allItems = [
              ...(lastVictoryEvent.resourceDelta?.rewardItems || []),
              ...(lastVictoryEvent.rewardItems || []),
            ]
            return allItems.length > 0 ? (
              <div className="text-sm text-yellow-200 space-y-1 bg-yellow-950/30 rounded p-3">
                <p className="font-semibold text-yellow-300">Rewards gained:</p>
                {allItems.map((item, idx) => (
                  <p key={item.id + idx}>
                    <span className="text-yellow-200">{item.name}</span>
                    {item.quantity > 1 && <span className="text-yellow-400"> x{item.quantity}</span>}
                    {item.type === 'spell_scroll' && <span className="text-purple-400 ml-1">(Scroll)</span>}
                  </p>
                ))}
              </div>
            ) : null
          })()}
          {lastVictoryEvent.outcomeDescription && (
            <p className="text-slate-400 text-sm italic">{lastVictoryEvent.outcomeDescription}</p>
          )}
        </div>
      )}
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
          : turns <= 3 ? { label: 'Flawless', color: 'text-yellow-300' }
          : turns <= 6 && hpPct > 50 ? { label: 'Efficient', color: 'text-green-300' }
          : turns <= 9 ? { label: 'Solid', color: 'text-blue-300' }
          : { label: 'Hard-fought', color: 'text-orange-300' }

        return (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 uppercase tracking-wide font-semibold text-[10px]">Combat Summary</span>
              {rating && <span className={`font-bold ${rating.color}`}>{rating.label}</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Turns</span>
                <span>{turns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Damage dealt</span>
                <span className="text-green-400">{playerDamage.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Damage taken</span>
                <span className="text-red-400">{damageTaken.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">HP remaining</span>
                <span className={hpPct > 50 ? 'text-green-400' : hpPct > 25 ? 'text-yellow-400' : 'text-red-400'}>
                  {hpLeft}/{maxHp} ({hpPct}%)
                </span>
              </div>
              {crits > 0 && (
                <div className="flex justify-between col-span-2">
                  <span className="text-slate-500">Critical hits</span>
                  <span className="text-yellow-400">★ {crits}</span>
                </div>
              )}
            </div>
          </div>
        )
      })()}
      {status === 'defeat' && (
        <>
          {/* Flavor text - visible immediately */}
          {flavorText && (
            <div className="bg-red-950/40 border border-red-900/40 rounded-lg p-4">
              <p className="text-red-200 italic text-sm">{flavorText}</p>
              {storyContext && (
                <p className="text-red-300/70 text-xs mt-2">{storyContext}</p>
              )}
            </div>
          )}

          {/* Permadeath memorial */}
          {epitaph && (
            <div className="bg-red-950/60 border border-red-800/50 rounded-lg p-4">
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">In Memoriam</p>
              <p className="text-red-200 text-sm italic">{epitaph}</p>
            </div>
          )}

          {/* Penalties - fade in after delay */}
          <div className={`transition-opacity duration-500 ${showPenalties ? 'opacity-100' : 'opacity-0'}`}>
            {lastDefeatEvent && (
              <div className="text-sm text-red-300 space-y-1 bg-red-950/30 rounded p-3">
                <p className="font-semibold">Penalties suffered:</p>
                {lastDefeatEvent.resourceDelta?.gold && (
                  <p>{Math.abs(lastDefeatEvent.resourceDelta.gold)} gold lost</p>
                )}
                {lastDefeatEvent.resourceDelta?.reputation && (
                  <p>{Math.abs(lastDefeatEvent.resourceDelta.reputation)} reputation lost</p>
                )}
                <p>Inventory scattered and lost</p>
                {character && (character.deathCount ?? 0) > 0 && (
                  <p className="text-xs text-red-400 mt-2">Total deaths: {character.deathCount}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <Button
        className="bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white px-6 py-2 rounded-md"
        onClick={onContinue}
      >
        {c.buttonText}
      </Button>
    </div>
  )
}

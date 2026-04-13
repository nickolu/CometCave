'use client'

import { LoaderCircle } from 'lucide-react'
import { useCallback, useRef, useEffect, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { CLASS_ABILITIES } from '@/app/tap-tap-adventure/config/characterOptions'
import { AP_COSTS } from '@/app/tap-tap-adventure/config/apCosts'
import { useCombatActionMutation } from '@/app/tap-tap-adventure/hooks/useCombatActionMutation'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { isUsableInCombat } from '@/app/tap-tap-adventure/lib/combatItemEffects'
import { ELEMENT_COLORS } from '@/app/tap-tap-adventure/config/elements'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { CombatAction, CombatState, StatusEffect } from '@/app/tap-tap-adventure/models/combat'
import { Spell } from '@/app/tap-tap-adventure/models/spell'
import { Item } from '@/app/tap-tap-adventure/models/types'

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
function StatusEffectBadges({ effects, label }: { effects: StatusEffect[]; label: string }) {
  if (effects.length === 0) return null

  const colorMap: Record<string, string> = {
    poison: 'bg-green-900/50 text-green-400',
    burn: 'bg-orange-900/50 text-orange-400',
    slow: 'bg-blue-900/50 text-blue-400',
    curse: 'bg-purple-900/50 text-purple-400',
    thorns: 'bg-green-900/50 text-green-400',
    berserk: 'bg-red-900/50 text-red-400',
    fear: 'bg-yellow-900/50 text-yellow-400',
    reflect: 'bg-slate-700/50 text-slate-300',
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {effects.map((effect, i) => (
        <span
          key={i}
          className={`text-[10px] px-1.5 py-0.5 rounded ${colorMap[effect.type] ?? 'bg-slate-700/50 text-slate-300'}`}
          title={`${effect.name}: ${effect.value > 0 ? effect.value + ' per turn, ' : ''}${effect.turnsRemaining} turns remaining`}
        >
          {effect.name} ({effect.turnsRemaining}t)
        </span>
      ))}
    </div>
  )
}


interface CombatUIProps {
  combatState: CombatState
}

export function CombatUI({ combatState }: CombatUIProps) {
  const { getSelectedCharacter } = useGameStore()
  const { mutate: combatAction, isPending } = useCombatActionMutation()
  const [showItemMenu, setShowItemMenu] = useState(false)
  const [showSpellMenu, setShowSpellMenu] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const character = getSelectedCharacter()
  const { enemy, playerState, combatLog, scenario, status } = combatState

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

  const handleAction = useCallback(
    (action: CombatAction, itemId?: string) => {
      setShowItemMenu(false)
      setShowSpellMenu(false)
      combatAction({ action, itemId })
    },
    [combatAction]
  )

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
      {/* Header */}
      <div className="text-center">
        <h4 className="font-semibold uppercase border-b border-red-900/50 pb-2 mb-2">
          {combatState.isBoss ? (
            <span className="text-yellow-400">Boss Battle</span>
          ) : (
            <span className="text-red-400">Combat</span>
          )}
        </h4>
        <p className="text-sm text-slate-300 italic">{scenario}</p>
      </div>

      {/* Enemy info */}
      <div className="bg-[#1e1f30] border border-red-900/30 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-red-400">{enemy.name}</span>
            <span className="text-xs text-slate-400">Lv.{enemy.level}</span>
            {enemy.element && enemy.element !== 'none' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${ELEMENT_COLORS[enemy.element]}`}>
                {enemy.element}
              </span>
            )}
          </div>
          {enemy.specialAbility && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded">
              {enemy.specialAbility.name}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">{enemy.description}</p>
        <HpBar current={enemy.hp} max={enemy.maxHp} label="Enemy" color="text-red-400" />
        <StatusEffectBadges effects={enemy.statusEffects ?? []} label="Enemy" />
      </div>

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

      {/* Player info */}
      <div className="bg-[#1e1f30] border border-blue-900/30 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-blue-400">{character?.name ?? 'You'}</span>
          <div className="flex gap-2">
            {(playerState.comboCount ?? 0) > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-900/50 text-orange-400 rounded font-bold">
                {playerState.comboCount}x Combo
              </span>
            )}
            {playerState.isDefending && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded">
                Defending
              </span>
            )}
          </div>
        </div>
        <HpBar current={playerState.hp} max={playerState.maxHp} label="You" color="text-blue-400" />
        {maxMana > 0 && (
          <ManaBar current={currentMana} max={maxMana} />
        )}
        {(playerState.shield ?? 0) > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-900/50 text-cyan-400 rounded">
              Shield: {playerState.shield}
            </span>
          </div>
        )}
        {(playerState.activeSpellEffects ?? []).length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {(playerState.activeSpellEffects ?? []).map((effect, i) => (
              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                effect.effectType === 'heal_over_time' ? 'bg-green-900/50 text-green-400' :
                effect.effectType === 'damage_reduction' ? 'bg-cyan-900/50 text-cyan-400' :
                effect.effectType === 'damage_over_time' || effect.effectType === 'bleed' ? 'bg-red-900/50 text-red-400' :
                'bg-purple-900/50 text-purple-400'
              }`}>
                {effect.effectType.replace(/_/g, ' ')} ({effect.turnsRemaining}t)
              </span>
            ))}
          </div>
        )}
        {playerState.activeBuffs && playerState.activeBuffs.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {playerState.activeBuffs.map((buff, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">
                +{buff.value} {buff.stat} ({buff.turnsRemaining}t)
              </span>
            ))}
          </div>
        )}
        <StatusEffectBadges effects={playerState.statusEffects ?? []} label="Player" />
      </div>

      {/* Combat Log */}
      {combatLog.length > 0 && (
        <div
          ref={logRef}
          className="bg-slate-900 border border-slate-700 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1"
        >
          {combatLog.map((entry, i) => (
            <div
              key={i}
              className={`text-xs ${
                entry.isCritical
                  ? 'text-yellow-300 font-bold'
                  : entry.actor === 'player' ? 'text-blue-300' : 'text-red-300'
              }`}
            >
              <span className="text-slate-500">T{entry.turn}:</span>{' '}
              {entry.isCritical && <span className="text-yellow-400 mr-1">&#9733;</span>}
              {entry.description}
            </div>
          ))}
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
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {/* Class Ability */}
        {classAbility && (
          <Button
            className={`w-full text-sm py-2 rounded-md transition-colors border ${
              abilityCooldown > 0 || (playerState.ap ?? 3) < (AP_COSTS.class_ability ?? 2)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-purple-900/50 border-purple-700 hover:bg-purple-800 text-white'
            }`}
            onClick={() => handleAction('class_ability')}
            disabled={isPending || abilityCooldown > 0 || (playerState.ap ?? 3) < (AP_COSTS.class_ability ?? 2)}
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
            className={`text-sm py-2 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.attack ?? 1)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-red-900/50 border-red-800 hover:bg-red-800 text-white'
            }`}
            onClick={() => handleAction('attack')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.attack ?? 1)}
          >
            {isPending ? <LoaderCircle className="animate-spin h-4 w-4" /> : `Attack (${AP_COSTS.attack} AP)`}
          </Button>
          <Button
            className={`text-sm py-2 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.heavy_attack ?? 2)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-orange-900/50 border-orange-800 hover:bg-orange-800 text-white'
            }`}
            onClick={() => handleAction('heavy_attack')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.heavy_attack ?? 2)}
          >
            Heavy Attack ({AP_COSTS.heavy_attack} AP)
          </Button>
          <Button
            className={`text-sm py-2 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.defend ?? 1)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-blue-900/50 border-blue-800 hover:bg-blue-800 text-white'
            }`}
            onClick={() => handleAction('defend')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.defend ?? 1)}
          >
            Defend ({AP_COSTS.defend} AP)
          </Button>
          <Button
            className={`text-sm py-2 rounded-md transition-colors relative border ${
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
            className={`text-sm py-2 rounded-md transition-colors relative border ${
              spellbook.length === 0 || (playerState.ap ?? 3) < (AP_COSTS.cast_spell ?? 2)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-900/50 border-indigo-800 hover:bg-indigo-800 text-white'
            }`}
            onClick={() => { setShowSpellMenu(!showSpellMenu); setShowItemMenu(false) }}
            disabled={isPending || spellbook.length === 0 || (playerState.ap ?? 3) < (AP_COSTS.cast_spell ?? 2)}
          >
            Cast Spell ({AP_COSTS.cast_spell} AP) {spellbook.length > 0 && `[${spellbook.length}]`}
          </Button>
          <Button
            className={`text-sm py-2 rounded-md transition-colors border ${
              (playerState.ap ?? 3) < (AP_COSTS.flee ?? 3)
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'
            }`}
            onClick={() => handleAction('flee')}
            disabled={isPending || (playerState.ap ?? 3) < (AP_COSTS.flee ?? 3)}
          >
            Flee ({AP_COSTS.flee} AP)
          </Button>
          <Button
            className="bg-yellow-900/50 border border-yellow-800 hover:bg-yellow-800 text-white text-sm py-2 rounded-md transition-colors"
            onClick={() => handleAction('end_turn')}
            disabled={isPending}
          >
            End Turn
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
            {spellbook.map((spell: Spell) => {
              const onCooldown = (spellCooldowns[spell.id] ?? 0) > 0
              const notEnoughMana = currentMana < (spell.manaCost ?? 0)
              const disabled = isPending || onCooldown || notEnoughMana

              return (
                <Button
                  key={spell.id}
                  className={`w-full text-left whitespace-normal h-auto text-xs py-2 px-3 rounded-md border ${
                    disabled
                      ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                      : 'bg-[#2a2b3f] border-[#3a3c56] hover:bg-[#3a3c56] text-white'
                  }`}
                  onClick={() => handleCastSpell(spell.id)}
                  disabled={disabled}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{spell.name}</span>
                    <span className={`text-[10px] ${notEnoughMana ? 'text-red-400' : 'text-blue-400'}`}>
                      {spell.manaCost ?? 0} MP
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {spell.description}
                  </div>
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
              )
            })}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-slate-500">
        Turn {combatState.turnNumber}
      </div>
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
      {status === 'defeat' && lastDefeatEvent && (
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
      <Button
        className="bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white px-6 py-2 rounded-md"
        onClick={onContinue}
      >
        {c.buttonText}
      </Button>
    </div>
  )
}

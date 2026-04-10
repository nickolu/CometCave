'use client'

import { LoaderCircle } from 'lucide-react'
import { useCallback, useRef, useEffect, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { CLASS_ABILITIES } from '@/app/tap-tap-adventure/config/characterOptions'
import { useCombatActionMutation } from '@/app/tap-tap-adventure/hooks/useCombatActionMutation'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { isUsableInCombat } from '@/app/tap-tap-adventure/lib/combatItemEffects'
import { CombatAction, CombatState } from '@/app/tap-tap-adventure/models/combat'
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

interface CombatUIProps {
  combatState: CombatState
}

export function CombatUI({ combatState }: CombatUIProps) {
  const { getSelectedCharacter } = useGameStore()
  const { mutate: combatAction, isPending } = useCombatActionMutation()
  const [showItemMenu, setShowItemMenu] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const character = getSelectedCharacter()
  const { enemy, playerState, combatLog, scenario, status } = combatState

  const combatItems = (character?.inventory ?? []).filter(
    (i: Item) => i.status !== 'deleted' && isUsableInCombat(i)
  )

  const classId = character?.class?.toLowerCase() ?? ''
  const classAbility = CLASS_ABILITIES[classId]
  const abilityCooldown = playerState.abilityCooldown ?? 0

  const handleAction = useCallback(
    (action: CombatAction, itemId?: string) => {
      setShowItemMenu(false)
      combatAction({ action, itemId })
    },
    [combatAction]
  )

  const handleUseItem = useCallback(
    (itemId: string) => {
      setShowItemMenu(false)
      combatAction({ action: 'use_item', itemId })
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
          <div>
            <span className="font-bold text-red-400">{enemy.name}</span>
            <span className="text-xs text-slate-400 ml-2">Lv.{enemy.level}</span>
          </div>
          {enemy.specialAbility && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded">
              {enemy.specialAbility.name}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">{enemy.description}</p>
        <HpBar current={enemy.hp} max={enemy.maxHp} label="Enemy" color="text-red-400" />
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
        {playerState.activeBuffs && playerState.activeBuffs.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {playerState.activeBuffs.map((buff, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">
                +{buff.value} {buff.stat} ({buff.turnsRemaining}t)
              </span>
            ))}
          </div>
        )}
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
                entry.actor === 'player' ? 'text-blue-300' : 'text-red-300'
              }`}
            >
              <span className="text-slate-500">T{entry.turn}:</span> {entry.description}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Class Ability */}
        {classAbility && (
          <Button
            className={`w-full text-sm py-2 rounded-md transition-colors border ${
              abilityCooldown > 0
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-purple-900/50 border-purple-700 hover:bg-purple-800 text-white'
            }`}
            onClick={() => handleAction('class_ability')}
            disabled={isPending || abilityCooldown > 0}
            title={classAbility.description}
          >
            {isPending ? (
              <LoaderCircle className="animate-spin h-4 w-4" />
            ) : abilityCooldown > 0 ? (
              `${classAbility.name} (${abilityCooldown} turns)`
            ) : (
              `${classAbility.name} - Ready!`
            )}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="bg-red-900/50 border border-red-800 hover:bg-red-800 text-white text-sm py-2 rounded-md transition-colors"
            onClick={() => handleAction('attack')}
            disabled={isPending}
          >
            {isPending ? <LoaderCircle className="animate-spin h-4 w-4" /> : 'Attack'}
          </Button>
          <Button
            className="bg-blue-900/50 border border-blue-800 hover:bg-blue-800 text-white text-sm py-2 rounded-md transition-colors"
            onClick={() => handleAction('defend')}
            disabled={isPending}
          >
            Defend
          </Button>
          <Button
            className="bg-emerald-900/50 border border-emerald-800 hover:bg-emerald-800 text-white text-sm py-2 rounded-md transition-colors relative"
            onClick={() => setShowItemMenu(!showItemMenu)}
            disabled={isPending || combatItems.length === 0}
          >
            Use Item {combatItems.length > 0 && `(${combatItems.length})`}
          </Button>
          <Button
            className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white text-sm py-2 rounded-md transition-colors"
            onClick={() => handleAction('flee')}
            disabled={isPending}
          >
            Flee
          </Button>
        </div>

        {/* Item selection dropdown */}
        {showItemMenu && combatItems.length > 0 && (
          <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-2 space-y-1">
            {combatItems.map((item: Item) => (
              <Button
                key={item.id}
                className="w-full text-left bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white text-xs py-2 px-3 rounded-md"
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

  const config = {
    victory: {
      title: 'Victory!',
      color: 'text-yellow-400',
      borderColor: 'border-yellow-900/50',
      bgColor: 'bg-yellow-900/20',
      message: `You defeated ${enemy.name}!`,
    },
    defeat: {
      title: 'Defeated',
      color: 'text-red-400',
      borderColor: 'border-red-900/50',
      bgColor: 'bg-red-900/20',
      message: `You were defeated by ${enemy.name}...`,
    },
    fled: {
      title: 'Escaped',
      color: 'text-slate-300',
      borderColor: 'border-slate-600',
      bgColor: 'bg-slate-800',
      message: `You fled from ${enemy.name}.`,
    },
    active: { title: '', color: '', borderColor: '', bgColor: '', message: '' },
  }

  const c = config[status]

  return (
    <div className={`${c.bgColor} border ${c.borderColor} rounded-lg p-6 text-center space-y-4`}>
      <h4 className={`text-xl font-bold ${c.color}`}>{c.title}</h4>
      <p className="text-slate-300">{c.message}</p>
      <Button
        className="bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white px-6 py-2 rounded-md"
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  )
}

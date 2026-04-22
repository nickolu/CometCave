'use client'
import { useCallback, useMemo } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { EquipmentSlots, EquipmentSlotType, getEquipmentSlot } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/item'

interface EquipmentPanelProps {
  equipment: EquipmentSlots
}

const RARITY_COLORS: Record<string, { border: string; text: string; bg: string; label: string }> = {
  common: { border: 'border-gray-600/50', text: 'text-gray-400', bg: 'bg-gray-900/30', label: 'Common' },
  uncommon: { border: 'border-green-600/50', text: 'text-green-400', bg: 'bg-green-900/30', label: 'Uncommon' },
  rare: { border: 'border-blue-500/60', text: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Rare' },
  epic: { border: 'border-purple-500/60', text: 'text-purple-400', bg: 'bg-purple-900/30', label: 'Epic' },
  legendary: { border: 'border-amber-500/60', text: 'text-amber-400', bg: 'bg-amber-900/30', label: 'Legendary' },
}

const SLOT_LABELS: Record<EquipmentSlotType, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
}

const SLOT_ICONS: Record<EquipmentSlotType, string> = {
  weapon: 'ATK',
  armor: 'DEF',
  accessory: 'LCK',
}

const COMPARE_STATS = ['strength', 'intelligence', 'luck'] as const

/** Sum the total stat value of an item across STR/INT/LCK */
function itemStatTotal(item: Item | null): number {
  if (!item?.effects) return 0
  return COMPARE_STATS.reduce((sum, key) => sum + (item.effects?.[key] ?? 0), 0)
}

/** Find the best inventory alternative for a given slot */
function findBestUpgrade(inventory: Item[], slot: EquipmentSlotType, equipped: Item | null): Item | null {
  const equippedTotal = itemStatTotal(equipped)
  let best: Item | null = null
  let bestTotal = equippedTotal

  for (const item of inventory) {
    if (item.status === 'deleted') continue
    if (item.type !== 'equipment') continue
    if (getEquipmentSlot(item) !== slot) continue
    const total = itemStatTotal(item)
    if (total > bestTotal) {
      best = item
      bestTotal = total
    }
  }

  return best
}

export function EquipmentPanel({ equipment }: EquipmentPanelProps) {
  const { getSelectedCharacter, equipItem } = useGameStore()

  const handleUnequip = useCallback((slot: EquipmentSlotType) => {
    useGameStore.getState().unequipItem(slot)
  }, [])

  const handleEquipUpgrade = useCallback((itemId: string) => {
    equipItem(itemId)
  }, [equipItem])

  const inventory = getSelectedCharacter()?.inventory ?? []

  const slots: EquipmentSlotType[] = ['weapon', 'armor', 'accessory']

  // Compute best upgrade for each slot
  const upgrades = useMemo(() => {
    const result: Record<EquipmentSlotType, Item | null> = {
      weapon: null,
      armor: null,
      accessory: null,
    }
    for (const slot of slots) {
      result[slot] = findBestUpgrade(inventory, slot, equipment[slot])
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, equipment])

  return (
    <div className="w-full flex flex-col">
      <h3 className="text-lg font-semibold text-white mb-3">Equipment</h3>
      <div className="space-y-2">
        {slots.map(slot => {
          const item = equipment[slot]
          const upgrade = upgrades[slot]
          return (
            <div
              key={slot}
              className={`bg-[#1e1f30] border p-3 rounded-lg ${
                upgrade ? 'border-green-700/50' : 'border-[#3a3c56]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded shrink-0">
                    {SLOT_ICONS[slot]}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 uppercase">{SLOT_LABELS[slot]}</div>
                    {item ? (
                      <>
                        {(() => {
                          const rarityStyle = RARITY_COLORS[item.rarity ?? 'common']
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className={`font-bold text-sm truncate ${item.rarity && item.rarity !== 'common' ? rarityStyle.text : 'text-white'}`}>{item.name}</div>
                              {item.rarity && item.rarity !== 'common' && (
                                <span className={`text-[10px] px-1.5 py-0.5 ${rarityStyle.bg} ${rarityStyle.text} rounded`}>
                                  {rarityStyle.label}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                        {item.effects && (
                          <div className="text-xs text-emerald-400">
                            {Object.entries(item.effects)
                              .filter(
                                ([k, v]) => v !== undefined && v !== 0 && k !== 'range'
                              )
                              .map(
                                ([k, v]) =>
                                  `+${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`
                              )
                              .join(', ')}
                          </div>
                        )}
                        {item.onHitEffect && (
                          <div className="text-xs text-orange-400">
                            On Hit: {item.onHitEffect.description} ({Math.round(item.onHitEffect.chance * 100)}% chance)
                          </div>
                        )}
                        {item.drawback && (
                          <div className="text-xs text-red-400">
                            Drawback: {item.drawback.description} ({item.drawback.value} {item.drawback.stat})
                          </div>
                        )}
                        {slot === 'weapon' && item.effects?.range && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                              item.effects.range === 'far'
                                ? 'bg-blue-900/50 text-blue-400'
                                : item.effects.range === 'mid'
                                  ? 'bg-yellow-900/50 text-yellow-400'
                                  : 'bg-red-900/50 text-red-400'
                            }`}
                          >
                            {item.effects.range.charAt(0).toUpperCase() +
                              item.effects.range.slice(1)}{' '}
                            Range
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 italic">Empty</div>
                    )}
                  </div>
                </div>
                {item && (
                  <Button
                    className="shrink-0 bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white text-xs py-1 px-2 rounded-md transition-colors"
                    onClick={() => handleUnequip(slot)}
                  >
                    Unequip
                  </Button>
                )}
              </div>

              {/* Upgrade indicator */}
              {upgrade && (
                <div className="mt-2 pt-2 border-t border-[#3a3c56] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-green-400 font-semibold">
                      ⬆ Upgrade available
                    </div>
                    <div className="text-xs text-slate-300 truncate">{upgrade.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {COMPARE_STATS.map(key => {
                        const diff = (upgrade.effects?.[key] ?? 0) - (item?.effects?.[key] ?? 0)
                        if (diff === 0) return null
                        return (
                          <span key={key} className={`mr-1.5 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{diff} {key.slice(0, 3).toUpperCase()}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <Button
                    className="shrink-0 bg-green-900/50 border border-green-700 hover:bg-green-800 text-green-200 text-xs py-1 px-2 rounded-md transition-colors"
                    onClick={() => handleEquipUpgrade(upgrade.id)}
                  >
                    Equip
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'
import { useCallback } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { EquipmentSlots, EquipmentSlotType } from '@/app/tap-tap-adventure/models/equipment'

interface EquipmentPanelProps {
  equipment: EquipmentSlots
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

export function EquipmentPanel({ equipment }: EquipmentPanelProps) {
  const handleUnequip = useCallback((slot: EquipmentSlotType) => {
    useGameStore.getState().unequipItem(slot)
  }, [])

  const slots: EquipmentSlotType[] = ['weapon', 'armor', 'accessory']

  return (
    <div className="w-full flex flex-col">
      <h3 className="text-lg font-semibold text-white mb-3">Equipment</h3>
      <div className="space-y-2">
        {slots.map(slot => {
          const item = equipment[slot]
          return (
            <div
              key={slot}
              className="bg-[#1e1f30] border border-[#3a3c56] p-3 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded shrink-0">
                  {SLOT_ICONS[slot]}
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 uppercase">{SLOT_LABELS[slot]}</div>
                  {item ? (
                    <>
                      <div className="font-bold text-white text-sm truncate">{item.name}</div>
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
          )
        })}
      </div>
    </div>
  )
}

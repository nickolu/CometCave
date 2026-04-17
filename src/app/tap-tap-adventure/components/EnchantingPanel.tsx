'use client'
import { useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getEnchantCost, getEnchantBonusStat, MAX_ENCHANT_LEVEL } from '@/app/tap-tap-adventure/config/enchanting'
import type { Item } from '@/app/tap-tap-adventure/models/item'

type EquipSlot = 'weapon' | 'armor' | 'accessory'

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
}

function EnchantSlotCard({
  slot,
  item,
  gold,
  onEnchant,
}: {
  slot: EquipSlot
  item: Item | null
  gold: number
  onEnchant: (slot: EquipSlot) => void
}) {
  if (!item) {
    return (
      <div className="bg-[#1e1f30] border border-[#3a3c56] p-3 rounded-lg flex items-center justify-between gap-2 opacity-50">
        <div>
          <div className="text-xs text-gray-500 uppercase font-semibold">{SLOT_LABELS[slot]}</div>
          <div className="text-sm text-gray-600 italic mt-0.5">Empty</div>
        </div>
      </div>
    )
  }

  const currentLevel = item.enchantmentLevel ?? 0
  const cost = getEnchantCost(currentLevel)
  const bonusStat = getEnchantBonusStat(item)
  const isMaxed = currentLevel >= MAX_ENCHANT_LEVEL
  const canAfford = cost !== null && gold >= cost
  const canEnchant = !isMaxed && canAfford && bonusStat !== null

  const displayName = currentLevel > 0
    ? `${item.name} +${currentLevel}`
    : item.name

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] p-3 rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-gray-500 uppercase font-semibold">{SLOT_LABELS[slot]}</div>
          <div className="text-sm text-white font-medium mt-0.5">
            {currentLevel > 0 && <span className="mr-1 text-yellow-400">✨</span>}
            {displayName}
          </div>
          {bonusStat && (
            <div className="text-xs text-indigo-300 mt-0.5">
              Boosts: {bonusStat} (currently {item.effects?.[bonusStat] ?? 0})
            </div>
          )}
          {!bonusStat && (
            <div className="text-xs text-gray-500 mt-0.5 italic">No boostable stat</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500">Level</div>
          <div className="text-sm font-bold text-amber-400">{currentLevel}/{MAX_ENCHANT_LEVEL}</div>
        </div>
      </div>

      <button
        disabled={!canEnchant}
        onClick={() => onEnchant(slot)}
        className={`w-full py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
          isMaxed
            ? 'bg-[#2a2b3f] text-amber-600 cursor-not-allowed border border-amber-800/40'
            : canEnchant
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            : 'bg-[#2a2b3f] text-gray-600 cursor-not-allowed border border-[#3a3c56]'
        }`}
      >
        {isMaxed
          ? 'Max Level'
          : bonusStat === null
          ? 'No Stat to Boost'
          : cost !== null
          ? `Enchant — ${cost}g`
          : 'Enchant'}
      </button>
    </div>
  )
}

export function EnchantingPanel() {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  const character = useGameStore(s =>
    s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId)
  )
  const enchantItemAction = useGameStore(s => s.enchantItem)

  if (!character) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Enchanting</h3>
        <p className="text-gray-400 text-sm">No character selected.</p>
      </div>
    )
  }

  const { equipment, gold } = character

  const handleEnchant = (slot: EquipSlot) => {
    const result = enchantItemAction(slot)
    if (result) {
      setFeedbackSuccess(result.success)
      setFeedbackMessage(result.message)
      setTimeout(() => setFeedbackMessage(null), 3000)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">✨ Enchanting</h3>
        <p className="text-xs text-gray-500">Spend gold to boost equipped item stats</p>
      </div>

      {feedbackMessage && (
        <div
          className={`mb-3 p-2 rounded-md text-sm animate-pulse border ${
            feedbackSuccess
              ? 'bg-green-900/50 border-green-700 text-green-300'
              : 'bg-red-900/50 border-red-700 text-red-300'
          }`}
        >
          {feedbackMessage}
        </div>
      )}

      <div className="space-y-2">
        {(['weapon', 'armor', 'accessory'] as EquipSlot[]).map(slot => (
          <EnchantSlotCard
            key={slot}
            slot={slot}
            item={(equipment ?? {})[slot] ?? null}
            gold={gold}
            onEnchant={handleEnchant}
          />
        ))}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'

import { MAX_ENCHANT_LEVEL, getEnchantBonusStat, getEnchantCost } from '@/app/tap-tap-adventure/config/enchanting'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import type { Item } from '@/app/tap-tap-adventure/models/item'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

type EquipSlot = 'weapon' | 'armor' | 'accessory'

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
}

function EnchantSlotRow({
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
      <li className="border-b-2 border-dotted border-ps-ink/40 py-3 last:border-b-0">
        <PlaybillCaption>{SLOT_LABELS[slot]}</PlaybillCaption>
        <p className="mt-0.5 font-body text-sm italic text-ps-ink-soft">Nothing worn</p>
      </li>
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

  const reason = isMaxed
    ? 'Enchanted as far as it goes'
    : bonusStat === null
      ? 'Nothing on it to boost'
      : !canAfford && cost !== null
        ? `Needs ${cost - gold} more gold`
        : null

  return (
    <li className="border-b-2 border-dotted border-ps-ink/40 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PlaybillCaption>{SLOT_LABELS[slot]}</PlaybillCaption>
          <p className="mt-0.5 font-body text-base font-medium leading-tight text-ps-ink">{displayName}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {bonusStat ? (
              <Stamp tone="blue" tilt={false}>
                Boosts {bonusStat} <span className="opacity-70">now {item.effects?.[bonusStat] ?? 0}</span>
              </Stamp>
            ) : (
              <Stamp tone="ink" tilt={false} className="opacity-70">No stat to boost</Stamp>
            )}
            {cost !== null && <Stamp tone="gold" tilt={false}>Next {cost} g</Stamp>}
          </div>
        </div>
        <div className="shrink-0 text-right" title={`Enchantment level ${currentLevel} of ${MAX_ENCHANT_LEVEL}`}>
          <span className="block font-playbill text-xl leading-none tabular-nums text-ps-ink">
            {currentLevel}<span className="text-ps-ink-soft">/{MAX_ENCHANT_LEVEL}</span>
          </span>
          <PlaybillCaption className="mt-1 text-xs">Level</PlaybillCaption>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <PaperButton size="sm" variant={canEnchant ? 'brass' : 'outline'} disabled={!canEnchant} onClick={() => onEnchant(slot)}>
          {cost !== null && canEnchant ? `Enchant · ${cost} g` : 'Enchant'}
        </PaperButton>
        {reason && <span className="font-body text-xs italic text-ps-ink-soft">{reason}</span>}
      </div>
    </li>
  )
}

export function EnchantingPanel() {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  useEffect(() => {
    if (!feedbackMessage) return
    const id = setTimeout(() => setFeedbackMessage(null), 3000)
    return () => clearTimeout(id)
  }, [feedbackMessage])

  const character = useGameStore(s =>
    s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId)
  )
  const enchantItemAction = useGameStore(s => s.enchantItem)

  if (!character) {
    return (
      <div>
        <PlaybillTitle size="sm" rules={false} className="text-left">Enchanting</PlaybillTitle>
        <p className="mt-2 font-body text-sm italic text-ps-ink-soft">No character selected.</p>
      </div>
    )
  }

  const { equipment, gold } = character

  const handleEnchant = (slot: EquipSlot) => {
    const result = enchantItemAction(slot)
    if (result) {
      setFeedbackSuccess(result.success)
      setFeedbackMessage(result.message)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-3 border-b-2 border-ps-ink pb-2">
        <div>
          <PlaybillTitle size="sm" rules={false} className="text-left">Enchanting</PlaybillTitle>
          <p className="mt-0.5 font-body text-xs text-ps-ink-soft">Pay gold to sharpen what you wear.</p>
        </div>
        <span className="shrink-0 font-playbill text-sm tabular-nums text-ps-ink" title="Your gold">
          {gold} g
        </span>
      </div>

      {feedbackMessage && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-[2px] border-2 px-2.5 py-1.5 font-body text-sm',
            feedbackSuccess ? 'border-ps-stamp-green text-ps-stamp-green' : 'border-ps-stamp-red text-ps-stamp-red'
          )}
        >
          {feedbackMessage}
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {(['weapon', 'armor', 'accessory'] as EquipSlot[]).map(slot => (
          <EnchantSlotRow
            key={slot}
            slot={slot}
            item={(equipment ?? {})[slot] ?? null}
            gold={gold}
            onEnchant={handleEnchant}
          />
        ))}
      </ul>
    </div>
  )
}

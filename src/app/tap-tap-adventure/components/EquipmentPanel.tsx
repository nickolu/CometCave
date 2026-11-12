'use client'
import { useCallback, useMemo } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { EquipmentSlotType, EquipmentSlots, getEquipmentSlot } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone, deltaTone } from '@/app/tap-tap-adventure/stage/Playbill'

interface EquipmentPanelProps {
  equipment: EquipmentSlots
}

const RARITY_TONE: Record<string, { tone: StampTone; label: string }> = {
  common: { tone: 'ink', label: 'Common' },
  uncommon: { tone: 'green', label: 'Uncommon' },
  rare: { tone: 'blue', label: 'Rare' },
  epic: { tone: 'violet', label: 'Epic' },
  legendary: { tone: 'gold', label: 'Legendary' },
}

const SLOT_LABELS: Record<EquipmentSlotType, string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
}

const COMPARE_STATS = ['strength', 'intelligence', 'luck', 'charisma'] as const
const STAT_SHORT: Record<(typeof COMPARE_STATS)[number], string> = { strength: 'STR', intelligence: 'INT', luck: 'LCK', charisma: 'CHA' }

/** Sum the total stat value of an item across STR/INT/LCK/CHA */
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

function SmallPrint({ label, children, tone = 'soft' }: { label: string; children: React.ReactNode; tone?: 'soft' | 'red' }) {
  return (
    <p className={tone === 'red' ? 'font-body text-xs leading-snug text-ps-stamp-red' : 'font-body text-xs leading-snug text-ps-ink-soft'}>
      <span className="font-label text-xs font-bold uppercase tracking-widest">{label} </span>
      {children}
    </p>
  )
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

  // What everything worn adds up to, for the brass plate.
  const totals = COMPARE_STATS.map(key => ({
    key,
    value: slots.reduce((sum, slot) => sum + (equipment[slot]?.effects?.[key] ?? 0), 0),
  }))

  return (
    <div className="w-full">
      <PlaybillTitle size="sm" rules={false} className="text-left">Worn</PlaybillTitle>
      <div className="mt-3 space-y-2">
        {slots.map(slot => {
          const item = equipment[slot]
          const upgrade = upgrades[slot]
          const rarity = item ? RARITY_TONE[item.rarity ?? 'common'] : null
          return (
            <div key={slot} className="rounded-[3px] border-2 border-ps-ink p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <PlaybillCaption>{SLOT_LABELS[slot]}</PlaybillCaption>
                  {item ? (
                    <>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-body text-base font-medium leading-tight text-ps-ink">{item.name}</span>
                        {item.enchantmentLevel && item.enchantmentLevel > 0 ? <Stamp tone="blue" tilt={false}>+{item.enchantmentLevel}</Stamp> : null}
                        {item.rarity && item.rarity !== 'common' && rarity && <Stamp tone={rarity.tone} tilt={false}>{rarity.label}</Stamp>}
                      </div>
                      {item.effects && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {Object.entries(item.effects)
                              .filter(([k, v]) => v !== undefined && v !== 0 && k !== 'range')
                              .map(([k, v]) => (
                                <Stamp key={k} tone={typeof v === 'number' ? deltaTone(v) : 'ink'} tilt={false}>
                                  {typeof v === 'number' && v > 0 ? '+' : ''}{String(v)} {k.charAt(0).toUpperCase() + k.slice(1)}
                                </Stamp>
                              ))}
                          {slot === 'weapon' && item.effects?.range && (
                            <Stamp tone={item.effects.range === 'far' ? 'blue' : item.effects.range === 'mid' ? 'gold' : 'red'} tilt={false}>
                              {item.effects.range.charAt(0).toUpperCase() + item.effects.range.slice(1)} range
                            </Stamp>
                          )}
                        </div>
                      )}
                      <div className="mt-1.5 space-y-0.5">
                        {item.onHitEffect && (
                          <SmallPrint label="On hit">{item.onHitEffect.description} ({Math.round(item.onHitEffect.chance * 100)}% chance)</SmallPrint>
                        )}
                        {item.passiveEffect && <SmallPrint label="Passive">{item.passiveEffect.description}</SmallPrint>}
                        {item.grantsSpell && (
                          <SmallPrint label="Grants">{item.grantsSpell.spellName} ({item.grantsSpell.usesPerCombat}× a fight)</SmallPrint>
                        )}
                        {item.drawback && (
                          <SmallPrint label="Drawback" tone="red">{item.drawback.description} ({item.drawback.value} {item.drawback.stat})</SmallPrint>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-0.5 font-body text-sm italic text-ps-ink-soft">Nothing worn</p>
                  )}
                </div>
                {item && (
                  <PaperButton size="sm" variant="outline" className="shrink-0" onClick={() => handleUnequip(slot)}>
                    Unequip
                  </PaperButton>
                )}
              </div>

              {/* Upgrade indicator */}
              {upgrade && (
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t-2 border-dotted border-ps-ink/40 pt-2.5">
                  <div className="min-w-0 flex-1">
                    <PlaybillCaption className="text-ps-stamp-green">Better in your pack</PlaybillCaption>
                    <p className="mt-0.5 truncate font-body text-sm font-medium text-ps-ink">{upgrade.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {COMPARE_STATS.map(key => {
                        const diff = (upgrade.effects?.[key] ?? 0) - (item?.effects?.[key] ?? 0)
                        if (diff === 0) return null
                        return (
                          <Stamp key={key} tone={deltaTone(diff)} tilt={false}>
                            {diff > 0 ? '+' : ''}{diff} {STAT_SHORT[key]}
                          </Stamp>
                        )
                      })}
                    </div>
                  </div>
                  <PaperButton size="sm" className="shrink-0" onClick={() => handleEquipUpgrade(upgrade.id)}>
                    Equip
                  </PaperButton>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <PlaybillCaption className="mt-4">What it adds up to</PlaybillCaption>
      <BrassPlate className="mt-1.5 grid grid-cols-4 divide-x-2 divide-ps-brass-deep/60" aria-label="Bonuses from everything worn">
        {totals.map(t => (
          <BrassFigure
            key={t.key}
            label={STAT_SHORT[t.key]}
            value={`${t.value > 0 ? '+' : ''}${t.value}`}
            title={`${t.value > 0 ? '+' : ''}${t.value} ${t.key} from everything worn`}
          />
        ))}
      </BrassPlate>
    </div>
  )
}

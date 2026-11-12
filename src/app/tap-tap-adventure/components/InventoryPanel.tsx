'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { EquipmentSlots, getEquipmentSlot } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp, type StampTone, deltaTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

/** The printer's ink for each rarity. Common carries no stamp. */
const RARITY_TONE: Record<string, { tone: StampTone; label: string }> = {
  common: { tone: 'ink', label: 'Common' },
  uncommon: { tone: 'green', label: 'Uncommon' },
  rare: { tone: 'blue', label: 'Rare' },
  epic: { tone: 'violet', label: 'Epic' },
  legendary: { tone: 'gold', label: 'Legendary' },
}

const TYPE_LABEL: Record<string, string> = {
  consumable: 'Consumable',
  equipment: 'Equipment',
  spell_scroll: 'Scroll',
  quest: 'Quest',
  trade_good: 'Trade good',
  misc: 'Sundry',
}

interface InventoryPanelProps {
  inventory: Item[]
  /** A map or chart put a place on the map: the stage opens the map on it. */
  onRevealLandmark?: (index: number, name: string) => void
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'spell_scroll', label: 'Spell' },
  { value: 'trade_good', label: 'Trade' },
  { value: 'quest', label: 'Quest' },
]

const RARITY_FILTERS = [
  { value: 'all', label: 'Any' },
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
]

const SORTS: { value: 'default' | 'name' | 'type' | 'value' | 'rarity'; label: string }[] = [
  { value: 'default', label: 'As packed' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Kind' },
  { value: 'value', label: 'Value' },
  { value: 'rarity', label: 'Rarity' },
]

const CHIP = 'h-7 px-2 text-xs tracking-widest'

/** A row of printed chips: one pressed, the rest outlined. */
function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <PlaybillCaption className="mr-1 w-10 shrink-0 text-xs">{label}</PlaybillCaption>
      {options.map(o => (
        <PaperButton
          key={o.value}
          size="sm"
          variant={value === o.value ? 'ink' : 'outline'}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={CHIP}
        >
          {o.label}
        </PaperButton>
      ))}
    </div>
  )
}

/** "revealLandmark" → "Reveal landmark". */
function humanKey(k: string): string {
  const spaced = k.replace(/([A-Z])/g, ' $1').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function fmtEffects(effects: NonNullable<Item['effects']>): string {
  return Object.entries(effects)
    .filter(([, v]) => v !== undefined && v !== 0 && v !== false)
    .map(([k, v]) => {
      if (typeof v === 'number') return `${v > 0 ? '+' : ''}${v} ${humanKey(k)}`
      if (v === true) return humanKey(k)
      return `${humanKey(k)}: ${String(v)}`
    })
    .join(', ')
}

/** A labelled line of small print under an item. */
function SmallPrint({ label, children, tone = 'soft' }: { label: string; children: React.ReactNode; tone?: 'soft' | 'red' | 'ink' }) {
  return (
    <p className={cn('font-body text-xs leading-snug', tone === 'red' ? 'text-ps-stamp-red' : tone === 'ink' ? 'text-ps-ink' : 'text-ps-ink-soft')}>
      <span className="font-label text-xs font-bold uppercase tracking-widest">{label} </span>
      {children}
    </p>
  )
}

export function InventoryPanel({ inventory, onRevealLandmark }: InventoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'type' | 'value' | 'rarity'>('default')
  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!feedbackMessage) return
    const id = setTimeout(() => setFeedbackMessage(null), 3000)
    return () => clearTimeout(id)
  }, [feedbackMessage])

  const character = useGameStore(s => s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId))
  const newItemIds = useGameStore(s => s.gameState.newItemIds ?? [])
  const clearNewItemId = useGameStore(s => s.clearNewItemId)
  const equipment = (character?.equipment ?? { weapon: null, armor: null, accessory: null }) as EquipmentSlots

  const handleUse = useCallback((item: Item) => {
    const result = useGameStore.getState().useItem(item.id)
    if (result) {
      setFeedbackMessage(result.message)
      if (result.revealedLandmark) onRevealLandmark?.(result.revealedLandmark.index, result.revealedLandmark.name)
    }
  }, [onRevealLandmark])

  const handleEquip = useCallback((item: Item) => {
    const slot = getEquipmentSlot(item)
    useGameStore.getState().equipItem(item.id, slot)
    setFeedbackMessage(`Equipped ${item.name} in ${slot} slot`)
  }, [])

  const handleLearnSpell = useCallback((item: Item) => {
    const result = useGameStore.getState().learnSpell(item.id)
    if (result) {
      if (result.learned) {
        soundEngine.playSpellLearn()
      }
      setFeedbackMessage(result.message)
    }
  }, [])

  const handleDiscard = useCallback((item: Item) => {
    useGameStore.getState().discardItem(item.id)
  }, [])

  const handleRestore = useCallback((item: Item) => {
    useGameStore.getState().restoreItem(item.id)
  }, [])

  const handlePointerDown = useCallback((item: Item) => {
    longPressTimerRef.current = setTimeout(() => {
      setDetailItem(item)
      longPressTimerRef.current = null
    }, 500)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleItemClick = useCallback((item: Item) => {
    // If long-press already fired (timer cleared itself), don't re-open
    // If timer is still pending, clear it and open on click instead
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setDetailItem(item)
    // Clear "new" badge when item is viewed
    clearNewItemId(item.id)
  }, [clearNewItemId])

  const itemsToDisplay = (inventory ?? []).filter(item => {
    if (activeTab === 'active') {
      if (item.status === 'deleted') return false
    } else {
      if (item.status !== 'deleted') return false
    }
    if (typeFilter !== 'all' && item.type !== typeFilter) return false
    if (rarityFilter !== 'all' && (item.rarity ?? 'common') !== rarityFilter) return false
    return true
  })

  const sortedItems = [...itemsToDisplay].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'type': return (a.type ?? 'misc').localeCompare(b.type ?? 'misc')
      case 'value': {
        const aVal = Object.values(a.effects ?? {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? Math.abs(v) : 0), 0)
        const bVal = Object.values(b.effects ?? {}).reduce((sum: number, v) => sum + (typeof v === 'number' ? Math.abs(v) : 0), 0)
        return bVal - aVal
      }
      case 'rarity': {
        const rarityOrder: Record<string, number> = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 }
        return (rarityOrder[b.rarity ?? 'common'] ?? 0) - (rarityOrder[a.rarity ?? 'common'] ?? 0)
      }
      default: return 0
    }
  })

  const comparison = (item: Item, long: boolean) => {
    const slot = getEquipmentSlot(item)
    const equipped = equipment[slot]
    if (!equipped) return <SmallPrint label="Slot" tone="ink">Nothing worn as {slot} yet</SmallPrint>
    const stats = ['strength', 'intelligence', 'luck', 'charisma'] as const
    const deltas = stats.map(key => {
      const diff = (item.effects?.[key] ?? 0) - (equipped.effects?.[key] ?? 0)
      const label = long ? key.charAt(0).toUpperCase() + key.slice(1) : key === 'charisma' ? 'CHA' : key.slice(0, 3).toUpperCase()
      return diff !== 0 ? { label, diff } : null
    }).filter(Boolean) as { label: string; diff: number }[]
    if (deltas.length === 0) return <SmallPrint label="Worn">Same figures as {equipped.name}</SmallPrint>
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">vs {equipped.name}</span>
        {deltas.map(d => (
          <Stamp key={d.label} tone={deltaTone(d.diff)} tilt={false}>
            {d.diff > 0 ? '+' : ''}{d.diff} {d.label}
          </Stamp>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        <PlaybillTitle size="sm" rules={false} className="text-left">
          {activeTab === 'active' ? 'Packing list' : 'Discarded'}
        </PlaybillTitle>
        <PaperButton
          size="sm"
          variant={activeTab === 'deleted' ? 'ink' : 'outline'}
          aria-pressed={activeTab === 'deleted'}
          onClick={() => setActiveTab(activeTab === 'active' ? 'deleted' : 'active')}
          className={CHIP}
        >
          {activeTab === 'active' ? 'Show discarded' : 'Show pack'}
        </PaperButton>
      </div>

      {activeTab === 'active' && (
        <div className="mt-3 space-y-1.5 border-b-2 border-ps-ink pb-3">
          <ChipRow label="Kind" options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
          <ChipRow label="Rarity" options={RARITY_FILTERS} value={rarityFilter} onChange={setRarityFilter} />
          <ChipRow label="Order" options={SORTS} value={sortBy} onChange={setSortBy} />
        </div>
      )}

      {feedbackMessage && (
        <p role="status" className="mt-3 rounded-[2px] border-2 border-ps-stamp-green px-2.5 py-1.5 font-body text-sm text-ps-stamp-green">
          {feedbackMessage}
        </p>
      )}

      <div className="mt-1">
        {sortedItems.length === 0 ? (
          <p className="py-4 font-body text-sm italic text-ps-ink-soft">
            {activeTab === 'active' ? 'Your pack is empty.' : 'Nothing has been discarded.'}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sortedItems.map((item: Item) => {
              const rarity = RARITY_TONE[item.rarity ?? 'common']
              const isNew = newItemIds.includes(item.id)
              return (
                <li
                  key={item.id}
                  className="cursor-pointer border-b-2 border-dotted border-ps-ink/40 py-3 last:border-b-0"
                  onClick={() => handleItemClick(item)}
                  onPointerDown={() => handlePointerDown(item)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-body text-base font-medium leading-tight text-ps-ink">
                          {item.name}
                          {item.quantity > 1 && <span className="ml-1.5 font-playbill text-sm tabular-nums text-ps-ink-soft">×{item.quantity}</span>}
                        </span>
                        {item.enchantmentLevel && item.enchantmentLevel > 0 ? (
                          <Stamp tone="blue" tilt={false}>+{item.enchantmentLevel}</Stamp>
                        ) : null}
                        {isNew && <Stamp tone="gold">New</Stamp>}
                        {item.isHeirloom && <Stamp tone="gold" tilt={false} title="Heirloom">Heirloom</Stamp>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {item.type && <Stamp tone="ink" tilt={false}>{TYPE_LABEL[item.type] ?? item.type}</Stamp>}
                        {item.rarity && item.rarity !== 'common' && <Stamp tone={rarity.tone} tilt={false}>{rarity.label}</Stamp>}
                      </div>
                      <p className="mt-1.5 font-body text-xs leading-snug text-ps-ink-soft">{item.description}</p>
                      {item.loreText && <p className="mt-0.5 font-body text-xs italic leading-snug text-ps-ink-faint">{item.loreText}</p>}
                      <div className="mt-1.5 space-y-0.5">
                        {item.effects && <SmallPrint label="Effects" tone="ink">{fmtEffects(item.effects)}</SmallPrint>}
                        {item.type === 'equipment' && comparison(item, false)}
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
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {activeTab === 'active' && item.type === 'consumable' && (
                      <PaperButton size="sm" onClick={() => handleUse(item)} title="Use one of this item">
                        Use
                      </PaperButton>
                    )}
                    {activeTab === 'active' && item.type === 'spell_scroll' && (
                      <PaperButton size="sm" onClick={() => handleLearnSpell(item)} title="Learn the spell from this scroll">
                        Learn
                      </PaperButton>
                    )}
                    {activeTab === 'active' && item.type === 'equipment' && (
                      <PaperButton size="sm" onClick={() => handleEquip(item)} title={`Equip to ${getEquipmentSlot(item)} slot`}>
                        Equip
                      </PaperButton>
                    )}
                    {activeTab === 'active' && item.type === 'trade_good' && (
                      <PaperButton size="sm" variant="brass" onClick={() => handleUse(item)} title="Sell for gold">
                        Sell
                      </PaperButton>
                    )}
                    {activeTab === 'active' && item.type !== 'quest' ? (
                      <PaperButton size="sm" variant="danger" onClick={() => handleDiscard(item)} title="Discard all of this item">
                        Discard
                      </PaperButton>
                    ) : activeTab === 'deleted' ? (
                      <PaperButton size="sm" variant="outline" onClick={() => handleRestore(item)} title="Restore this item">
                        Restore
                      </PaperButton>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {detailItem && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Item details"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ps-house/70 p-4"
          onClick={() => setDetailItem(null)}
        >
          <PlaybillSheet className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-5 pb-5 pt-4">
              {(() => {
                const detailRarity = RARITY_TONE[detailItem.rarity ?? 'common']
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <PlaybillTitle size="md" rules={false} className="text-left">
                        {detailItem.name}
                        {detailItem.enchantmentLevel && detailItem.enchantmentLevel > 0 ? <span className="ml-1.5 text-ps-stamp-blue">+{detailItem.enchantmentLevel}</span> : null}
                      </PlaybillTitle>
                      <button
                        type="button"
                        onClick={() => setDetailItem(null)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                        aria-label="Close item details"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1 border-b-2 border-ps-ink pb-3">
                      {detailItem.isHeirloom && <Stamp tone="gold">Heirloom</Stamp>}
                      {detailItem.type && <Stamp tone="ink" tilt={false}>{TYPE_LABEL[detailItem.type] ?? detailItem.type}</Stamp>}
                      {detailItem.rarity && detailItem.rarity !== 'common' && <Stamp tone={detailRarity.tone} tilt={false}>{detailRarity.label}</Stamp>}
                      {detailItem.quantity > 1 && <span className="font-playbill text-sm tabular-nums text-ps-ink-soft">×{detailItem.quantity}</span>}
                    </div>
                  </>
                )
              })()}
              <p className="mt-3 font-body text-sm leading-relaxed text-ps-ink">{detailItem.description}</p>
              {detailItem.loreText && <p className="mt-1 font-body text-xs italic leading-snug text-ps-ink-soft">{detailItem.loreText}</p>}

              <div className="mt-3 space-y-3">
                {detailItem.effects && (
                  <div>
                    <PlaybillCaption>Effects</PlaybillCaption>
                    <dl className="mt-1">
                      {Object.entries(detailItem.effects)
                        .filter(([, v]) => v !== undefined && v !== 0)
                        .map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between border-b border-dotted border-ps-ink/40 py-1 font-body text-sm">
                            <dt className="text-ps-ink">{k.charAt(0).toUpperCase() + k.slice(1)}</dt>
                            <dd className={cn('font-playbill tabular-nums', typeof v === 'number' ? (v > 0 ? 'text-ps-stamp-green' : 'text-ps-stamp-red') : 'text-ps-ink')}>
                              {typeof v === 'number' ? `${v > 0 ? '+' : ''}${v}` : String(v)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                )}
                {detailItem.type === 'equipment' && comparison(detailItem, true)}
                {detailItem.spell && (
                  <div>
                    <PlaybillCaption>Spell: {detailItem.spell.name}</PlaybillCaption>
                    <p className="mt-1 font-body text-sm text-ps-ink">{detailItem.spell.description}</p>
                  </div>
                )}
                {detailItem.onHitEffect && (
                  <div>
                    <PlaybillCaption>On hit</PlaybillCaption>
                    <p className="mt-1 font-body text-sm text-ps-ink">{detailItem.onHitEffect.description} ({Math.round(detailItem.onHitEffect.chance * 100)}% chance)</p>
                  </div>
                )}
                {detailItem.passiveEffect && (
                  <div>
                    <PlaybillCaption>Passive</PlaybillCaption>
                    <p className="mt-1 font-body text-sm text-ps-ink">{detailItem.passiveEffect.description}</p>
                  </div>
                )}
                {detailItem.grantsSpell && (
                  <div>
                    <PlaybillCaption>Grants a spell</PlaybillCaption>
                    <p className="mt-1 font-body text-sm text-ps-ink">
                      {detailItem.grantsSpell.spellName} — {detailItem.grantsSpell.description} ({detailItem.grantsSpell.usesPerCombat}× a fight)
                    </p>
                  </div>
                )}
                {detailItem.drawback && (
                  <div>
                    <PlaybillCaption className="text-ps-stamp-red">Drawback</PlaybillCaption>
                    <p className="mt-1 font-body text-sm text-ps-stamp-red">{detailItem.drawback.description} ({detailItem.drawback.value} {detailItem.drawback.stat})</p>
                  </div>
                )}
              </div>

              <PaperButton variant="outline" className="mt-5 w-full" onClick={() => setDetailItem(null)}>
                Close
              </PaperButton>
            </div>
          </PlaybillSheet>
        </div>
      )}
    </div>
  )
}

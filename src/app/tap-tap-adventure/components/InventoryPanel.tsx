'use client'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { List } from '@/app/tap-tap-adventure/components/ui/list'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { getEquipmentSlot, EquipmentSlots } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/types'

const RARITY_COLORS: Record<string, { border: string; text: string; bg: string; label: string }> = {
  common: { border: 'border-gray-600/50', text: 'text-gray-400', bg: 'bg-gray-900/30', label: 'Common' },
  uncommon: { border: 'border-green-600/50', text: 'text-green-400', bg: 'bg-green-900/30', label: 'Uncommon' },
  rare: { border: 'border-blue-500/60', text: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Rare' },
  epic: { border: 'border-purple-500/60', text: 'text-purple-400', bg: 'bg-purple-900/30', label: 'Epic' },
  legendary: { border: 'border-amber-500/60', text: 'text-amber-400', bg: 'bg-amber-900/30', label: 'Legendary' },
}

interface InventoryPanelProps {
  inventory: Item[]
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'spell_scroll', label: 'Spell' },
  { value: 'trade_good', label: 'Trade' },
  { value: 'quest', label: 'Quest' },
]

export function InventoryPanel({ inventory }: InventoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'type' | 'value' | 'rarity'>('default')
  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const character = useGameStore(s => s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId))
  const newItemIds = useGameStore(s => s.gameState.newItemIds ?? [])
  const clearNewItemId = useGameStore(s => s.clearNewItemId)
  const equipment = (character?.equipment ?? { weapon: null, armor: null, accessory: null }) as EquipmentSlots

  const handleUse = useCallback((item: Item) => {
    const result = useGameStore.getState().useItem(item.id)
    if (result) {
      setFeedbackMessage(result.message)
      setTimeout(() => setFeedbackMessage(null), 3000)
    }
  }, [])

  const handleEquip = useCallback((item: Item) => {
    const slot = getEquipmentSlot(item)
    useGameStore.getState().equipItem(item.id, slot)
    setFeedbackMessage(`Equipped ${item.name} in ${slot} slot`)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const handleLearnSpell = useCallback((item: Item) => {
    const result = useGameStore.getState().learnSpell(item.id)
    if (result) {
      if (result.learned) {
        soundEngine.playSpellLearn()
      }
      setFeedbackMessage(result.message)
      setTimeout(() => setFeedbackMessage(null), 3000)
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

  return (
    <div className="w-full flex flex-col h-full max-h-[calc(100vh-415px)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-white">
          {activeTab === 'active' ? 'Inventory' : 'Deleted Items'}
        </h3>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="bg-[#2a2b3f] border border-[#3a3c56] text-gray-300 text-xs rounded px-2 py-1"
        >
          <option value="default">Sort: Default</option>
          <option value="name">Sort: Name</option>
          <option value="type">Sort: Type</option>
          <option value="value">Sort: Value</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
        <Button
          onClick={() => setActiveTab(activeTab === 'active' ? 'deleted' : 'active')}
          variant="link"
          className="text-sm text-gray-400 hover:text-gray-200 px-0 py-0 h-auto"
        >
          {activeTab === 'active' ? 'Show Deleted' : 'Show Active'}
        </Button>
      </div>
      {activeTab === 'active' && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                typeFilter === f.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#2a2b3f] text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {feedbackMessage && (
        <div className="mb-2 p-2 bg-green-900/50 border border-green-700 rounded-md text-green-300 text-sm">
          {feedbackMessage}
        </div>
      )}
      <div className="overflow-auto flex-1">
        {sortedItems.length === 0 ? (
          <div className="text-gray-400">
            {activeTab === 'active' ? 'Your inventory is empty.' : 'No deleted items.'}
          </div>
        ) : (
          <List
            items={sortedItems}
            className="space-y-0 w-full"
            renderItem={(item: Item) => {
              const rarityStyle = RARITY_COLORS[item.rarity ?? 'common']
              const isNew = newItemIds.includes(item.id)
              const borderClass = item.isHeirloom
                ? `${rarityStyle.border} ring-1 ring-amber-500/30`
                : isNew
                ? `${rarityStyle.border} ring-1 ring-indigo-400/60`
                : rarityStyle.border
              return (
              <div
                className={`relative bg-[#1e1f30] border ${borderClass} p-4 rounded-lg space-y-2 mb-3 w-full cursor-pointer hover:border-indigo-500/50 transition-colors`}
                onClick={() => handleItemClick(item)}
                onPointerDown={() => handlePointerDown(item)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {item.quantity > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    x{item.quantity}
                  </span>
                )}
                {isNew && (
                  <span className="absolute -top-1.5 -left-1.5 bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide">
                    NEW
                  </span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {item.isHeirloom && (
                      <span className="text-amber-400 text-sm" title="Heirloom">&#9733;</span>
                    )}
                    <div className={`font-bold ${item.rarity && item.rarity !== 'common' ? rarityStyle.text : 'text-white'}`}>{item.name}</div>
                    {item.enchantmentLevel && item.enchantmentLevel > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-cyan-900/50 text-cyan-300 border border-cyan-700/40 rounded font-semibold">
                        +{item.enchantmentLevel}
                      </span>
                    )}
                    {item.type === 'consumable' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">
                        Consumable
                      </span>
                    )}
                    {item.type === 'equipment' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/50 text-indigo-400 rounded">
                        Equipment
                      </span>
                    )}
                    {item.type === 'spell_scroll' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded">
                        Spell Scroll
                      </span>
                    )}
                    {item.rarity && item.rarity !== 'common' && (
                      <span className={`text-[10px] px-1.5 py-0.5 ${rarityStyle.bg} ${rarityStyle.text} rounded`}>
                        {rarityStyle.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{item.description}</div>
                  {item.loreText && (
                    <div className="text-xs text-amber-300/70 italic mt-0.5">{item.loreText}</div>
                  )}
                  {item.effects && (
                    <div className="text-xs text-emerald-400 mt-1">
                      Effects: {Object.entries(item.effects)
                        .filter(([, v]) => v !== undefined && v !== 0)
                        .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
                        .join(', ')}
                    </div>
                  )}
                  {item.type === 'equipment' && (() => {
                    const slot = getEquipmentSlot(item)
                    const equipped = equipment[slot]
                    if (!equipped) return <div className="text-xs text-green-400 mt-0.5">No item in {slot} slot</div>
                    const stats = ['strength', 'intelligence', 'luck', 'charisma'] as const
                    const deltas = stats.map(key => {
                      const diff = (item.effects?.[key] ?? 0) - (equipped.effects?.[key] ?? 0)
                      const label = key === 'charisma' ? 'CHA' : key.slice(0, 3).toUpperCase()
                      return diff !== 0 ? { label, diff } : null
                    }).filter(Boolean) as { label: string; diff: number }[]
                    if (deltas.length === 0) return <div className="text-xs text-gray-500 mt-0.5">Same stats as equipped {equipped.name}</div>
                    return (
                      <div className="text-xs mt-0.5 space-x-2">
                        <span className="text-gray-500">vs {equipped.name}:</span>
                        {deltas.map(d => (
                          <span key={d.label} className={d.diff > 0 ? 'text-green-400' : 'text-red-400'}>
                            {d.diff > 0 ? '+' : ''}{d.diff} {d.label}
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                  {item.onHitEffect && (
                    <div className="text-xs text-orange-400 mt-0.5">
                      On Hit: {item.onHitEffect.description} ({Math.round(item.onHitEffect.chance * 100)}% chance)
                    </div>
                  )}
                  {item.passiveEffect && (
                    <div className="text-xs text-cyan-400 mt-0.5">
                      Passive: {item.passiveEffect.description}
                    </div>
                  )}
                  {item.grantsSpell && (
                    <div className="text-xs text-purple-400 mt-0.5">
                      Grants Spell: {item.grantsSpell.spellName} ({item.grantsSpell.usesPerCombat}x/combat)
                    </div>
                  )}
                  {item.drawback && (
                    <div className="text-xs text-red-400 mt-0.5">
                      Drawback: {item.drawback.description} ({item.drawback.value} {item.drawback.stat})
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 mt-3">
                  {activeTab === 'active' && item.type === 'consumable' && (
                    <Button
                      className="flex-1 bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleUse(item)}
                      title="Use one of this item"
                    >
                      Use
                    </Button>
                  )}
                  {activeTab === 'active' && item.type === 'spell_scroll' && (
                    <Button
                      className="flex-1 bg-purple-700 hover:bg-purple-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleLearnSpell(item)}
                      title="Learn the spell from this scroll"
                    >
                      Learn
                    </Button>
                  )}
                  {activeTab === 'active' && item.type === 'equipment' && (
                    <Button
                      className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleEquip(item)}
                      title={`Equip to ${getEquipmentSlot(item)} slot`}
                    >
                      Equip
                    </Button>
                  )}
                  {activeTab === 'active' && item.type === 'trade_good' && (
                    <Button
                      className="flex-1 bg-amber-700 hover:bg-amber-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleUse(item)}
                      title={`Sell for gold`}
                    >
                      Sell
                    </Button>
                  )}
                  {activeTab === 'active' && item.type !== 'quest' ? (
                    <Button
                      className="flex-1 bg-red-700 hover:bg-red-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleDiscard(item)}
                      title="Discard all of this item"
                    >
                      Discard
                    </Button>
                  ) : activeTab === 'deleted' ? (
                    <Button
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleRestore(item)}
                      title="Restore this item"
                    >
                      Restore
                    </Button>
                  ) : null}
                </div>
              </div>
              )
            }}
          />
        )}
      </div>
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-[#1e1f30] border border-[#3a3c56] rounded-xl p-5 max-w-sm w-full mx-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const detailRarityStyle = RARITY_COLORS[detailItem.rarity ?? 'common']
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  {detailItem.isHeirloom && <span className="text-amber-400">&#9733;</span>}
                  <h4 className={`font-bold text-lg ${detailItem.rarity && detailItem.rarity !== 'common' ? detailRarityStyle.text : 'text-white'}`}>{detailItem.name}</h4>
                  {detailItem.enchantmentLevel && detailItem.enchantmentLevel > 0 && (
                    <span className="text-sm text-cyan-300 font-semibold">+{detailItem.enchantmentLevel}</span>
                  )}
                  {detailItem.type && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      detailItem.type === 'consumable' ? 'bg-green-900/50 text-green-400' :
                      detailItem.type === 'equipment' ? 'bg-indigo-900/50 text-indigo-400' :
                      detailItem.type === 'spell_scroll' ? 'bg-purple-900/50 text-purple-400' :
                      detailItem.type === 'quest' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-gray-900/50 text-gray-400'
                    }`}>
                      {detailItem.type === 'spell_scroll' ? 'Spell Scroll' : detailItem.type.charAt(0).toUpperCase() + detailItem.type.slice(1)}
                    </span>
                  )}
                  {detailItem.rarity && detailItem.rarity !== 'common' && (
                    <span className={`text-[10px] px-1.5 py-0.5 ${detailRarityStyle.bg} ${detailRarityStyle.text} rounded`}>
                      {detailRarityStyle.label}
                    </span>
                  )}
                </div>
              )
            })()}
            <p className="text-gray-300 text-sm">{detailItem.description}</p>
            {detailItem.loreText && (
              <div className="text-xs text-amber-300/70 italic">{detailItem.loreText}</div>
            )}
            {detailItem.quantity > 1 && (
              <div className="text-xs text-gray-400">Quantity: {detailItem.quantity}</div>
            )}
            {detailItem.effects && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">Effects</div>
                {Object.entries(detailItem.effects)
                  .filter(([, v]) => v !== undefined && v !== 0)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-300">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                      <span className={(v as number) > 0 ? 'text-green-400' : 'text-red-400'}>
                        {(v as number) > 0 ? '+' : ''}{v as number}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {detailItem.type === 'equipment' && (() => {
              const slot = getEquipmentSlot(detailItem)
              const equipped = equipment[slot]
              if (!equipped) return <div className="text-xs text-green-400">No item equipped in {slot} slot</div>
              const stats = ['strength', 'intelligence', 'luck', 'charisma'] as const
              const deltas = stats.map(key => {
                const diff = (detailItem.effects?.[key] ?? 0) - (equipped.effects?.[key] ?? 0)
                return diff !== 0 ? { label: key.charAt(0).toUpperCase() + key.slice(1), diff } : null
              }).filter(Boolean) as { label: string; diff: number }[]
              if (deltas.length === 0) return <div className="text-xs text-gray-500">Same stats as equipped {equipped.name}</div>
              return (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">vs {equipped.name}</div>
                  {deltas.map(d => (
                    <div key={d.label} className="flex justify-between text-sm">
                      <span className="text-gray-300">{d.label}</span>
                      <span className={d.diff > 0 ? 'text-green-400' : 'text-red-400'}>
                        {d.diff > 0 ? '+' : ''}{d.diff}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}
            {detailItem.spell && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">Spell: {detailItem.spell.name}</div>
                <div className="text-sm text-gray-300">{detailItem.spell.description}</div>
              </div>
            )}
            {detailItem.onHitEffect && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">On Hit Effect</div>
                <div className="text-sm text-orange-400">{detailItem.onHitEffect.description} ({Math.round(detailItem.onHitEffect.chance * 100)}% chance)</div>
              </div>
            )}
            {detailItem.passiveEffect && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">Passive Effect</div>
                <div className="text-sm text-cyan-400">{detailItem.passiveEffect.description}</div>
              </div>
            )}
            {detailItem.grantsSpell && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">Grants Spell</div>
                <div className="text-sm text-purple-400">{detailItem.grantsSpell.spellName} — {detailItem.grantsSpell.description} ({detailItem.grantsSpell.usesPerCombat}x per combat)</div>
              </div>
            )}
            {detailItem.drawback && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">Drawback</div>
                <div className="text-sm text-red-400">{detailItem.drawback.description} ({detailItem.drawback.value} {detailItem.drawback.stat})</div>
              </div>
            )}
            <button
              onClick={() => setDetailItem(null)}
              className="w-full mt-2 py-2 bg-[#2a2b3f] border border-[#3a3c56] text-gray-300 rounded-lg text-sm hover:bg-[#3a3c56] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

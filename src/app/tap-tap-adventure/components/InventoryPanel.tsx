'use client'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { List } from '@/app/tap-tap-adventure/components/ui/list'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { getEquipmentSlot, EquipmentSlots } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/types'

interface InventoryPanelProps {
  inventory: Item[]
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'spell_scroll', label: 'Spell' },
  { value: 'quest', label: 'Quest' },
  { value: 'misc', label: 'Misc' },
]

export function InventoryPanel({ inventory }: InventoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'type' | 'value'>('default')
  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const character = useGameStore(s => s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId))
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
    }, 500)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

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
        <div className="mb-2 p-2 bg-green-900/50 border border-green-700 rounded-md text-green-300 text-sm animate-pulse">
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
            renderItem={(item: Item) => (
              <div
                className={`relative bg-[#1e1f30] border ${item.isHeirloom ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-[#3a3c56]'} p-4 rounded-lg space-y-2 mb-3 w-full`}
                onPointerDown={() => handlePointerDown(item)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {item.quantity > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    x{item.quantity}
                  </span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {item.isHeirloom && (
                      <span className="text-amber-400 text-sm" title="Heirloom">&#9733;</span>
                    )}
                    <div className="font-bold text-white">{item.name}</div>
                    {item.rarity && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        item.rarity === 'legendary' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-600/40' :
                        item.rarity === 'rare' ? 'bg-blue-900/60 text-blue-300 border border-blue-600/40' :
                        item.rarity === 'uncommon' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40' :
                        'bg-gray-900/60 text-gray-400 border border-gray-600/40'
                      }`}>
                        {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
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
                  </div>
                  <div className="text-xs text-gray-400">{item.description}</div>
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
                    const stats = ['strength', 'intelligence', 'luck'] as const
                    const deltas = stats.map(key => {
                      const diff = (item.effects?.[key] ?? 0) - (equipped.effects?.[key] ?? 0)
                      return diff !== 0 ? { label: key.slice(0, 3).toUpperCase(), diff } : null
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
                  {activeTab === 'active' ? (
                    <Button
                      className="flex-1 bg-red-700 hover:bg-red-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleDiscard(item)}
                      title="Discard all of this item"
                    >
                      Discard
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm py-3 px-3 rounded-md transition-colors"
                      onClick={() => handleRestore(item)}
                      title="Restore this item"
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            )}
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
            <div className="flex items-center gap-2">
              {detailItem.isHeirloom && <span className="text-amber-400">&#9733;</span>}
              <h4 className="text-white font-bold text-lg">{detailItem.name}</h4>
              {detailItem.rarity && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  detailItem.rarity === 'legendary' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-600/40' :
                  detailItem.rarity === 'rare' ? 'bg-blue-900/60 text-blue-300 border border-blue-600/40' :
                  detailItem.rarity === 'uncommon' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40' :
                  'bg-gray-900/60 text-gray-400 border border-gray-600/40'
                }`}>
                  {detailItem.rarity.charAt(0).toUpperCase() + detailItem.rarity.slice(1)}
                </span>
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
            </div>
            <p className="text-gray-300 text-sm">{detailItem.description}</p>
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
              const stats = ['strength', 'intelligence', 'luck'] as const
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

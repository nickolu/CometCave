'use client'
import { useCallback, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { List } from '@/app/tap-tap-adventure/components/ui/list'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getEquipmentSlot } from '@/app/tap-tap-adventure/models/equipment'
import { Item } from '@/app/tap-tap-adventure/models/types'

interface InventoryPanelProps {
  inventory: Item[]
}

export function InventoryPanel({ inventory }: InventoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

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

  const handleDiscard = useCallback((item: Item) => {
    useGameStore.getState().discardItem(item.id)
  }, [])

  const handleRestore = useCallback((item: Item) => {
    useGameStore.getState().restoreItem(item.id)
  }, [])

  const itemsToDisplay = (inventory ?? []).filter(item => {
    if (activeTab === 'active') {
      return item.status !== 'deleted'
    }
    return item.status === 'deleted'
  })

  return (
    <div className="w-full flex flex-col h-full max-h-[calc(100vh-415px)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-white">
          {activeTab === 'active' ? 'Inventory' : 'Deleted Items'}
        </h3>
        <Button
          onClick={() => setActiveTab(activeTab === 'active' ? 'deleted' : 'active')}
          variant="link"
          className="text-sm text-gray-400 hover:text-gray-200 px-0 py-0 h-auto"
        >
          {activeTab === 'active' ? 'Show Deleted' : 'Show Active'}
        </Button>
      </div>
      {feedbackMessage && (
        <div className="mb-2 p-2 bg-green-900/50 border border-green-700 rounded-md text-green-300 text-sm animate-pulse">
          {feedbackMessage}
        </div>
      )}
      <div className="overflow-auto flex-1">
        {itemsToDisplay.length === 0 ? (
          <div className="text-gray-400">
            {activeTab === 'active' ? 'Your inventory is empty.' : 'No deleted items.'}
          </div>
        ) : (
          <List
            items={itemsToDisplay}
            className="space-y-0 w-full"
            renderItem={(item: Item) => (
              <div className="bg-[#1e1f30] border border-[#3a3c56] p-4 rounded-lg space-y-2 mb-3 w-full">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-white">{item.name}</div>
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
                  {item.quantity > 1 && (
                    <div className="text-xs text-gray-500 mt-0.5">Qty: {item.quantity}</div>
                  )}
                </div>
                <div className="flex space-x-2 mt-3">
                  {activeTab === 'active' && item.type === 'consumable' && (
                    <Button
                      className="flex-1 bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white text-xs py-2 px-3 rounded-md transition-colors"
                      onClick={() => handleUse(item)}
                      title="Use one of this item"
                    >
                      Use
                    </Button>
                  )}
                  {activeTab === 'active' && item.type === 'equipment' && (
                    <Button
                      className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white text-xs py-2 px-3 rounded-md transition-colors"
                      onClick={() => handleEquip(item)}
                      title={`Equip to ${getEquipmentSlot(item)} slot`}
                    >
                      Equip
                    </Button>
                  )}
                  {activeTab === 'active' ? (
                    <Button
                      className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs py-2 px-3 rounded-md transition-colors"
                      onClick={() => handleDiscard(item)}
                      title="Discard all of this item"
                    >
                      Discard
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-xs py-2 px-3 rounded-md transition-colors"
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
    </div>
  )
}

'use client'

import { useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { Item } from '@/app/tap-tap-adventure/models/types'

function formatEffects(effects?: Item['effects']): string {
  if (!effects) return 'No effects'
  const parts: string[] = []
  if (effects.strength) parts.push(`+${effects.strength} STR`)
  if (effects.intelligence) parts.push(`+${effects.intelligence} INT`)
  if (effects.luck) parts.push(`+${effects.luck} LCK`)
  if (effects.gold) parts.push(`+${effects.gold} Gold`)
  if (effects.reputation) parts.push(`+${effects.reputation} Rep`)
  return parts.length > 0 ? parts.join(', ') : 'No effects'
}

export function ShopUI() {
  const { gameState, setShopState, setGameState } = useGameStore()
  const [purchaseFeedback, setPurchaseFeedback] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)

  const shopState = gameState.shopState
  if (!shopState || !shopState.isOpen) return null

  const character = gameState.characters.find(c => c.id === gameState.selectedCharacterId)
  if (!character) return null

  const handlePurchase = async (item: Item) => {
    if (!item.price || character.gold < item.price) return
    setPurchasing(true)
    setPurchaseFeedback(null)

    try {
      const res = await fetch('/api/v1/tap-tap-adventure/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          itemId: item.id,
          price: item.price,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setPurchaseFeedback(errData.error || 'Purchase failed')
        return
      }

      // Update character gold and add item to inventory
      const processedItem = inferItemTypeAndEffects({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        type: item.type,
        effects: item.effects,
      })

      const updatedCharacters = gameState.characters.map(c => {
        if (c.id !== character.id) return c
        return {
          ...c,
          gold: c.gold - (item.price ?? 0),
          inventory: [...c.inventory, processedItem],
        }
      })

      // Remove the purchased item from the shop
      const remainingItems = shopState.items.filter(i => i.id !== item.id)

      setGameState({
        ...gameState,
        characters: updatedCharacters,
        shopState: { items: remainingItems, isOpen: true },
      })

      setPurchaseFeedback(`Purchased ${item.name}!`)
    } catch {
      setPurchaseFeedback('Purchase failed. Please try again.')
    } finally {
      setPurchasing(false)
    }
  }

  const handleLeaveShop = () => {
    setShopState(null)
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold w-full text-center uppercase border-b border-[#3a3c56] pb-2 mb-4">
        Milestone Shop
      </h4>
      <p className="text-sm text-gray-400 text-center">
        You leveled up! A traveling merchant has wares to offer.
      </p>
      <div className="text-sm text-center text-yellow-400 font-semibold">
        Your Gold: {character.gold}
      </div>

      {purchaseFeedback && (
        <div className="text-sm text-center text-green-400">{purchaseFeedback}</div>
      )}

      <div className="space-y-3">
        {shopState.items.map(item => {
          const canAfford = character.gold >= (item.price ?? 0)
          return (
            <div
              key={item.id}
              className="border border-[#3a3c56] bg-[#2a2b3f] rounded-lg p-3 space-y-1"
            >
              <div className="flex justify-between items-start">
                <div className="font-semibold text-white">{item.name}</div>
                <div className="text-yellow-400 font-bold text-sm whitespace-nowrap ml-2">
                  {item.price ?? '?'} gold
                </div>
              </div>
              <div className="text-xs text-gray-400">{item.description}</div>
              <div className="text-xs text-indigo-300">{formatEffects(item.effects)}</div>
              <Button
                className="w-full mt-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 border border-yellow-400/30 text-white font-bold text-sm py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canAfford || purchasing}
                onClick={() => handlePurchase(item)}
              >
                {canAfford ? 'Buy' : 'Not enough gold'}
              </Button>
            </div>
          )
        })}
      </div>

      {shopState.items.length === 0 && (
        <div className="text-sm text-gray-500 text-center">The merchant has nothing left to sell.</div>
      )}

      <Button
        className="w-full bg-[#2a2b3f] hover:bg-[#3a3c56] border border-[#3a3c56] text-white font-bold text-sm py-3 rounded"
        onClick={handleLeaveShop}
      >
        Leave Shop
      </Button>
    </div>
  )
}

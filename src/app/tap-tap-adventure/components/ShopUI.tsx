'use client'

import { useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { calculateSellPrice } from '@/app/tap-tap-adventure/lib/sellPrice'
import { getMountSellPrice } from '@/app/tap-tap-adventure/config/mounts'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getEquipmentSlot, EquipmentSlots } from '@/app/tap-tap-adventure/models/equipment'
import { ItemEffects } from '@/app/tap-tap-adventure/models/item'

type ShopTab = 'buy' | 'sell'

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

type NumericEffectKey = 'strength' | 'intelligence' | 'luck'
const STAT_KEYS: { key: NumericEffectKey; label: string }[] = [
  { key: 'strength', label: 'STR' },
  { key: 'intelligence', label: 'INT' },
  { key: 'luck', label: 'LCK' },
]

function ItemComparison({ item, equipment }: { item: Item; equipment: EquipmentSlots }) {
  if (item.type !== 'equipment') return null
  const slot = getEquipmentSlot(item)
  const equipped = equipment[slot]
  if (!equipped) {
    return <div className="text-xs text-green-400">No item in {slot} slot — direct upgrade</div>
  }
  const deltas = STAT_KEYS.map(({ key, label }) => {
    const newVal = Number(item.effects?.[key] ?? 0)
    const oldVal = Number(equipped.effects?.[key] ?? 0)
    const diff = newVal - oldVal
    if (diff === 0) return null
    return { label, diff }
  }).filter(Boolean) as { label: string; diff: number }[]

  if (deltas.length === 0) return <div className="text-xs text-gray-500">Same stats as equipped {equipped.name}</div>

  return (
    <div className="text-xs space-x-2">
      <span className="text-gray-500">vs {equipped.name}:</span>
      {deltas.map(d => (
        <span key={d.label} className={d.diff > 0 ? 'text-green-400' : 'text-red-400'}>
          {d.diff > 0 ? '+' : ''}{d.diff} {d.label}
        </span>
      ))}
    </div>
  )
}

export function ShopUI() {
  const { gameState, setShopState, setGameState, setMount } = useGameStore()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<ShopTab>('buy')
  const [pendingMount, setPendingMount] = useState<{ mount: Mount; oldMountName?: string } | null>(null)

  const shopState = gameState.shopState
  if (!shopState || !shopState.isOpen) return null

  const character = gameState.characters.find(c => c.id === gameState.selectedCharacterId)
  if (!character) return null

  const handlePurchase = async (item: Item) => {
    if (!item.price || character.gold < item.price) return
    setBusy(true)
    setFeedback(null)

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
        setFeedback(errData.error || 'Purchase failed')
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

      setFeedback(`Purchased ${item.name}!`)
    } catch {
      setFeedback('Purchase failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSell = async (item: Item) => {
    setBusy(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/v1/tap-tap-adventure/shop/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          itemId: item.id,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setFeedback(errData.error || 'Sell failed')
        return
      }

      const { updatedCharacter, goldEarned } = await res.json()

      const updatedCharacters = gameState.characters.map(c => {
        if (c.id !== character.id) return c
        return updatedCharacter
      })

      setGameState({
        ...gameState,
        characters: updatedCharacters,
      })

      setFeedback(`Sold ${item.name} for ${goldEarned} gold`)
    } catch {
      setFeedback('Sell failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleBuyMount = () => {
    const mountData = shopState.shopMount
    if (!mountData || character.gold < mountData.price) return
    setBusy(true)
    setFeedback(null)

    const oldMount = character.activeMount
    // Deduct gold and clear the shop mount; equip happens after naming
    const updatedCharacters = gameState.characters.map(c => {
      if (c.id !== character.id) return c
      return {
        ...c,
        gold: c.gold - mountData.price,
      }
    })

    setGameState({
      ...gameState,
      characters: updatedCharacters,
      shopState: { ...shopState, shopMount: null },
    })

    setBusy(false)
    setPendingMount({ mount: mountData.mount, oldMountName: oldMount?.name })
  }

  const handleMountNamed = (customName?: string) => {
    if (!pendingMount) return
    const mount = pendingMount.mount
    const namedMount = customName ? { ...mount, customName } : mount
    const oldMountName = pendingMount.oldMountName
    const updatedCharacters = gameState.characters.map(c => {
      if (c.id !== character.id) return c
      return { ...c, activeMount: namedMount }
    })
    setGameState({ ...gameState, characters: updatedCharacters })
    soundEngine.playMountAcquired()
    const displayName = customName ?? mount.name
    const replacedText = oldMountName ? ` (Replaced ${oldMountName})` : ''
    setFeedback(`Purchased ${displayName}!${replacedText}`)
    setPendingMount(null)
  }

  const handleLeaveShop = () => {
    setShopState(null)
  }

  const handleSellMount = () => {
    if (!character.activeMount) return
    const sellPrice = getMountSellPrice(character.activeMount.rarity)
    const mountName = character.activeMount.name

    const updatedCharacters = gameState.characters.map(c => {
      if (c.id !== character.id) return c
      return {
        ...c,
        gold: c.gold + sellPrice,
        activeMount: null,
      }
    })

    setGameState({
      ...gameState,
      characters: updatedCharacters,
    })

    soundEngine.playGold()
    setFeedback(`Sold ${mountName} for ${sellPrice} gold!`)
  }

  const sellableItems = character.inventory.filter(i => i.status !== 'deleted' && i.quantity > 0)

  return (
    <div className="space-y-4">
      <h4 className="font-semibold w-full text-center uppercase border-b border-[#3a3c56] pb-2 mb-4">
        Milestone Shop
      </h4>
      <p className="text-sm text-gray-400 text-center">
        A merchant&apos;s caravan comes into view!
      </p>
      <div className="text-sm text-center text-yellow-400 font-semibold">
        Your Gold: {character.gold}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2">
        <Button
          className={`flex-1 font-bold text-sm py-2 rounded border ${
            activeTab === 'buy'
              ? 'bg-gradient-to-r from-yellow-600 to-amber-600 border-yellow-400/30 text-white'
              : 'bg-[#2a2b3f] border-[#3a3c56] text-gray-400 hover:bg-[#3a3c56]'
          }`}
          onClick={() => { setActiveTab('buy'); setFeedback(null) }}
        >
          Buy
        </Button>
        <Button
          className={`flex-1 font-bold text-sm py-2 rounded border ${
            activeTab === 'sell'
              ? 'bg-gradient-to-r from-emerald-600 to-green-600 border-green-400/30 text-white'
              : 'bg-[#2a2b3f] border-[#3a3c56] text-gray-400 hover:bg-[#3a3c56]'
          }`}
          onClick={() => { setActiveTab('sell'); setFeedback(null) }}
        >
          Sell
        </Button>
      </div>

      {feedback && (
        <div className="text-sm text-center text-green-400">{feedback}</div>
      )}

      {/* Buy tab */}
      {activeTab === 'buy' && (
        <div className="space-y-3">
          {/* Mount for sale */}
          {shopState.shopMount && (() => {
            const { mount, price } = shopState.shopMount
            const canAffordMount = character.gold >= price
            const rarityColors: Record<string, string> = {
              common: 'text-gray-300',
              uncommon: 'text-green-400',
              rare: 'text-blue-400',
              legendary: 'text-yellow-400',
            }
            const bonusParts: string[] = []
            if (mount.bonuses.strength) bonusParts.push(`+${mount.bonuses.strength} STR`)
            if (mount.bonuses.intelligence) bonusParts.push(`+${mount.bonuses.intelligence} INT`)
            if (mount.bonuses.luck) bonusParts.push(`+${mount.bonuses.luck} LCK`)
            if (mount.bonuses.autoWalkSpeed) bonusParts.push(`${mount.bonuses.autoWalkSpeed}x speed`)
            if (mount.bonuses.healRate) bonusParts.push(`+${mount.bonuses.healRate} heal/step`)
            return (
              <div className="border border-purple-500/40 bg-[#2a2040] rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-white">
                    {mount.icon} {mount.name}
                    <span className={`ml-2 text-xs uppercase ${rarityColors[mount.rarity]}`}>
                      {mount.rarity}
                    </span>
                  </div>
                  <div className="text-yellow-400 font-bold text-sm whitespace-nowrap ml-2">
                    {price} gold
                  </div>
                </div>
                <div className="text-xs text-gray-400">{mount.description}</div>
                <div className="text-xs text-purple-300">{bonusParts.join(', ')}</div>
                <div className="text-xs text-gray-500">Daily upkeep: {mount.dailyCost} gold</div>
                {character.activeMount && (
                  <div className="text-xs text-amber-400">
                    Replaces current mount: {character.activeMount.icon} {character.activeMount.name}
                  </div>
                )}
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/30 text-white font-bold text-base py-3 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canAffordMount || busy}
                  onClick={handleBuyMount}
                >
                  {canAffordMount ? 'Buy Mount' : 'Not enough gold'}
                </Button>
              </div>
            )
          })()}

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
                {character.equipment && (
                  <ItemComparison item={item} equipment={character.equipment as EquipmentSlots} />
                )}
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 border border-yellow-400/30 text-white font-bold text-base py-3 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canAfford || busy}
                  onClick={() => handlePurchase(item)}
                >
                  {canAfford ? 'Buy' : 'Not enough gold'}
                </Button>
              </div>
            )
          })}

          {shopState.items.length === 0 && (
            <div className="text-sm text-gray-500 text-center">The merchant has nothing left to sell.</div>
          )}
        </div>
      )}

      {/* Sell tab */}
      {activeTab === 'sell' && (
        <div className="space-y-3">
          {/* Sell Mount */}
          {character.activeMount && (() => {
            const mount = character.activeMount
            const sellPrice = getMountSellPrice(mount.rarity)
            const rarityColors: Record<string, string> = {
              common: 'text-gray-300',
              uncommon: 'text-green-400',
              rare: 'text-blue-400',
              legendary: 'text-yellow-400',
            }
            const bonusParts: string[] = []
            if (mount.bonuses.strength) bonusParts.push(`+${mount.bonuses.strength} STR`)
            if (mount.bonuses.intelligence) bonusParts.push(`+${mount.bonuses.intelligence} INT`)
            if (mount.bonuses.luck) bonusParts.push(`+${mount.bonuses.luck} LCK`)
            if (mount.bonuses.autoWalkSpeed) bonusParts.push(`${mount.bonuses.autoWalkSpeed}x speed`)
            if (mount.bonuses.healRate) bonusParts.push(`+${mount.bonuses.healRate} heal/step`)
            return (
              <div className="border border-purple-500/40 bg-[#2a2040] rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-white">
                    {mount.icon} {mount.name}
                    <span className={`ml-2 text-xs uppercase ${rarityColors[mount.rarity]}`}>
                      {mount.rarity}
                    </span>
                  </div>
                  <div className="text-emerald-400 font-bold text-sm whitespace-nowrap ml-2">
                    {sellPrice} gold
                  </div>
                </div>
                <div className="text-xs text-gray-400">{mount.description}</div>
                <div className="text-xs text-purple-300">{bonusParts.join(', ')}</div>
                <div className="text-xs text-gray-500">Daily upkeep: {mount.dailyCost} gold</div>
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 border border-green-400/30 text-white font-bold text-base py-3 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={busy}
                  onClick={handleSellMount}
                >
                  Sell Mount
                </Button>
              </div>
            )
          })()}

          {sellableItems.map(item => {
            const sellPrice = calculateSellPrice(item)
            return (
              <div
                key={item.id}
                className="border border-[#3a3c56] bg-[#2a2b3f] rounded-lg p-3 space-y-1"
              >
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-white">
                    {item.name}
                    {item.quantity > 1 && (
                      <span className="text-xs text-gray-400 ml-1">(x{item.quantity})</span>
                    )}
                  </div>
                  <div className="text-emerald-400 font-bold text-sm whitespace-nowrap ml-2">
                    {sellPrice} gold
                  </div>
                </div>
                <div className="text-xs text-gray-400">{item.description}</div>
                <div className="text-xs text-indigo-300">{formatEffects(item.effects)}</div>
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 border border-green-400/30 text-white font-bold text-base py-3 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={busy}
                  onClick={() => handleSell(item)}
                >
                  Sell
                </Button>
              </div>
            )
          })}

          {sellableItems.length === 0 && !character.activeMount && (
            <div className="text-sm text-gray-500 text-center">You have nothing to sell.</div>
          )}
        </div>
      )}

      <Button
        className="w-full bg-[#2a2b3f] hover:bg-[#3a3c56] border border-[#3a3c56] text-white font-bold text-sm py-3 rounded"
        onClick={handleLeaveShop}
      >
        Leave Shop
      </Button>

      {pendingMount && (
        <MountNamingModal
          mount={pendingMount.mount}
          isOpen={true}
          onConfirm={handleMountNamed}
        />
      )}
    </div>
  )
}

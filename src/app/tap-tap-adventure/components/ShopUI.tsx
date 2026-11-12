'use client'

/**
 * The merchant's stall: a price list on a bill. Wares and the player's own
 * pack sit under two tabs; each ware is a ruled row with its price set in
 * the playbill's wood type; a mount for sale gets its own small bill with a
 * brass price.
 */
import { useState } from 'react'

import { MountNamingModal } from '@/app/tap-tap-adventure/components/MountNamingModal'
import { getMountSellPrice } from '@/app/tap-tap-adventure/config/mounts'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getNPCDispositionPriceMultiplier } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { calculateSellPrice } from '@/app/tap-tap-adventure/lib/sellPrice'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { EquipmentSlots, getEquipmentSlot } from '@/app/tap-tap-adventure/models/equipment'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { BrassPlate, PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

type ShopTab = 'buy' | 'sell'

function formatEffects(effects?: Item['effects']): string {
  if (!effects) return 'No effects'
  const parts: string[] = []
  if (effects.strength) parts.push(`+${effects.strength} STR`)
  if (effects.intelligence) parts.push(`+${effects.intelligence} INT`)
  if (effects.luck) parts.push(`+${effects.luck} LCK`)
  if (effects.charisma) parts.push(`+${effects.charisma} CHA`)
  if (effects.heal) parts.push(`+${effects.heal} HP`)
  if (effects.gold) parts.push(`+${effects.gold} Gold`)
  if (effects.reputation) parts.push(`+${effects.reputation} Rep`)
  if (effects.shield) parts.push(`+${effects.shield} Shield`)
  if (effects.manaRestore) parts.push(`+${effects.manaRestore} MP`)
  if (effects.cleanse) parts.push('Cleanse')
  if (effects.damageBoost) parts.push(`${effects.damageBoost}x Damage`)
  if (effects.revealLandmark) parts.push('Reveal Landmark')
  return parts.length > 0 ? parts.join(', ') : 'No effects'
}

type NumericEffectKey = 'strength' | 'intelligence' | 'luck' | 'charisma'
const STAT_KEYS: { key: NumericEffectKey; label: string }[] = [
  { key: 'strength', label: 'STR' },
  { key: 'intelligence', label: 'INT' },
  { key: 'luck', label: 'LCK' },
  { key: 'charisma', label: 'CHA' },
]

const RARITY_TONE: Record<string, StampTone> = {
  legendary: 'gold',
  epic: 'violet',
  rare: 'blue',
  uncommon: 'green',
  common: 'ink',
}

function ItemComparison({ item, equipment }: { item: Item; equipment: EquipmentSlots }) {
  if (item.type !== 'equipment') return null
  const slot = getEquipmentSlot(item)
  const equipped = equipment[slot]
  if (!equipped) {
    return <div className="font-body text-xs text-ps-stamp-green">No item in {slot} slot — direct upgrade</div>
  }
  const deltas = STAT_KEYS.map(({ key, label }) => {
    const newVal = Number(item.effects?.[key] ?? 0)
    const oldVal = Number(equipped.effects?.[key] ?? 0)
    const diff = newVal - oldVal
    if (diff === 0) return null
    return { label, diff }
  }).filter(Boolean) as { label: string; diff: number }[]

  if (deltas.length === 0) return <div className="font-body text-xs text-ps-ink-soft">Same stats as equipped {equipped.name}</div>

  return (
    <div className="flex flex-wrap items-center gap-x-2 font-body text-xs">
      <span className="text-ps-ink-soft">vs {equipped.name}:</span>
      {deltas.map(d => (
        <span key={d.label} className={cn('font-semibold tabular-nums', d.diff > 0 ? 'text-ps-stamp-green' : 'text-ps-stamp-red')}>
          {d.diff > 0 ? '+' : ''}{d.diff} {d.label}
        </span>
      ))}
    </div>
  )
}

/** A price set in the playbill's wood type: "18 g". */
function Price({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap font-playbill text-lg leading-none tabular-nums text-ps-ink', className)}>
      {value}
      <span className="ml-0.5 text-sm">g</span>
    </span>
  )
}

/** The item's stamps: enchantment, rarity, type. */
function ItemStamps({ item, showQuantity = false }: { item: Item; showQuantity?: boolean }) {
  return (
    <>
      {item.enchantmentLevel && item.enchantmentLevel > 0 ? (
        <Stamp tone="blue" tilt={false}>+{item.enchantmentLevel}</Stamp>
      ) : null}
      {item.rarity && item.rarity !== 'common' && (
        <Stamp tone={RARITY_TONE[item.rarity] ?? 'ink'} tilt={false}>{item.rarity}</Stamp>
      )}
      {item.type && item.type !== 'misc' && (
        <Stamp tone="ink" tilt={false}>{item.type}</Stamp>
      )}
      {showQuantity && item.quantity > 1 && (
        <span className="font-body text-xs tabular-nums text-ps-ink-soft">×{item.quantity}</span>
      )}
    </>
  )
}

function mountBonusParts(mount: Mount): string[] {
  const bonusParts: string[] = []
  if (mount.bonuses.strength) bonusParts.push(`+${mount.bonuses.strength} STR`)
  if (mount.bonuses.intelligence) bonusParts.push(`+${mount.bonuses.intelligence} INT`)
  if (mount.bonuses.luck) bonusParts.push(`+${mount.bonuses.luck} LCK`)
  if (mount.bonuses.autoWalkSpeed) bonusParts.push(`${mount.bonuses.autoWalkSpeed}x speed`)
  if (mount.bonuses.healRate) bonusParts.push(`+${mount.bonuses.healRate} heal/km`)
  return bonusParts
}

/** A mount on its own small bill, price on brass. */
function MountBill({
  caption,
  mount,
  price,
  note,
  action,
}: {
  caption: string
  mount: Mount
  price: number
  note?: React.ReactNode
  action: React.ReactNode
}) {
  const bonusParts = mountBonusParts(mount)
  return (
    <PlaybillSheet flat className="p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PlaybillCaption>{caption}</PlaybillCaption>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-body text-base leading-none" aria-hidden>{mount.icon}</span>
            <span className="font-playbill text-base text-ps-ink">{mount.name}</span>
            <Stamp tone={RARITY_TONE[mount.rarity] ?? 'ink'} tilt={false}>{mount.rarity}</Stamp>
          </div>
        </div>
        <BrassPlate className="shrink-0 px-2.5 py-1.5">
          <Price value={price} />
        </BrassPlate>
      </div>
      <p className="mt-2 font-body text-sm leading-snug text-ps-ink-soft">{mount.description}</p>
      {bonusParts.length > 0 && <p className="mt-1 font-body text-xs text-ps-ink">{bonusParts.join(', ')}</p>}
      <p className="mt-1 font-body text-xs text-ps-ink-soft">Daily upkeep: {mount.dailyCost} gold</p>
      {note}
      <div className="mt-3">{action}</div>
    </PlaybillSheet>
  )
}

const TABS: { id: ShopTab; label: string }[] = [
  { id: 'buy', label: 'Wares' },
  { id: 'sell', label: 'Your pack' },
]

const SORTS = [
  ['default', 'Default'],
  ['price-low', 'Low price'],
  ['price-high', 'High price'],
  ['rarity', 'Rarity'],
  ['type', 'Type'],
] as const

export function ShopUI() {
  const { gameState, setShopState, setGameState } = useGameStore()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<ShopTab>('buy')
  const [sortBy, setSortBy] = useState<'default' | 'price-low' | 'price-high' | 'rarity' | 'type'>('default')
  const [pendingMount, setPendingMount] = useState<{ mount: Mount; oldMountName?: string } | null>(null)

  const shopState = gameState.shopState
  if (!shopState || !shopState.isOpen) return null

  const character = gameState.characters.find(c => c.id === gameState.selectedCharacterId)
  if (!character) return null

  const npcDiscount = getNPCDispositionPriceMultiplier(character.npcEncounters)
  const npcDiscountPercent = Math.round((1 - npcDiscount) * 100)

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

  const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0 }

  const sortedShopItems = [...shopState.items].sort((a, b) => {
    if (sortBy === 'price-low') return (a.price ?? 0) - (b.price ?? 0)
    if (sortBy === 'price-high') return (b.price ?? 0) - (a.price ?? 0)
    if (sortBy === 'rarity') return (RARITY_ORDER[b.rarity ?? 'common'] ?? 0) - (RARITY_ORDER[a.rarity ?? 'common'] ?? 0)
    if (sortBy === 'type') return (a.type ?? 'misc').localeCompare(b.type ?? 'misc')
    return 0
  })

  const feedbackIsBad = !!feedback && /fail|not enough/i.test(feedback)

  return (
    <div>
      <PlaybillTitle size="sm">The merchant&apos;s stall</PlaybillTitle>
      <p className="mt-2 text-center font-body text-sm italic text-ps-ink-soft">A merchant&apos;s caravan comes into view!</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <PlaybillCaption className="text-ps-ink">
          Your purse · <span className="font-playbill text-sm normal-case tabular-nums">{character.gold} g</span>
        </PlaybillCaption>
        {npcDiscountPercent > 0 && (
          <Stamp tone="green" tilt={false}>{npcDiscountPercent}% off, a friend&apos;s price</Stamp>
        )}
      </div>

      {/* Tabs (the Drawers' SubTabs pattern) */}
      <div role="tablist" className="mt-4 flex flex-wrap gap-1 border-b-2 border-ps-ink pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => { setActiveTab(t.id); setFeedback(null) }}
            className={cn(
              'rounded-[2px] border-2 px-2.5 py-1 font-playbill text-xs uppercase tracking-widest transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary',
              activeTab === t.id ? 'border-ps-ink bg-ps-ink text-ps-playbill' : 'border-transparent text-ps-ink-soft hover:border-ps-ink hover:text-ps-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-[2px] border-2 border-dotted px-3 py-2 text-center font-body text-sm',
            feedbackIsBad ? 'border-ps-stamp-red text-ps-stamp-red' : 'border-ps-ink/50 text-ps-ink'
          )}
        >
          {feedback}
        </p>
      )}

      {/* Wares */}
      {activeTab === 'buy' && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-1">
            <PlaybillCaption className="mr-1">Sort</PlaybillCaption>
            {SORTS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sortBy === key}
                onClick={() => setSortBy(key)}
                className={cn(
                  'rounded-[2px] border px-1.5 py-0.5 font-label text-xs font-bold uppercase tracking-widest transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary',
                  sortBy === key ? 'border-ps-ink bg-ps-ink text-ps-playbill' : 'border-ps-ink/40 text-ps-ink-soft hover:border-ps-ink hover:text-ps-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {shopState.shopMount && (() => {
            const { mount, price } = shopState.shopMount
            const canAffordMount = character.gold >= price
            return (
              <div className="mt-3">
                <MountBill
                  caption="Mount for sale"
                  mount={mount}
                  price={price}
                  note={
                    character.activeMount ? (
                      <p className="mt-1 font-body text-xs text-ps-stamp-gold">
                        Replaces your current mount: {character.activeMount.icon} {character.activeMount.name}
                      </p>
                    ) : undefined
                  }
                  action={
                    <PaperButton variant="brass" className="w-full" disabled={!canAffordMount || busy} onClick={handleBuyMount}>
                      {canAffordMount ? 'Buy mount' : 'Not enough gold'}
                    </PaperButton>
                  }
                />
              </div>
            )
          })()}

          <ul className="mt-2 divide-y-2 divide-dotted divide-ps-ink/40" aria-label="Wares">
            {sortedShopItems.map(item => {
              const canAfford = character.gold >= (item.price ?? 0)
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-body text-base font-semibold leading-snug text-ps-ink">{item.name}</span>
                      <ItemStamps item={item} />
                    </div>
                    <p className="mt-0.5 font-body text-sm leading-snug text-ps-ink-soft">{item.description}</p>
                    <p className="mt-1 font-body text-xs text-ps-ink">{formatEffects(item.effects)}</p>
                    {item.onHitEffect && (
                      <p className="mt-0.5 font-body text-xs text-ps-ink-soft">
                        On hit: {item.onHitEffect.description} ({Math.round(item.onHitEffect.chance * 100)}% chance)
                      </p>
                    )}
                    {item.drawback && (
                      <p className="mt-0.5 font-body text-xs text-ps-stamp-red">Drawback: {item.drawback.description}</p>
                    )}
                    {item.loreText && (
                      <p className="mt-0.5 font-body text-xs italic text-ps-ink-soft">{item.loreText}</p>
                    )}
                    {character.equipment && (
                      <div className="mt-1">
                        <ItemComparison item={item} equipment={character.equipment as EquipmentSlots} />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Price value={item.price ?? '?'} />
                    <PaperButton variant="brass" size="sm" disabled={!canAfford || busy} onClick={() => handlePurchase(item)}>
                      {canAfford ? 'Buy' : 'Not enough gold'}
                    </PaperButton>
                  </div>
                </li>
              )
            })}
          </ul>

          {shopState.items.length === 0 && (
            <p className="py-4 text-center font-body text-sm italic text-ps-ink-soft">The merchant has nothing left to sell.</p>
          )}
        </div>
      )}

      {/* Your pack */}
      {activeTab === 'sell' && (
        <div className="mt-3">
          {character.activeMount && (() => {
            const mount = character.activeMount
            const sellPrice = getMountSellPrice(mount.rarity)
            return (
              <MountBill
                caption="Your mount"
                mount={mount}
                price={sellPrice}
                action={
                  <PaperButton variant="outline" className="w-full" disabled={busy} onClick={handleSellMount}>
                    Sell mount
                  </PaperButton>
                }
              />
            )
          })()}

          <ul className="mt-2 divide-y-2 divide-dotted divide-ps-ink/40" aria-label="Your pack">
            {sellableItems.map(item => {
              const sellPrice = calculateSellPrice(item)
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-body text-base font-semibold leading-snug text-ps-ink">{item.name}</span>
                      <ItemStamps item={item} showQuantity />
                    </div>
                    <p className="mt-0.5 font-body text-sm leading-snug text-ps-ink-soft">{item.description}</p>
                    <p className="mt-1 font-body text-xs text-ps-ink">{formatEffects(item.effects)}</p>
                    {item.onHitEffect && (
                      <p className="mt-0.5 font-body text-xs text-ps-ink-soft">
                        On hit: {item.onHitEffect.description} ({Math.round(item.onHitEffect.chance * 100)}% chance)
                      </p>
                    )}
                    {item.drawback && (
                      <p className="mt-0.5 font-body text-xs text-ps-stamp-red">Drawback: {item.drawback.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Price value={sellPrice} />
                    <PaperButton variant="outline" size="sm" disabled={busy} onClick={() => handleSell(item)}>
                      Sell
                    </PaperButton>
                  </div>
                </li>
              )
            })}
          </ul>

          {sellableItems.length === 0 && !character.activeMount && (
            <p className="py-4 text-center font-body text-sm italic text-ps-ink-soft">You have nothing to sell.</p>
          )}
        </div>
      )}

      <PaperButton variant="outline" className="mt-4 w-full border-ps-ink/50 text-ps-ink-soft" onClick={handleLeaveShop}>
        Leave the shop
      </PaperButton>

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

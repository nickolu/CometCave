'use client'

/**
 * The town stable: your mounts and the ones for sale, each on a small card
 * on the bill, with heal, stash, sell and buy priced in gold.
 */
import { useEffect, useState } from 'react'

import { MOUNT_PERSONALITY_INFO, getMountMaxHp, getMountPrice, getMountSellPrice, getShopMount } from '@/app/tap-tap-adventure/config/mounts'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface StablePanelProps {
  character: FantasyCharacter
  onClose: () => void
  regionId?: string
}

const RARITY_TONE: Record<string, StampTone> = {
  common: 'ink',
  uncommon: 'green',
  rare: 'blue',
  legendary: 'gold',
}

function MountStatBadges({ mount }: { mount: Mount }) {
  const badges: React.ReactNode[] = []
  const b = mount.bonuses ?? {}

  if (b.autoWalkSpeed && b.autoWalkSpeed > 1) {
    badges.push(<Stamp key="speed" tone="blue" tilt={false}>{b.autoWalkSpeed}x speed</Stamp>)
  }
  if (b.strength && b.strength > 0) {
    badges.push(<Stamp key="str" tone="red" tilt={false}>+{b.strength} STR</Stamp>)
  }
  if (b.intelligence && b.intelligence > 0) {
    badges.push(<Stamp key="int" tone="violet" tilt={false}>+{b.intelligence} INT</Stamp>)
  }
  if (b.luck && b.luck > 0) {
    badges.push(<Stamp key="luck" tone="green" tilt={false}>+{b.luck} LCK</Stamp>)
  }
  if (mount.personality) {
    const info = MOUNT_PERSONALITY_INFO[mount.personality]
    if (info) {
      badges.push(
        <Stamp key="personality" tone="ink" tilt={false}>
          <span aria-hidden>{info.icon}</span> {info.label}
        </Stamp>
      )
    }
  }

  if (badges.length === 0) return null
  return <div className="flex flex-wrap gap-1">{badges}</div>
}

function MountCard({ mount, actions }: { mount: Mount; actions: React.ReactNode }) {
  const maxHp = mount.maxHp ?? getMountMaxHp(mount.rarity)
  const currentHp = mount.hp ?? maxHp
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))

  return (
    <div className="rounded-[3px] border-2 border-ps-ink p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-body text-xl leading-none" aria-hidden>{mount.icon}</span>
          <div className="min-w-0">
            <div className="font-body text-base font-semibold leading-tight text-ps-ink">{mount.customName ?? mount.name}</div>
            <Stamp tone={RARITY_TONE[mount.rarity] ?? 'ink'} tilt={false} className="mt-1">{mount.rarity}</Stamp>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap font-body text-xs tabular-nums text-ps-ink-soft">
          <span className="font-playbill text-sm text-ps-ink">{mount.dailyCost} g</span>/day
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 font-body text-xs text-ps-ink-soft">
        <span className="w-5 font-label text-xs font-bold uppercase tracking-widest">HP</span>
        <span
          className="block h-1.5 flex-1 overflow-hidden rounded-full bg-ps-ink/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hpPct)}
          aria-label={`${mount.customName ?? mount.name} health`}
        >
          <span className={cn('block h-full rounded-full', hpPct < 35 ? 'bg-ps-stamp-red' : 'bg-ps-stamp-green')} style={{ width: `${hpPct}%` }} />
        </span>
        <span className="w-12 text-right tabular-nums">{currentHp}/{maxHp}</span>
      </div>
      <div className="mt-2">
        <MountStatBadges mount={mount} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  )
}

const TABS = [
  { id: 'your', label: 'Your mounts' },
  { id: 'buy', label: 'For sale' },
] as const

export function StablePanel({ character, onClose }: StablePanelProps) {
  const { stashMount, retrieveMount, healMount, sellMount, buyStableMount } = useGameStore()
  const [confirmStash, setConfirmStash] = useState(false)
  const [confirmSellId, setConfirmSellId] = useState<string | null>(null)
  const [tab, setTab] = useState<'your' | 'buy'>('your')
  const [shopMounts, setShopMounts] = useState<Mount[]>([])

  const activeMount = character.activeMount
  const roster = character.mountRoster ?? []

  // Generate shop mounts once when panel opens
  useEffect(() => {
    const generated: Mount[] = []
    const seen = new Set<string>()
    let attempts = 0
    while (generated.length < 3 && attempts < 20) {
      const m = getShopMount(character.level)
      // Allow duplicates of different personalities, but use a unique id per listing
      const listingId = `shop-${m.id}-${attempts}`
      generated.push({ ...m, id: listingId })
      seen.add(m.id)
      attempts++
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShopMounts(generated)
  }, [character.level])

  const getHealCost = (mount: Mount) => {
    const maxHp = mount.maxHp ?? getMountMaxHp(mount.rarity)
    const currentHp = mount.hp ?? maxHp
    if (currentHp >= maxHp) return 0
    return Math.max(1, Math.ceil((maxHp - currentHp) * 0.5))
  }

  const canBuyMount = (mount: Mount) => {
    const price = getMountPrice(mount.rarity)
    if (character.gold < price) return false
    if (activeMount && roster.length >= 5) return false
    return true
  }

  const handleSell = (mountId: string, isActive: boolean) => {
    sellMount(mountId, isActive)
    setConfirmSellId(null)
  }

  const sellActions = (mount: Mount, isActive: boolean) =>
    confirmSellId === mount.id ? (
      <>
        <span className="font-body text-xs text-ps-stamp-red">Sell for <span className="tabular-nums">{getMountSellPrice(mount.rarity)} g</span>?</span>
        <PaperButton variant="danger" size="sm" onClick={() => handleSell(mount.id, isActive)}>Yes</PaperButton>
        <PaperButton variant="outline" size="sm" onClick={() => setConfirmSellId(null)}>No</PaperButton>
      </>
    ) : (
      <PaperButton variant="danger" size="sm" onClick={() => setConfirmSellId(mount.id)}>
        Sell · <span className="tabular-nums">{getMountSellPrice(mount.rarity)} g</span>
      </PaperButton>
    )

  const healAction = (mount: Mount, isActive: boolean) =>
    getHealCost(mount) > 0 ? (
      <PaperButton variant="brass" size="sm" disabled={character.gold < getHealCost(mount)} onClick={() => healMount(mount.id, isActive)}>
        Heal · <span className="tabular-nums">{getHealCost(mount)} g</span>
      </PaperButton>
    ) : null

  return (
    <section aria-label="The stable">
      <div className="flex items-start gap-2">
        <PlaybillTitle size="sm" className="min-w-0 flex-1">Town stable</PlaybillTitle>
        <PaperButton variant="outline" size="sm" className="w-8 shrink-0 px-0" onClick={onClose} aria-label="Close stable">
          <CloseIcon />
        </PaperButton>
      </div>

      <PlaybillCaption className="mt-2 text-center">
        <span className="font-playbill text-sm normal-case tabular-nums text-ps-ink">{character.gold.toLocaleString()} g</span>
        {' · '}Stabled <span className="tabular-nums">{roster.length}/5</span>
      </PlaybillCaption>

      <div role="tablist" className="mt-3 flex flex-wrap gap-1 border-b-2 border-ps-ink pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-[2px] border-2 px-2.5 py-1 font-playbill text-xs uppercase tracking-widest transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary',
              tab === t.id ? 'border-ps-ink bg-ps-ink text-ps-playbill' : 'border-transparent text-ps-ink-soft hover:border-ps-ink hover:text-ps-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'your' && (
        <div className="mt-3 space-y-4">
          {/* Active Mount */}
          <div>
            <PlaybillCaption className="mb-2">Riding</PlaybillCaption>
            {activeMount ? (
              <MountCard mount={activeMount} actions={
                <>
                  {healAction(activeMount, true)}
                  {roster.length < 5 ? (
                    confirmStash ? (
                      <>
                        <span className="font-body text-xs text-ps-ink">Stash this mount?</span>
                        <PaperButton size="sm" onClick={() => { stashMount(); setConfirmStash(false) }}>Yes</PaperButton>
                        <PaperButton variant="outline" size="sm" onClick={() => setConfirmStash(false)}>No</PaperButton>
                      </>
                    ) : (
                      <PaperButton variant="outline" size="sm" onClick={() => setConfirmStash(true)}>
                        Stash
                      </PaperButton>
                    )
                  ) : (
                    <span className="font-body text-xs text-ps-ink-soft">Stable full (5/5)</span>
                  )}
                  {sellActions(activeMount, true)}
                </>
              } />
            ) : (
              <p className="font-body text-sm italic text-ps-ink-soft">No mount under you. Take one out of the stable or buy a new one.</p>
            )}
          </div>

          {/* Stabled Mounts */}
          {roster.length > 0 && (
            <div>
              <PlaybillCaption className="mb-2">Stabled ({roster.length}/5)</PlaybillCaption>
              <div className="space-y-2">
                {roster.map(mount => (
                  <MountCard key={mount.id} mount={mount} actions={
                    <>
                      <PaperButton size="sm" onClick={() => retrieveMount(mount.id)}>
                        {activeMount ? 'Swap' : 'Take out'}
                      </PaperButton>
                      {healAction(mount, false)}
                      {sellActions(mount, false)}
                    </>
                  } />
                ))}
              </div>
            </div>
          )}

          {!activeMount && roster.length === 0 && (
            <p className="py-2 text-center font-body text-sm italic text-ps-ink-soft">
              You have no mounts. The ones for sale are under the other tab.
            </p>
          )}
        </div>
      )}

      {tab === 'buy' && (
        <div className="mt-3 space-y-2">
          <p className="font-body text-sm text-ps-ink-soft">Mounts for sale at this stable:</p>
          {shopMounts.length === 0 ? (
            <p className="py-2 text-center font-body text-sm italic text-ps-ink-soft">No mounts for sale right now.</p>
          ) : (
            <div className="space-y-2">
              {shopMounts.map((mount) => {
                const price = getMountPrice(mount.rarity)
                const affordable = character.gold >= price
                const hasRoom = !activeMount || roster.length < 5
                const buyable = affordable && hasRoom
                return (
                  <MountCard key={mount.id} mount={mount} actions={
                    <>
                      <PaperButton
                        variant="brass"
                        size="sm"
                        disabled={!buyable}
                        title={
                          !affordable ? 'Not enough gold' :
                          !hasRoom ? 'No room (active + roster full)' :
                          `Buy for ${price}g`
                        }
                        onClick={() => {
                          if (buyStableMount(mount)) {
                            // Remove the purchased mount from the shop listing
                            setShopMounts(prev => prev.filter(m => m.id !== mount.id))
                          }
                        }}
                      >
                        Buy · <span className="tabular-nums">{price} g</span>
                      </PaperButton>
                      {!buyable && (
                        <span className="font-body text-xs text-ps-stamp-red">
                          {!affordable ? 'Not enough gold' : 'No room in the stable'}
                        </span>
                      )}
                    </>
                  } />
                )
              })}
            </div>
          )}
          {!activeMount && roster.length === 0 && (
            <p className="font-body text-xs italic text-ps-ink-soft">Your first mount goes straight under you.</p>
          )}
        </div>
      )}

      <PaperButton variant="outline" className="mt-4 w-full border-ps-ink/50 text-ps-ink-soft" onClick={onClose}>
        Back to town
      </PaperButton>
    </section>
  )
}

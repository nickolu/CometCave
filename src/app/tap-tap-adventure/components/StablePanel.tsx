'use client'
import { useState, useEffect } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getMountMaxHp, getMountSellPrice, getMountPrice, getShopMount, MOUNT_PERSONALITY_INFO } from '@/app/tap-tap-adventure/config/mounts'

interface StablePanelProps {
  character: FantasyCharacter
  onClose: () => void
  regionId?: string
}

function MountStatBadges({ mount }: { mount: Mount }) {
  const badges: React.ReactNode[] = []
  const b = mount.bonuses ?? {}

  if (b.autoWalkSpeed && b.autoWalkSpeed > 1) {
    badges.push(
      <span key="speed" className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-blue-900/40 text-blue-300">
        ⚡ {b.autoWalkSpeed}x speed
      </span>
    )
  }
  if (b.strength && b.strength > 0) {
    badges.push(
      <span key="str" className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-red-900/40 text-red-300">
        ⚔️ +{b.strength} STR
      </span>
    )
  }
  if (b.intelligence && b.intelligence > 0) {
    badges.push(
      <span key="int" className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-purple-900/40 text-purple-300">
        📖 +{b.intelligence} INT
      </span>
    )
  }
  if (b.luck && b.luck > 0) {
    badges.push(
      <span key="luck" className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-green-900/40 text-green-300">
        🍀 +{b.luck} LCK
      </span>
    )
  }
  if (mount.personality) {
    const info = MOUNT_PERSONALITY_INFO[mount.personality]
    if (info) {
      badges.push(
        <span key="personality" className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-slate-700/60 text-slate-300">
          {info.icon} {info.label}
        </span>
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
  const rarityColors: Record<string, string> = {
    common: 'text-slate-300 bg-slate-700/60',
    uncommon: 'text-green-400 bg-green-900/40',
    rare: 'text-blue-400 bg-blue-900/40',
    legendary: 'text-amber-400 bg-amber-900/40',
  }

  return (
    <div className="bg-[#252638] border border-[#3a3c56] rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{mount.icon}</span>
          <div>
            <div className="text-xs font-semibold text-slate-200">{mount.customName ?? mount.name}</div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-semibold ${rarityColors[mount.rarity] ?? ''}`}>
              {mount.rarity}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400">{mount.dailyCost}g/day</div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-slate-400 w-5">HP</span>
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="text-slate-400 w-12 text-right">{currentHp}/{maxHp}</span>
      </div>
      <MountStatBadges mount={mount} />
      <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>
    </div>
  )
}

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

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">Town Stable</span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>x</button>
      </div>

      <div className="text-[10px] text-slate-400">
        Gold: <span className="text-amber-300 font-semibold">{character.gold.toLocaleString()}g</span>
        {' · '}Stabled: {roster.length}/5
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1">
        <button
          className={`flex-1 text-[11px] py-1 rounded transition-colors font-medium ${
            tab === 'your'
              ? 'bg-amber-700/50 text-amber-300'
              : 'bg-slate-700/40 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
          }`}
          onClick={() => setTab('your')}
        >
          Your Mounts
        </button>
        <button
          className={`flex-1 text-[11px] py-1 rounded transition-colors font-medium ${
            tab === 'buy'
              ? 'bg-amber-700/50 text-amber-300'
              : 'bg-slate-700/40 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
          }`}
          onClick={() => setTab('buy')}
        >
          Buy Mounts
        </button>
      </div>

      {tab === 'your' && (
        <div className="space-y-3">
          {/* Active Mount */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Active Mount</h4>
            {activeMount ? (
              <MountCard mount={activeMount} actions={
                <>
                  {getHealCost(activeMount) > 0 && (
                    <button
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                        character.gold >= getHealCost(activeMount)
                          ? 'bg-green-900/30 text-green-400 hover:bg-green-800/40'
                          : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
                      }`}
                      disabled={character.gold < getHealCost(activeMount)}
                      onClick={() => healMount(activeMount.id, true)}
                    >
                      Heal ({getHealCost(activeMount)}g)
                    </button>
                  )}
                  {roster.length < 5 ? (
                    confirmStash ? (
                      <>
                        <span className="text-[10px] text-amber-400">Stash mount?</span>
                        <button className="text-[10px] px-1.5 py-0.5 bg-amber-900/50 text-amber-400 rounded hover:bg-amber-800/50"
                          onClick={() => { stashMount(); setConfirmStash(false) }}>Yes</button>
                        <button className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
                          onClick={() => setConfirmStash(false)}>No</button>
                      </>
                    ) : (
                      <button
                        className="text-[10px] px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded hover:bg-amber-800/40 transition-colors"
                        onClick={() => setConfirmStash(true)}
                      >
                        Stash
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-500">Roster full (5/5)</span>
                  )}
                  {confirmSellId === activeMount.id ? (
                    <>
                      <span className="text-[10px] text-red-400">Sell for {getMountSellPrice(activeMount.rarity)}g?</span>
                      <button className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded hover:bg-red-800/50"
                        onClick={() => handleSell(activeMount.id, true)}>Yes</button>
                      <button className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
                        onClick={() => setConfirmSellId(null)}>No</button>
                    </>
                  ) : (
                    <button
                      className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-800/40 transition-colors"
                      onClick={() => setConfirmSellId(activeMount.id)}
                    >
                      Sell ({getMountSellPrice(activeMount.rarity)}g)
                    </button>
                  )}
                </>
              } />
            ) : (
              <div className="text-xs text-slate-500 italic">No active mount. Retrieve one from the stable or purchase a new one.</div>
            )}
          </div>

          {/* Stabled Mounts */}
          {roster.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Stabled Mounts ({roster.length}/5)</h4>
              <div className="space-y-1.5">
                {roster.map(mount => (
                  <MountCard key={mount.id} mount={mount} actions={
                    <>
                      <button
                        className="text-[10px] px-2 py-0.5 bg-indigo-900/30 text-indigo-300 rounded hover:bg-indigo-800/40 transition-colors"
                        onClick={() => retrieveMount(mount.id)}
                      >
                        {activeMount ? 'Swap' : 'Retrieve'}
                      </button>
                      {getHealCost(mount) > 0 && (
                        <button
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                            character.gold >= getHealCost(mount)
                              ? 'bg-green-900/30 text-green-400 hover:bg-green-800/40'
                              : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
                          }`}
                          disabled={character.gold < getHealCost(mount)}
                          onClick={() => healMount(mount.id, false)}
                        >
                          Heal ({getHealCost(mount)}g)
                        </button>
                      )}
                      {confirmSellId === mount.id ? (
                        <>
                          <span className="text-[10px] text-red-400">Sell for {getMountSellPrice(mount.rarity)}g?</span>
                          <button className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded hover:bg-red-800/50"
                            onClick={() => handleSell(mount.id, false)}>Yes</button>
                          <button className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50"
                            onClick={() => setConfirmSellId(null)}>No</button>
                        </>
                      ) : (
                        <button
                          className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-800/40 transition-colors"
                          onClick={() => setConfirmSellId(mount.id)}
                        >
                          Sell ({getMountSellPrice(mount.rarity)}g)
                        </button>
                      )}
                    </>
                  } />
                ))}
              </div>
            </div>
          )}

          {!activeMount && roster.length === 0 && (
            <div className="text-xs text-slate-500 italic text-center py-2">
              You have no mounts. Visit the Buy Mounts tab to find one!
            </div>
          )}
        </div>
      )}

      {tab === 'buy' && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-400">Mounts available at this stable:</p>
          {shopMounts.length === 0 ? (
            <div className="text-xs text-slate-500 italic text-center py-2">No mounts available right now.</div>
          ) : (
            <div className="space-y-1.5">
              {shopMounts.map((mount) => {
                const price = getMountPrice(mount.rarity)
                const affordable = character.gold >= price
                const hasRoom = !activeMount || roster.length < 5
                const buyable = affordable && hasRoom
                return (
                  <MountCard key={mount.id} mount={mount} actions={
                    <button
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                        buyable
                          ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-800/40'
                          : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
                      }`}
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
                      Buy ({price}g)
                    </button>
                  } />
                )
              })}
            </div>
          )}
          {!activeMount && roster.length === 0 && (
            <p className="text-[10px] text-slate-500 italic">Tip: Your first mount goes to the active slot automatically.</p>
          )}
        </div>
      )}

      {/* Back button */}
      <button
        className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
        onClick={onClose}
      >
        Back to Town
      </button>
    </div>
  )
}

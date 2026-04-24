'use client'
import { useState } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getMountMaxHp } from '@/app/tap-tap-adventure/config/mounts'

interface StablePanelProps {
  character: FantasyCharacter
  onClose: () => void
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
      <div className="flex items-center gap-1.5">{actions}</div>
    </div>
  )
}

export function StablePanel({ character, onClose }: StablePanelProps) {
  const { stashMount, retrieveMount, healMount } = useGameStore()
  const [confirmStash, setConfirmStash] = useState(false)

  const activeMount = character.activeMount
  const roster = character.mountRoster ?? []

  const getHealCost = (mount: Mount) => {
    const maxHp = mount.maxHp ?? getMountMaxHp(mount.rarity)
    const currentHp = mount.hp ?? maxHp
    if (currentHp >= maxHp) return 0
    return Math.max(1, Math.ceil((maxHp - currentHp) * 0.5))
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">Town Stable</span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>x</button>
      </div>

      <div className="text-[10px] text-slate-400">
        Gold: <span className="text-amber-300 font-semibold">{character.gold.toLocaleString()}g</span>
        {' · '}Stabled: {roster.length}/5
      </div>

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
                </>
              } />
            ))}
          </div>
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

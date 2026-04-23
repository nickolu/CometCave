'use client'

import { useState } from 'react'

import { FACTIONS, FACTION_IDS, getFactionRepTier, FactionId, FactionGearItem } from '@/app/tap-tap-adventure/config/factions'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

interface FactionPanelProps {
  character: FantasyCharacter
}

function RepBar({ rep, max = 200 }: { rep: number; max?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (rep / max) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-slate-400 text-right w-12">{rep}/200</span>
    </div>
  )
}

function TierBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    Neutral: 'text-slate-300 bg-slate-700/60',
    Friendly: 'text-green-400 bg-green-900/40',
    Honored: 'text-blue-400 bg-blue-900/40',
    Exalted: 'text-amber-400 bg-amber-900/40',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-semibold ${colors[label] ?? 'text-slate-300 bg-slate-700/60'}`}>
      {label}
    </span>
  )
}

function GearItemRow({ gear, rep, gold, factionId }: { gear: FactionGearItem; rep: number; gold: number; factionId: FactionId }) {
  const { purchaseFactionGear } = useGameStore()
  const canAfford = gold >= gear.price
  const hasRep = rep >= gear.requiredRep
  const canBuy = canAfford && hasRep
  const requiredTier = getFactionRepTier(gear.requiredRep)

  const effectParts: string[] = []
  if (gear.effects.strength) effectParts.push(`+${gear.effects.strength} STR`)
  if (gear.effects.intelligence) effectParts.push(`+${gear.effects.intelligence} INT`)
  if (gear.effects.luck) effectParts.push(`+${gear.effects.luck} LCK`)
  if (gear.effects.charisma) effectParts.push(`+${gear.effects.charisma} CHA`)

  return (
    <div className="bg-[#1a1b2e] border border-[#3a3c56] rounded p-2 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-200 truncate">{gear.name}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{effectParts.join(' · ')} · {gear.slot}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Requires: {requiredTier.label}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] text-amber-400 font-semibold mb-1">{gear.price}g</div>
        <button
          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
            canBuy
              ? 'bg-indigo-700/50 text-indigo-300 hover:bg-indigo-600/60'
              : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
          }`}
          disabled={!canBuy}
          onClick={() => purchaseFactionGear(factionId, gear.id)}
          title={!hasRep ? `Need ${requiredTier.label} standing` : !canAfford ? `Need ${gear.price}g` : ''}
        >
          Buy
        </button>
      </div>
    </div>
  )
}

function FactionCard({ factionId, character }: { factionId: FactionId; character: FantasyCharacter }) {
  const [expanded, setExpanded] = useState(false)
  const faction = FACTIONS[factionId]
  const rep = (character.factionReputations ?? {})[factionId] ?? 0
  const tier = getFactionRepTier(rep)

  return (
    <div className="bg-[#252638] border border-[#3a3c56] rounded-lg overflow-hidden">
      <button
        className="w-full p-2.5 flex items-center gap-2 text-left hover:bg-[#2e3050] transition-colors"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="text-lg leading-none">{faction.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{faction.name}</div>
          <RepBar rep={rep} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <TierBadge label={tier.label} />
          <span className="text-slate-500 text-[10px]">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-[#3a3c56] pt-2">
          <p className="text-[10px] text-slate-400 italic">{faction.description}</p>
          <div className="space-y-1.5 mt-1.5">
            {faction.gear.map(gear => (
              <GearItemRow
                key={gear.id}
                gear={gear}
                rep={rep}
                gold={character.gold}
                factionId={factionId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function FactionPanel({ character }: FactionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const factionReps = character.factionReputations ?? {}
  const activeFactionCount = FACTION_IDS.filter(id => (factionReps[id] ?? 0) > 0).length

  if (!isExpanded) {
    return (
      <button
        className="w-full bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 text-left hover:border-indigo-700/50 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-indigo-400">🏰 Factions</span>
          <span className="text-xs text-slate-400">
            {activeFactionCount > 0 ? `${activeFactionCount} active` : 'No standing'}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <button
          className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => setIsExpanded(false)}
        >
          🏰 Factions
        </button>
        <span className="text-xs text-amber-300 font-semibold">
          &#x1F4B0; {character.gold.toLocaleString()}g
        </span>
      </div>
      <div className="space-y-2">
        {FACTION_IDS.map(id => (
          <FactionCard key={id} factionId={id} character={character} />
        ))}
      </div>
    </div>
  )
}

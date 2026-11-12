'use client'

/**
 * The factions: each a ruled row with your standing stamped and ruled, and
 * under it the gear they will sell you once you stand well enough with them.
 */
import { useState } from 'react'

import { FACTIONS, FACTION_IDS, FactionGearItem, FactionId, getFactionRepTier } from '@/app/tap-tap-adventure/config/factions'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { ChevronIcon } from '@/app/tap-tap-adventure/stage/icons'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface FactionPanelProps {
  character: FantasyCharacter
}

/** The printer's ink for each standing. */
const TIER_TONE: Record<string, StampTone> = {
  Neutral: 'ink',
  Friendly: 'green',
  Honored: 'blue',
  Exalted: 'gold',
}

function RepBar({ rep, max = 200, label }: { rep: number; max?: number; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (rep / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ps-playbill-edge" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={rep} aria-label={label}>
        <div className="h-full rounded-full bg-ps-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right font-playbill text-xs tabular-nums text-ps-ink-soft">{rep}/{max}</span>
    </div>
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
    <li className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-sm font-semibold leading-snug text-ps-ink">{gear.name}</div>
        <div className="mt-0.5 font-body text-xs text-ps-ink-soft">
          {effectParts.join(' · ')} · <span className="capitalize">{gear.slot}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Needs</span>
          <Stamp tone={hasRep ? TIER_TONE[requiredTier.label] ?? 'ink' : 'red'} tilt={false} className="text-xs">
            {requiredTier.label}
          </Stamp>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <BrassPlate className={cn('px-2 py-1 font-playbill text-sm leading-none tabular-nums', !canAfford && 'opacity-70')} title={canAfford ? `Costs ${gear.price} gold` : `Costs ${gear.price} gold; you have ${gold}`}>
          {gear.price} gold
        </BrassPlate>
        <PaperButton
          size="sm"
          variant="brass"
          disabled={!canBuy}
          onClick={() => purchaseFactionGear(factionId, gear.id)}
          title={!hasRep ? `Need ${requiredTier.label} standing` : !canAfford ? `Need ${gear.price} gold` : `Buy ${gear.name}`}
        >
          Buy
        </PaperButton>
      </div>
    </li>
  )
}

function FactionCard({ factionId, character }: { factionId: FactionId; character: FantasyCharacter }) {
  const [expanded, setExpanded] = useState(false)
  const faction = FACTIONS[factionId]
  const rep = (character.factionReputations ?? {})[factionId] ?? 0
  const tier = getFactionRepTier(rep)

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <span aria-hidden className="w-7 shrink-0 text-center font-body text-xl leading-none">{faction.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{faction.name}</span>
            <Stamp tone={TIER_TONE[tier.label] ?? 'ink'} tilt={false} className="shrink-0 text-xs">{tier.label}</Stamp>
          </span>
          <span className="mt-1.5 block">
            <RepBar rep={rep} label={`Standing with ${faction.name}`} />
          </span>
        </span>
        <ChevronIcon className={cn('shrink-0 text-ps-ink transition-transform motion-reduce:transition-none', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className="mb-2 ml-3 border-l-2 border-ps-ink-faint pl-3">
          <p className="font-body text-sm italic leading-snug text-ps-ink-soft">{faction.description}</p>
          <PlaybillCaption className="mt-2">Their wares</PlaybillCaption>
          <ul className="mt-1 divide-y divide-ps-playbill-edge">
            {faction.gear.map(gear => (
              <GearItemRow
                key={gear.id}
                gear={gear}
                rep={rep}
                gold={character.gold}
                factionId={factionId}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

export function FactionPanel({ character }: FactionPanelProps) {
  const factionReps = character.factionReputations ?? {}
  const activeFactionCount = FACTION_IDS.filter(id => (factionReps[id] ?? 0) > 0).length

  return (
    <section aria-label="Factions" className="space-y-3">
      <PlaybillTitle size="sm">Factions</PlaybillTitle>
      <div className="flex items-center justify-between gap-3">
        <PlaybillCaption>{activeFactionCount > 0 ? `Standing with ${activeFactionCount} of ${FACTION_IDS.length}` : 'No standing yet'}</PlaybillCaption>
        <BrassPlate className="shrink-0">
          <BrassFigure label="Gold" value={character.gold.toLocaleString()} />
        </BrassPlate>
      </div>
      <ul className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge">
        {FACTION_IDS.map(id => (
          <FactionCard key={id} factionId={id} character={character} />
        ))}
      </ul>
    </section>
  )
}

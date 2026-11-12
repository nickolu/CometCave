'use client'

/**
 * Past runs, kept as a ruled ledger: who they were, how far they walked, what
 * level they reached and how it ended. A row opens to the rest of the figures.
 */
import { useState } from 'react'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { ChevronIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

const REASON_CONFIG: Record<string, { label: string; tone: StampTone }> = {
  dead: { label: 'Slain', tone: 'red' },
  retired: { label: 'Retired', tone: 'gold' },
}

function RunRow({ character }: { character: FantasyCharacter }) {
  const [expanded, setExpanded] = useState(false)
  const reason = REASON_CONFIG[character.status] ?? REASON_CONFIG.dead
  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const regionsVisited = (character.visitedRegions ?? []).length

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{character.name}</span>
            <span className="shrink-0 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">{character.class}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-3 font-body text-xs text-ps-ink-soft">
            <span className="tabular-nums"><span className="font-playbill text-ps-ink">{(character.distance ?? 0).toLocaleString()}</span> km</span>
            <span className="tabular-nums">Lv <span className="font-playbill text-ps-ink">{character.level}</span></span>
            <span className="tabular-nums"><span className="font-playbill text-ps-ink">{(character.gold ?? 0).toLocaleString()}</span> gold</span>
            <span className="tabular-nums"><span className="font-playbill text-ps-ink">{regionsVisited}</span> region{regionsVisited !== 1 ? 's' : ''}</span>
          </span>
        </span>
        <Stamp tone={reason.tone} className="shrink-0">{reason.label}</Stamp>
        <ChevronIcon className={cn('shrink-0 text-ps-ink transition-transform motion-reduce:transition-none', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <dl className="mb-2 ml-3 divide-y divide-ps-playbill-edge border-l-2 border-ps-ink-faint pl-3 font-body text-sm">
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-ps-ink-soft">Last country</dt>
            <dd className="text-right text-ps-ink">{region.icon} {region.name}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-ps-ink-soft">Figures</dt>
            <dd className="text-right tabular-nums text-ps-ink">
              STR {character.strength} · INT {character.intelligence} · LCK {character.luck} · CHA {character.charisma}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-ps-ink-soft">Deaths</dt>
            <dd className="text-right tabular-nums text-ps-ink">{character.deathCount ?? 0}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-ps-ink-soft">Difficulty</dt>
            <dd className="text-right capitalize text-ps-ink">{character.difficultyMode ?? 'normal'}</dd>
          </div>
          {character.equipment?.weapon && (
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-ps-ink-soft">Weapon</dt>
              <dd className="ml-2 truncate text-right text-ps-ink">{character.equipment.weapon.name}</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  )
}

export function RunHistoryPanel() {
  const { gameState } = useGameStore()
  const [statusFilter, setStatusFilter] = useState<'all' | 'dead' | 'retired'>('all')
  const [sortBy, setSortBy] = useState<'level' | 'distance' | 'gold'>('level')

  const pastRuns = (gameState.characters ?? [])
    .filter(c => c.status === 'dead' || c.status === 'retired')
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'distance') return (b.distance ?? 0) - (a.distance ?? 0)
      if (sortBy === 'gold') return (b.gold ?? 0) - (a.gold ?? 0)
      return (b.level ?? 0) - (a.level ?? 0)
    })

  return (
    <section aria-label="Past runs" className="space-y-3">
      <PlaybillTitle size="sm">Past runs</PlaybillTitle>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Show">
          {([['all', 'All'], ['dead', 'Slain'], ['retired', 'Retired']] as const).map(([val, label]) => (
            <PaperButton key={val} size="sm" variant={statusFilter === val ? 'ink' : 'outline'} aria-pressed={statusFilter === val} onClick={() => setStatusFilter(val)}>
              {label}
            </PaperButton>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Sort">
          <PlaybillCaption className="mr-1">Sort</PlaybillCaption>
          {([['level', 'Level'], ['distance', 'Distance'], ['gold', 'Gold']] as const).map(([val, label]) => (
            <PaperButton key={val} size="sm" variant={sortBy === val ? 'ink' : 'outline'} aria-pressed={sortBy === val} onClick={() => setSortBy(val)}>
              {label}
            </PaperButton>
          ))}
        </div>
      </div>

      <PlaybillCaption>{pastRuns.length} run{pastRuns.length !== 1 ? 's' : ''}</PlaybillCaption>

      {pastRuns.length === 0 ? (
        <p className="py-3 font-body text-sm italic text-ps-ink-soft">
          No finished runs yet. Fallen and retired adventurers are entered here.
        </p>
      ) : (
        <ol className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge">
          {pastRuns.map(char => <RunRow key={char.id} character={char} />)}
        </ol>
      )}
    </section>
  )
}

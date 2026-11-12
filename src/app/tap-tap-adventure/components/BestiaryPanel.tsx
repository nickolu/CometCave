'use client'

/**
 * The bestiary: every beast met so far, each on a small ruled card with its
 * figures set in the playbill's wood type and its weaknesses stamped on.
 */
import { useState } from 'react'

import { getElementalMultiplier } from '@/app/tap-tap-adventure/config/elements'
import { BestiaryEntry } from '@/app/tap-tap-adventure/models/bestiary'
import { SpellElement } from '@/app/tap-tap-adventure/models/spell'
import { SearchIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

const ELEMENTS: SpellElement[] = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane']

/** The printer's ink for each element's stamp. */
const ELEMENT_TONE: Record<string, StampTone> = {
  fire: 'red',
  ice: 'blue',
  lightning: 'gold',
  shadow: 'ink',
  nature: 'green',
  arcane: 'violet',
  none: 'ink',
}

function elementTone(element?: string): StampTone {
  if (!element) return ELEMENT_TONE['none']
  return ELEMENT_TONE[element] ?? ELEMENT_TONE['none']
}

function getWeaknessResistance(enemyElement?: string): { weak: SpellElement[]; resists: SpellElement[] } {
  if (!enemyElement || enemyElement === 'none') return { weak: [], resists: [] }
  const allElements: SpellElement[] = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane']
  const weak: SpellElement[] = []
  const resists: SpellElement[] = []
  for (const atk of allElements) {
    const mult = getElementalMultiplier(atk, enemyElement as SpellElement)
    if (mult >= 2.0) weak.push(atk)
    else if (mult <= 0.5) resists.push(atk)
  }
  return { weak, resists }
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">{label}</span>
      <span className="font-playbill text-sm tabular-nums text-ps-ink">{value}</span>
    </span>
  )
}

export function BestiaryPanel({ bestiary }: { bestiary: BestiaryEntry[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [elementFilter, setElementFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'level' | 'defeated'>('level')

  const count = bestiary.length

  // Filter and sort
  const filteredBestiary = bestiary
    .filter(entry => {
      if (searchQuery && !entry.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (elementFilter && entry.element !== elementFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'level') return b.level - a.level
      if (sortBy === 'defeated') return b.timesDefeated - a.timesDefeated
      return 0
    })

  // Group entries by region
  const byRegion = new Map<string, BestiaryEntry[]>()
  for (const entry of filteredBestiary) {
    const existing = byRegion.get(entry.region)
    if (existing) {
      existing.push(entry)
    } else {
      byRegion.set(entry.region, [entry])
    }
  }

  const regionKeys = Array.from(byRegion.keys())

  return (
    <section aria-label="Bestiary" className="space-y-3">
      <PlaybillTitle size="sm">Bestiary</PlaybillTitle>
      <div className="flex items-center justify-between gap-2">
        <PlaybillCaption>
          {filteredBestiary.length !== bestiary.length ? `${filteredBestiary.length} of ${count} shown` : `${count} met`}
        </PlaybillCaption>
      </div>

      {count > 0 && (
        <>
          <label className="relative block">
            <span className="sr-only">Search beasts</span>
            <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ps-ink-soft" />
            <input
              type="search"
              placeholder="Search beasts"
              aria-label="Search enemies"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-[3px] border-2 border-ps-ink bg-transparent pl-8 pr-2 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            />
          </label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by element">
            <PaperButton size="sm" variant={!elementFilter ? 'ink' : 'outline'} aria-pressed={!elementFilter} onClick={() => setElementFilter(null)}>
              All
            </PaperButton>
            {ELEMENTS.map(el => (
              <PaperButton
                key={el}
                size="sm"
                variant={elementFilter === el ? 'ink' : 'outline'}
                aria-pressed={elementFilter === el}
                onClick={() => setElementFilter(elementFilter === el ? null : el)}
              >
                {el}
              </PaperButton>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Sort">
            <PlaybillCaption className="mr-1">Sort</PlaybillCaption>
            {(['level', 'name', 'defeated'] as const).map(opt => (
              <PaperButton key={opt} size="sm" variant={sortBy === opt ? 'ink' : 'outline'} aria-pressed={sortBy === opt} onClick={() => setSortBy(opt)}>
                {opt}
              </PaperButton>
            ))}
          </div>
        </>
      )}

      {filteredBestiary.length === 0 && count > 0 && (
        <p className="py-3 font-body text-sm italic text-ps-ink-soft">Nothing matches.</p>
      )}
      {count === 0 && (
        <p className="py-3 font-body text-sm italic text-ps-ink-soft">Nothing met yet. Every beast you fight is drawn here.</p>
      )}

      {regionKeys.map(region => {
        const entries = byRegion.get(region)!
        const regionLabel = region
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())

        return (
          <div key={region}>
            <PlaybillCaption className="mb-1.5">{regionLabel}</PlaybillCaption>
            <ul className="space-y-2">
              {entries.map(entry => {
                const { weak, resists } = getWeaknessResistance(entry.element)
                return (
                  <li key={entry.name} className="rounded-[3px] border-2 border-ps-ink p-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{entry.name}</span>
                      {entry.isBoss && <Stamp tone="gold">Boss</Stamp>}
                      {entry.element && <Stamp tone={elementTone(entry.element)} tilt={false}>{entry.element}</Stamp>}
                      <span className="ml-auto font-playbill text-sm tabular-nums text-ps-ink">
                        <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Lv </span>
                        {entry.level}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-ps-playbill-edge pt-1.5">
                      <Figure label="HP" value={entry.maxHp} />
                      <Figure label="Atk" value={entry.attack} />
                      <Figure label="Def" value={entry.defense} />
                      <span className="ml-auto inline-flex items-baseline gap-1" title={`Defeated ${entry.timesDefeated} time${entry.timesDefeated !== 1 ? 's' : ''}`}>
                        <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Slain</span>
                        <span className="font-playbill text-sm tabular-nums text-ps-ink">{entry.timesDefeated}×</span>
                      </span>
                    </div>
                    {(weak.length > 0 || resists.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {weak.length > 0 && (
                          <span className="flex flex-wrap items-center gap-1">
                            <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Weak to</span>
                            {weak.map(e => (
                              <Stamp key={e} tone="green" tilt={false} className="text-xs" title={`${e} deals 2x`}>{e}</Stamp>
                            ))}
                          </span>
                        )}
                        {resists.length > 0 && (
                          <span className="flex flex-wrap items-center gap-1">
                            <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">Resists</span>
                            {resists.map(e => (
                              <Stamp key={e} tone="red" tilt={false} className="text-xs" title={`${e} deals 0.5x`}>{e}</Stamp>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {(entry.specialAbility || entry.statusAbility) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {entry.specialAbility && (
                          <Stamp tone="violet" tilt={false} className="text-xs" title={entry.specialAbility.description}>
                            {entry.specialAbility.name}
                          </Stamp>
                        )}
                        {entry.statusAbility && (
                          <Stamp tone="red" tilt={false} className="text-xs">{entry.statusAbility.type}</Stamp>
                        )}
                      </div>
                    )}
                    <p className="mt-1.5 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-faint">
                      First met {new Date(entry.firstEncountered).toLocaleDateString()}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

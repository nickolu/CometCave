'use client'

/**
 * The story so far, hung in the wing as a stack of small bills, newest first.
 * Filters and search survive from the old feed; the rendering is the bill.
 */
import { useEffect, useRef, useState } from 'react'

import type { FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'
import { cn } from '@/lib/utils'

import { SearchIcon } from './icons'
import { Stamp, deltaTone } from './Playbill'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'combat', label: 'Fights' },
  { value: 'decision', label: 'Choices' },
] as const

export function StoryLog({ events, filterCharacterId, className }: { events: FantasyStoryEvent[]; filterCharacterId?: string; className?: string }) {
  const listRef = useRef<HTMLOListElement>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const filtered = events.filter(e => {
    if (filterCharacterId && e.characterId !== filterCharacterId) return false
    if (filter === 'combat' && !e.type.startsWith('combat') && e.type !== 'boss_guardian_victory') return false
    if (filter === 'decision' && e.type !== 'decision_result') return false
    if (query && !e.outcomeDescription?.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })
  const newestId = filtered.length ? filtered[filtered.length - 1].id : null

  useEffect(() => {
    if (!newestId) return
    const raf = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      setHighlighted(newestId)
    })
    const t = setTimeout(() => setHighlighted(null), 5000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [newestId])

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <h2 className="font-playbill text-sm uppercase tracking-widest text-ps-brass-light">The story so far</h2>
      <div className="flex flex-wrap items-center gap-1">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              'rounded-[2px] border px-1.5 py-0.5 font-label text-xs font-bold uppercase tracking-widest transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary',
              filter === f.value ? 'border-ps-brass bg-ps-brass text-ps-ink' : 'border-ps-brass-deep text-ps-brass-light hover:bg-ps-lacquer-deep'
            )}
          >
            {f.label}
          </button>
        ))}
        <label className="relative ml-auto min-w-[96px] flex-1">
          <span className="sr-only">Search the story</span>
          <SearchIcon size={12} className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-ps-brass-light/70" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            className="h-6 w-full rounded-[2px] border border-ps-brass-deep bg-ps-house/60 pl-5 pr-1.5 font-body text-xs text-ps-playbill placeholder:text-ps-brass-light/60 focus:border-ps-brass focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="ps-paper-flat rounded-[2px] border border-ps-ink px-3 py-2 font-body text-xs italic text-ps-ink-soft">
          {events.length ? 'Nothing matches.' : 'Nothing has happened yet. The first bill prints when you set out.'}
        </p>
      ) : (
        <ol ref={listRef} className="ps-scroll flex max-h-[360px] min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 md:max-h-none" aria-label="Past scenes">
          {[...filtered].reverse().map(ev => {
            const rewards = [...(ev.resourceDelta?.rewardItems ?? []), ...(ev.rewardItems ?? [])]
            const gold = ev.resourceDelta?.gold ?? 0
            const rep = ev.resourceDelta?.reputation ?? 0
            const isNew = highlighted === ev.id
            return (
              <li
                key={`${ev.id}-${ev.timestamp}`}
                className={cn(
                  'ps-paper-flat rounded-[2px] border border-ps-ink px-2.5 py-2 transition-[outline-color] duration-500',
                  isNew ? 'outline outline-2 outline-offset-1 outline-ps-brass' : 'outline outline-2 outline-offset-1 outline-transparent'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label text-xs font-bold uppercase tracking-widest text-ps-ink-faint">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {ev.type.startsWith('combat') && <Stamp tone="red" tilt={false} className="text-xs">Fight</Stamp>}
                  {ev.type === 'decision_result' && <Stamp tone="blue" tilt={false} className="text-xs">Choice</Stamp>}
                </div>
                {ev.decisionPoint && (
                  <p className="mt-1 font-body text-xs font-semibold leading-snug text-ps-ink">
                    {ev.decisionPoint.prompt}
                    {ev.selectedOptionText && <span className="block font-normal italic text-ps-ink-soft">You chose: {ev.selectedOptionText}</span>}
                  </p>
                )}
                {ev.outcomeDescription && <p className="mt-1 font-body text-xs leading-snug text-ps-ink">{ev.outcomeDescription}</p>}
                {(gold !== 0 || rep !== 0 || rewards.length > 0 || ev.resourceDelta?.statusChange) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {gold !== 0 && <Stamp tone={deltaTone(gold)} tilt={false} className="text-xs">{gold > 0 ? '+' : ''}{gold} gold</Stamp>}
                    {rep !== 0 && <Stamp tone={deltaTone(rep)} tilt={false} className="text-xs">{rep > 0 ? '+' : ''}{rep} repute</Stamp>}
                    {rewards.map((item, i) => (
                      <Stamp key={item.id + i} tone="violet" tilt={false} className="text-xs">
                        {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
                      </Stamp>
                    ))}
                    {ev.resourceDelta?.statusChange && <Stamp tone="ink" tilt={false} className="text-xs">{ev.resourceDelta.statusChange}</Stamp>}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

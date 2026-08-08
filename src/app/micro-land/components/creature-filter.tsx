'use client'

import { useId, useState } from 'react'

import { MOVE_WORDS } from '@/app/micro-land/domain/blueprint'
import {
  type CreatureFilter,
  type DietKind,
  DIET_LABELS,
  EMPTY_FILTER,
  type FilterOptions,
  SIZE_BANDS,
  type SizeBandId,
  activeConditionCount,
  describeFilter,
  isFilterActive,
} from '@/app/micro-land/domain/creature-filter'
import type { LocomotionKind } from '@/app/micro-land/domain/types'

const label: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 9,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  opacity: 0.5,
  paddingLeft: 2,
}

/** Chips match the group tabs directly below them — same pill, same selected look. */
function chipStyle(selected: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--cc-font-mono)',
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: selected ? 700 : 400,
    padding: '5px 9px',
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: selected ? 'var(--cc-mint)' : 'var(--cc-mint-line)',
    background: selected ? 'var(--cc-mint-soft)' : 'transparent',
    color: selected ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
    whiteSpace: 'nowrap',
  }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

/**
 * The roster filter, sitting between the creature actions and the group tabs.
 *
 * Collapsed by default, and that is the whole design argument: this row is above
 * the one control the player touches most, and eleven chips permanently parked
 * there would push the creatures themselves off a phone screen. Collapsed it
 * costs a single button.
 *
 * The catch with collapsing anything is a filter that is quietly on while the
 * panel below it looks broken, so an active filter never hides: the button goes
 * mint and carries a count, the conditions are spelled out beside it, and Clear
 * is one tap away without expanding anything.
 */
export function CreatureFilterBar({
  filter,
  setFilter,
  options,
}: {
  filter: CreatureFilter
  setFilter: (filter: CreatureFilter) => void
  options: FilterOptions
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const active = isFilterActive(filter)
  const count = activeConditionCount(filter)

  // A world can be narrow enough that there is nothing to ask about — one
  // species of plant on an empty map has no second way of moving and no size to
  // contrast with. Offering a filter there is a control that cannot do anything.
  const anythingToAsk =
    options.moves.length > 1 || options.sizes.length > 1 || options.diet.length > 1 || options.glows || options.lavaProof
  if (!anythingToAsk && !active) return null

  const setMoves = (kind: LocomotionKind) =>
    setFilter({ ...filter, moves: toggle(filter.moves, kind) })
  const setSizes = (band: SizeBandId) => setFilter({ ...filter, sizes: toggle(filter.sizes, band) })
  const setDiets = (kind: DietKind) => setFilter({ ...filter, diet: toggle(filter.diet, kind) })

  return (
    <div className="-mx-1 flex flex-col gap-1.5 px-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="cc-btn shrink-0"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          // Only while the panel exists — `aria-controls` pointing at an id
          // that isn't in the document is a dead reference for a screen reader.
          aria-controls={open ? panelId : undefined}
          title="Narrow the creatures down by how they move, how big they are, and what they can take"
          style={chipStyle(active)}
        >
          <span aria-hidden style={{ marginRight: 5, opacity: 0.7 }}>
            {open ? '▾' : '▸'}
          </span>
          Filter
          {active && <span style={{ opacity: 0.65, marginLeft: 5 }}>{count}</span>}
        </button>

        {active && (
          <>
            {/* Spelled out rather than left to the badge: the count says how
                many conditions are on, never which, and "why is Hunters empty"
                is a question only the words can answer. */}
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1,
                color: 'var(--cc-mint)',
                opacity: 0.8,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {describeFilter(filter)}
            </span>
            <button
              type="button"
              className="cc-btn ml-auto shrink-0"
              onClick={() => setFilter(EMPTY_FILTER)}
              style={chipStyle(false)}
            >
              Clear
            </button>
          </>
        )}
      </div>

      {open && (
        <div id={panelId} className="flex flex-col gap-1.5 pb-0.5">
          {options.moves.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="How it moves"
            >
              <span style={{ ...label, width: 44 }}>Moves</span>
              {options.moves.map(kind => (
                <button
                  key={kind}
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={() => setMoves(kind)}
                  aria-pressed={filter.moves.includes(kind)}
                  style={chipStyle(filter.moves.includes(kind))}
                >
                  {MOVE_WORDS[kind]}
                </button>
              ))}
            </div>
          )}

          {options.diet.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="What it eats"
            >
              <span style={{ ...label, width: 44 }}>Diet</span>
              {options.diet.map(kind => (
                <button
                  key={kind}
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={() => setDiets(kind)}
                  aria-pressed={filter.diet.includes(kind)}
                  style={chipStyle(filter.diet.includes(kind))}
                >
                  {DIET_LABELS[kind]}
                </button>
              ))}
            </div>
          )}

          {options.sizes.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="How big it is"
            >
              <span style={{ ...label, width: 44 }}>Size</span>
              {SIZE_BANDS.filter(b => options.sizes.includes(b.id)).map(band => (
                <button
                  key={band.id}
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={() => setSizes(band.id)}
                  aria-pressed={filter.sizes.includes(band.id)}
                  title={`Size ${band.min}–${band.max}`}
                  style={chipStyle(filter.sizes.includes(band.id))}
                >
                  {band.label}
                </button>
              ))}
            </div>
          )}

          {(options.glows || options.lavaProof) && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="What it can take"
            >
              <span style={{ ...label, width: 44 }}>Also</span>
              {options.glows && (
                <button
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={() => setFilter({ ...filter, glows: !filter.glows })}
                  aria-pressed={filter.glows}
                  style={chipStyle(filter.glows)}
                >
                  {/* Marks that carry meaning are paired with the word, never
                      standing in for it — the symbol alone reaches neither a
                      screen reader nor a five-year-old. */}
                  <span aria-hidden style={{ marginRight: 5 }}>
                    ✦
                  </span>
                  Glows in the dark
                </button>
              )}
              {options.lavaProof && (
                <button
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={() => setFilter({ ...filter, lavaProof: !filter.lavaProof })}
                  aria-pressed={filter.lavaProof}
                  style={chipStyle(filter.lavaProof)}
                >
                  <span aria-hidden style={{ marginRight: 5 }}>
                    ◈
                  </span>
                  Lava-proof
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

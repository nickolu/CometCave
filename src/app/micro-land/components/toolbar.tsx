'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  CREATURE_GROUPS,
  type CreatureGroup,
  creatureGroup,
} from '@/app/micro-land/domain/blueprint'
import { MATERIALS, PAINTABLE, TINTS, tintedId } from '@/app/micro-land/domain/config/materials'
import type { MaterialId, TintableMaterialId } from '@/app/micro-land/domain/types'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'
import { SparkleIcon } from './sparkle-icon'
import { SummonSand } from './summon-sand'

const BRUSHES = [2, 4, 8, 14]

/**
 * Which tintable family, if any, the current material belongs to.
 *
 * Covers both the plain material ('crystal') and one of its colors
 * ('crystal-blue'), so picking a color keeps the color strip open on the
 * family you're painting with instead of collapsing it out from under you.
 */
function tintFamily(id: MaterialId): TintableMaterialId | null {
  const material = MATERIALS[id]
  if (!material) return null
  if (material.tintable) return id as TintableMaterialId
  return material.tintOf
}

const label: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 9,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  opacity: 0.5,
  paddingLeft: 2,
}

export function Toolbar({ onRemoveSpecies }: { onRemoveSpecies: (blueprintId: string) => void }) {
  const tool = useMicroLand(s => s.tool)
  const setTool = useMicroLand(s => s.setTool)
  const brush = useMicroLand(s => s.brush)
  const setBrush = useMicroLand(s => s.setBrush)
  const blueprints = useMicroLand(s => s.blueprints)
  const pending = useMicroLand(s => s.pendingSummons)
  const setSummonOpen = useMicroLand(s => s.setSummonOpen)
  const setBuilderOpen = useMicroLand(s => s.setBuilderOpen)

  const paintingSelected = tool.kind === 'material' || tool.kind === 'erase'
  const family = tool.kind === 'material' ? tintFamily(tool.material) : null

  // One flat scrolling row stopped working somewhere around fifteen creatures
  // and there are more than thirty now. Grouped and wrapped instead: you see a
  // whole category at once rather than swiping past everything you don't want.
  const grouped = useMemo(() => {
    const out = new Map<CreatureGroup, typeof blueprints>()
    for (const bp of blueprints) {
      const key = creatureGroup(bp, blueprints)
      const list = out.get(key)
      if (list) list.push(bp)
      else out.set(key, [bp])
    }
    for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }, [blueprints])

  // A summon still in flight is enough to stand "Yours" up on its own. The
  // waiting slot lives in that tab and nowhere else, so filtering the tab out
  // while it was empty hid the loading state on the one summon that most needs
  // it — the very first, when there is nothing else in "Yours" to keep it open.
  const tabs = CREATURE_GROUPS.filter(
    g => (grouped.get(g.id)?.length ?? 0) > 0 || (g.id === 'yours' && pending.length > 0)
  )
  const [group, setGroup] = useState<CreatureGroup>('plants')
  /**
   * Tidy mode: while it is on, tapping a creature in "Yours" removes it.
   *
   * A mode rather than a permanent ✕ on every chip. This row is what a thumb
   * reaches for constantly during play, and a delete control living there full
   * time would be hit by accident — expensive, since a drawn creature can be
   * half an hour of somebody's afternoon. It also keeps the chip a single
   * button: a ✕ nested inside the chip button would be invalid HTML and a tap
   * target far too small for the hands this is built for.
   */
  const [tidying, setTidying] = useState(false)

  // Jump to "Yours" the moment a summon is asked for, and again when it lands,
  // so the thing you just invented — and the slot holding its place until then —
  // is under your thumb instead of behind a tab you have to go and find.
  const summonedCount = blueprints.filter(bp => bp.summoned).length
  const pendingCount = pending.length
  const lastSummoned = useRef(summonedCount)
  const lastPending = useRef(pendingCount)
  useEffect(() => {
    if (summonedCount > lastSummoned.current || pendingCount > lastPending.current) {
      setGroup('yours')
      // Arriving here because something new was made must never arrive armed.
      setTidying(false)
    }
    lastSummoned.current = summonedCount
    lastPending.current = pendingCount
  }, [summonedCount, pendingCount])

  // Whatever tab is showing has to exist — "Yours" disappears on a fresh world.
  const active = tabs.some(t => t.id === group) ? group : (tabs[0]?.id ?? 'plants')
  const shown = grouped.get(active) ?? []

  /**
   * Tidying is only ever a thing in "Yours".
   *
   * Derived rather than cleaned up in an effect, so the armed state can never
   * outlive the conditions for it even for one render: switching tab, emptying
   * the drawer, or a summon landing all disarm it on the spot. It is also reset
   * on the way out of the tab, so coming back later never finds a row that
   * silently deletes on tap.
   */
  const canTidy = active === 'yours' && shown.length > 0
  const tidyOn = tidying && canTidy

  return (
    <footer
      className="flex flex-col gap-1.5 px-3 pb-3 pt-2"
      style={{
        borderTop: '1px solid var(--cc-panel-divider)',
        background: 'linear-gradient(0deg, var(--cc-panel-grad-from), transparent)',
      }}
    >
      {/* --- ground --- */}
      <div className="flex items-center gap-2">
        <span style={label}>Ground</span>
        <div className="flex items-center gap-1">
          {BRUSHES.map(size => (
            <button
              key={size}
              type="button"
              className="cc-btn"
              onClick={() => setBrush(size)}
              aria-label={`Brush size ${size}`}
              aria-pressed={brush === size}
              style={{
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 4,
                border: `1px solid ${brush === size ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
                background: brush === size ? 'var(--cc-mint-soft)' : 'transparent',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: Math.min(14, 3 + size),
                  height: Math.min(14, 3 + size),
                  borderRadius: '50%',
                  background: brush === size ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          className="cc-btn shrink-0"
          onClick={() => setTool({ kind: 'erase' })}
          aria-pressed={tool.kind === 'erase'}
          style={swatchStyle(tool.kind === 'erase')}
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 3,
              border: '1px dashed var(--cc-text-muted)',
            }}
          />
          <span style={swatchLabel}>Erase</span>
        </button>

        {PAINTABLE.map(id => {
          // A tintable swatch shows whichever color of itself is in hand, so
          // the palette reflects what the brush will actually paint.
          const inHand = family === id && tool.kind === 'material' ? tool.material : id
          const material = MATERIALS[inHand]
          const selected = tool.kind === 'material' && (tool.material === id || family === id)
          return (
            <button
              key={id}
              type="button"
              className="cc-btn shrink-0"
              onClick={() => setTool({ kind: 'material', material: inHand })}
              aria-pressed={selected}
              style={swatchStyle(selected)}
            >
              <span
                aria-hidden
                style={{
                  position: 'relative',
                  display: 'block',
                  width: 22,
                  height: 22,
                  borderRadius: 3,
                  background: material.color,
                  boxShadow:
                    material.glow > 0
                      ? `0 0 10px ${material.color}`
                      : 'inset 0 0 0 1px rgba(0,0,0,0.35)',
                }}
              >
                {MATERIALS[id].tintable && (
                  // A corner notch marks the ones that come in colors.
                  <span
                    style={{
                      position: 'absolute',
                      right: 1,
                      bottom: 1,
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderBottom: '6px solid rgba(255,255,255,0.75)',
                    }}
                  />
                )}
              </span>
              <span style={swatchLabel}>{MATERIALS[id].name}</span>
            </button>
          )
        })}
      </div>

      {family && (
        <div
          className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label={`${MATERIALS[family].name} colour`}
        >
          <span style={{ ...label, paddingLeft: 4 }}>Colour</span>
          {[
            { id: family as MaterialId, name: MATERIALS[family].name },
            ...TINTS.map(t => ({
              id: tintedId(family, t.id),
              name: t.name,
            })),
          ].map(({ id, name }) => {
            const selected = tool.kind === 'material' && tool.material === id
            return (
              <button
                key={id}
                type="button"
                className="cc-btn shrink-0"
                onClick={() => setTool({ kind: 'material', material: id })}
                aria-pressed={selected}
                aria-label={name}
                title={name}
                style={{
                  width: 30,
                  height: 30,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 999,
                  border: `2px solid ${selected ? 'var(--cc-mint)' : 'transparent'}`,
                  background: 'transparent',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: MATERIALS[id].color,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
                  }}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* --- creatures --- */}
      {/* Wraps: Generate, Draw and Inspect together overflow a 360px phone. */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={label}>Creatures</span>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setSummonOpen(true)}
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            fontWeight: 700,
            padding: '6px 14px',
            minHeight: 32,
            borderRadius: 4,
            background: 'linear-gradient(180deg, var(--cc-mint), var(--cc-mint-hi))',
            border: '1px solid var(--cc-mint)',
            color: 'var(--cc-on-mint)',
            boxShadow: 'var(--cc-mint-glow)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <SparkleIcon size={12} />
          Generate
        </button>
        {/* Secondary to Generate on purpose: one primary-action colour per
            screen, and drawing is the slower, more deliberate of the two. */}
        <button
          type="button"
          className="cc-btn"
          onClick={() => setBuilderOpen(true)}
          title="Colour in a creature yourself, square by square"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            padding: '6px 12px',
            minHeight: 32,
            borderRadius: 4,
            border: '1px solid var(--cc-mint-line)',
            background: 'transparent',
            color: 'var(--cc-text-muted)',
          }}
        >
          ✎ Draw
        </button>
        <button
          type="button"
          className="cc-btn"
          onClick={() =>
            setTool(
              tool.kind === 'inspect' ? { kind: 'material', material: 'dirt' } : { kind: 'inspect' }
            )
          }
          aria-pressed={tool.kind === 'inspect'}
          title="Tap a creature to see how it is doing"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            padding: '6px 12px',
            minHeight: 32,
            borderRadius: 4,
            border: `1px solid ${tool.kind === 'inspect' ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
            background: tool.kind === 'inspect' ? 'var(--cc-mint-soft)' : 'transparent',
            color: tool.kind === 'inspect' ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
          }}
        >
          ⌕ Inspect
        </button>
        <span
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            opacity: 0.45,
            letterSpacing: 1,
          }}
          className="hidden sm:inline"
        >
          {tool.kind === 'inspect'
            ? 'tap a creature to watch it'
            : paintingSelected
              ? 'drag a creature to throw it'
              : 'tap to place · drag a creature to throw it'}
        </span>
      </div>

      {/* The tidy toggle sits beside the tabs but outside the tablist — it is
          not a tab, and a stray child in there confuses assistive tech. */}
      <div className="-mx-1 flex items-center gap-1 px-1">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Creature kinds">
          {tabs.map(tab => {
            const selected = tab.id === active
            // Ones on their way count too, so the number moves the instant you ask
            // rather than staying at zero for the length of a generation.
            const count =
              (grouped.get(tab.id)?.length ?? 0) + (tab.id === 'yours' ? pending.length : 0)
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className="cc-btn shrink-0"
                aria-selected={selected}
                onClick={() => {
                  setGroup(tab.id)
                  setTidying(false)
                }}
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 9,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  fontWeight: selected ? 700 : 400,
                  padding: '5px 9px',
                  minHeight: 28,
                  borderRadius: 999,
                  border: `1px solid ${
                    selected
                      ? 'var(--cc-mint)'
                      : tab.id === 'yours'
                        ? 'var(--cc-pink-border)'
                        : 'var(--cc-mint-line)'
                  }`,
                  background: selected ? 'var(--cc-mint-soft)' : 'transparent',
                  color: selected
                    ? 'var(--cc-mint)'
                    : tab.id === 'yours'
                      ? 'var(--cc-pink)'
                      : 'var(--cc-text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span style={{ opacity: 0.55, marginLeft: 5 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {canTidy && (
          <button
            type="button"
            className="cc-btn ml-auto shrink-0"
            onClick={() => setTidying(v => !v)}
            aria-pressed={tidyOn}
            title={
              tidyOn
                ? 'Done tidying — tapping a creature places it again'
                : 'Tidy up — tap a creature to remove it'
            }
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              padding: '5px 9px',
              minHeight: 28,
              borderRadius: 999,
              border: `1px solid ${tidyOn ? 'var(--cc-pink)' : 'var(--cc-mint-line)'}`,
              background: tidyOn ? 'var(--cc-pink-soft, rgba(255,122,184,0.14))' : 'transparent',
              color: tidyOn ? 'var(--cc-pink)' : 'var(--cc-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {tidyOn ? 'Done' : 'Tidy'}
          </button>
        )}
      </div>

      {/* Wrapped, not a scrolling row — a whole group is visible at once. The
          cap only bites on "Yours" after a long session of summoning. */}
      <div
        role="tabpanel"
        className="-mx-1 flex flex-wrap gap-1.5 overflow-y-auto px-1 pb-1"
        style={{ maxHeight: '24vh' }}
      >
        {/* Creatures still on their way hold their place at the front of the
            strip, right where the finished one lands.

            Keyed off `active`, not `group`: the two diverge whenever the
            remembered tab doesn't exist, and testing the remembered one put the
            waiting slots under whichever group the fallback had landed on. */}
        {active === 'yours' &&
          pending.map(p => (
            <div
              key={p.id}
              className="shrink-0"
              title={`Making “${p.prompt}”`}
              aria-label={`Making ${p.prompt}`}
              style={{
                ...swatchStyle(false),
                minWidth: 62,
                borderStyle: 'dashed',
                borderColor: 'var(--cc-pink-border)',
              }}
            >
              <span style={{ height: 34, display: 'grid', placeItems: 'center' }}>
                <SummonSand size={34} />
              </span>
              <span style={{ ...swatchLabel, color: 'var(--cc-pink)' }}>Making…</span>
            </div>
          ))}
        {shown.map(bp => {
          const selected = tool.kind === 'creature' && tool.blueprintId === bp.id
          // Built-ins can't be removed even while tidying — they come from
          // config, so deleting one would just bring it back on reload.
          const removable = tidyOn && bp.summoned
          return (
            <button
              key={bp.id}
              type="button"
              className="cc-btn shrink-0"
              onClick={() =>
                removable
                  ? onRemoveSpecies(bp.id)
                  : setTool({ kind: 'creature', blueprintId: bp.id })
              }
              aria-pressed={removable ? undefined : selected}
              aria-label={removable ? `Remove ${bp.name}` : undefined}
              title={removable ? `Remove ${bp.name}` : bp.blurb}
              style={{
                ...swatchStyle(selected && !tidyOn),
                minWidth: 62,
                position: 'relative',
                borderColor: removable
                  ? 'var(--cc-pink)'
                  : selected && !tidyOn
                    ? 'var(--cc-mint)'
                    : bp.summoned
                      ? 'var(--cc-pink-border)'
                      : 'var(--cc-mint-line)',
                // A built-in during tidy mode is inert; say so rather than
                // letting it look tappable and do nothing.
                opacity: tidyOn && !bp.summoned ? 0.35 : 1,
              }}
            >
              <span
                style={{
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CreaturePortrait blueprint={bp} size={34} />
              </span>
              <span style={swatchLabel}>{bp.name}</span>
              {removable && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 999,
                    fontSize: 11,
                    lineHeight: 1,
                    background: 'var(--cc-pink)',
                    color: 'var(--cc-on-pink, #1b1b26)',
                    boxShadow: '0 0 0 2px rgba(2,8,10,0.85)',
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          )
        })}
      </div>
    </footer>
  )
}

function swatchStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    minWidth: 54,
    minHeight: 44,
    borderRadius: 5,
    border: `1px solid ${selected ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
    background: selected ? 'var(--cc-mint-soft)' : 'rgba(255,255,255,0.02)',
  }
}

const swatchLabel: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 8,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  opacity: 0.75,
}

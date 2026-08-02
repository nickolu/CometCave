'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  CREATURE_GROUPS,
  type CreatureGroup,
  creatureGroup,
} from '@/app/micro-land/domain/blueprint'
import {
  MATERIALS,
  PAINTABLE,
  TINTS,
  tintedId,
} from '@/app/micro-land/domain/config/materials'
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

export function Toolbar() {
  const tool = useMicroLand((s) => s.tool)
  const setTool = useMicroLand((s) => s.setTool)
  const brush = useMicroLand((s) => s.brush)
  const setBrush = useMicroLand((s) => s.setBrush)
  const blueprints = useMicroLand((s) => s.blueprints)
  const pending = useMicroLand((s) => s.pendingSummons)
  const setSummonOpen = useMicroLand((s) => s.setSummonOpen)

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

  const tabs = CREATURE_GROUPS.filter((g) => (grouped.get(g.id)?.length ?? 0) > 0)
  const [group, setGroup] = useState<CreatureGroup>('plants')

  // Jump to "Yours" the moment a summon lands, so the thing you just invented
  // is under your thumb instead of behind a tab you have to go and find.
  const summonedCount = blueprints.filter((bp) => bp.summoned).length
  const lastSummoned = useRef(summonedCount)
  useEffect(() => {
    if (summonedCount > lastSummoned.current) setGroup('yours')
    lastSummoned.current = summonedCount
  }, [summonedCount])

  // Whatever tab is showing has to exist — "Yours" disappears on a fresh world.
  const active = tabs.some((t) => t.id === group) ? group : (tabs[0]?.id ?? 'plants')
  const shown = grouped.get(active) ?? []

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
          {BRUSHES.map((size) => (
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

        {PAINTABLE.map((id) => {
          // A tintable swatch shows whichever color of itself is in hand, so
          // the palette reflects what the brush will actually paint.
          const inHand =
            family === id && tool.kind === 'material' ? tool.material : id
          const material = MATERIALS[inHand]
          const selected =
            tool.kind === 'material' && (tool.material === id || family === id)
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
                    material.glow > 0 ? `0 0 10px ${material.color}` : 'inset 0 0 0 1px rgba(0,0,0,0.35)',
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
            ...TINTS.map((t) => ({
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
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          className="cc-btn"
          onClick={() =>
            setTool(tool.kind === 'inspect' ? { kind: 'material', material: 'dirt' } : { kind: 'inspect' })
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

{/* Creatures still on their way hold their place at the front of the
            strip, right where the finished one lands. */}
        
      <div
        className="-mx-1 flex gap-1 overflow-x-auto px-1"
        role="tablist"
        aria-label="Creature kinds"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active
          const count = grouped.get(tab.id)?.length ?? 0
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="cc-btn shrink-0"
              aria-selected={selected}
              onClick={() => setGroup(tab.id)}
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

      {/* Wrapped, not a scrolling row — a whole group is visible at once. The
          cap only bites on "Yours" after a long session of summoning. */}
      <div
        role="tabpanel"
        className="-mx-1 flex flex-wrap gap-1.5 overflow-y-auto px-1 pb-1"
        style={{ maxHeight: '24vh' }}
      >
        { group === 'yours' && pending.map((p) => (
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
        {shown.map((bp) => {
          const selected = tool.kind === 'creature' && tool.blueprintId === bp.id
          return (
            <button
              key={bp.id}
              type="button"
              className="cc-btn shrink-0"
              onClick={() => setTool({ kind: 'creature', blueprintId: bp.id })}
              aria-pressed={selected}
              title={bp.blurb}
              style={{
                ...swatchStyle(selected),
                minWidth: 62,
                borderColor: selected
                  ? 'var(--cc-mint)'
                  : bp.summoned
                    ? 'var(--cc-pink-border)'
                    : 'var(--cc-mint-line)',
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

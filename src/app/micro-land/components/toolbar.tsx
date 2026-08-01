'use client'

import { MATERIALS, PAINTABLE } from '@/app/micro-land/domain/config/materials'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'

const BRUSHES = [2, 4, 8, 14]

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
  const setSummonOpen = useMicroLand((s) => s.setSummonOpen)

  const paintingSelected = tool.kind === 'material' || tool.kind === 'erase'

  // Summoned creatures first — you just made them, you want to place them.
  const ordered = [...blueprints].sort((a, b) => {
    if (!!a.summoned === !!b.summoned) return a.name.localeCompare(b.name)
    return a.summoned ? -1 : 1
  })

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
          const material = MATERIALS[id]
          const selected = tool.kind === 'material' && tool.material === id
          return (
            <button
              key={id}
              type="button"
              className="cc-btn shrink-0"
              onClick={() => setTool({ kind: 'material', material: id })}
              aria-pressed={selected}
              style={swatchStyle(selected)}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 3,
                  background: material.color,
                  boxShadow:
                    material.glow > 0 ? `0 0 10px ${material.color}` : 'inset 0 0 0 1px rgba(0,0,0,0.35)',
                }}
              />
              <span style={swatchLabel}>{material.name}</span>
            </button>
          )
        })}
      </div>

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
          }}
        >
          ✦ Summon
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

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ordered.map((bp) => {
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

'use client'

import { useEffect, useState } from 'react'

import { type HistoryEntry, type HistoryEventKind } from '@/app/micro-land/domain/types'
import { useMicroLand } from '@/app/micro-land/store'

/** Picks the first opaque color from a blueprint's art palette. */
function firstPaletteColor(palette: Record<string, string>): string {
  const vals = Object.values(palette)
  return vals.length > 0 ? vals[0] : '#888888'
}

function formatSimTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

type FilterKey = 'died' | 'born' | 'ate' | 'named' | 'plant' | 'sick'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'died', label: 'Deaths' },
  { key: 'born', label: 'Births' },
  { key: 'ate', label: 'Predation' },
  { key: 'named', label: 'Named' },
  { key: 'plant', label: 'Plant growth' },
  { key: 'sick', label: 'Disease' },
]

const DEFAULT_ACTIVE: Record<FilterKey, boolean> = {
  died: true,
  born: true,
  ate: true,
  named: true,
  plant: false,
  sick: true,
}

const btnBase: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  padding: '5px 9px',
  minHeight: 28,
  borderRadius: 4,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--cc-mint-line)',
  background: 'transparent',
  color: 'var(--cc-text-muted)',
  cursor: 'pointer',
}

const btnActive: React.CSSProperties = {
  background: 'var(--cc-mint-soft)',
  borderColor: 'var(--cc-mint)',
  color: 'var(--cc-mint)',
}

function kindToFilter(kind: HistoryEventKind): FilterKey {
  if (kind === 'died') return 'died'
  if (kind === 'born') return 'born'
  if (kind === 'ate') return 'ate'
  if (kind === 'named') return 'named'
  if (kind === 'plant') return 'plant'
  return 'sick'
}

export function HistoryPanel() {
  const open = useMicroLand(s => s.historyOpen)
  const setOpen = useMicroLand(s => s.setHistoryOpen)
  const historyLog = useMicroLand(s => s.historyLog)
  const blueprints = useMicroLand(s => s.blueprints)

  const [active, setActive] = useState<Record<FilterKey, boolean>>(DEFAULT_ACTIVE)

  // Build a lookup from blueprintId to blueprint for fast access.
  const bpMap: Record<string, (typeof blueprints)[number]> = {}
  for (const bp of blueprints) bpMap[bp.id] = bp

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const filtered = historyLog.filter(e => active[kindToFilter(e.kind)])

  function toggleFilter(key: FilterKey) {
    setActive(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div
      role="dialog"
      aria-label="Event Log"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[72dvh] flex-col rounded-t-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[400px] sm:max-h-none sm:rounded-none"
      style={{
        background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
        borderTop: '1px solid var(--cc-modal-border)',
        borderLeft: '1px solid var(--cc-modal-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-3"
        style={{
          borderBottom: '1px solid var(--cc-panel-divider)',
          background: 'var(--cc-modal-bg-from)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            color: 'var(--cc-mint)',
          }}
        >
          Event Log
        </h2>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setOpen(false)}
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            padding: '6px 10px',
            minHeight: 32,
            borderRadius: 4,
            border: '1px solid var(--cc-mint-line)',
            color: 'var(--cc-text-muted)',
          }}
          aria-label="Close event log"
        >
          Close
        </button>
      </div>

      {/* Filter toggles */}
      <div
        className="flex shrink-0 flex-wrap gap-1.5 px-4 py-2"
        style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
      >
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            className="cc-btn"
            onClick={() => toggleFilter(f.key)}
            style={{ ...btnBase, ...(active[f.key] ? btnActive : {}) }}
            aria-pressed={active[f.key]}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {historyLog.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: 'var(--cc-text-muted)',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            Nothing has happened yet.
          </p>
        ) : filtered.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: 'var(--cc-text-muted)',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            No events match the current filters.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(entry => (
              <HistoryEntryRow key={entry.id} entry={entry} bpMap={bpMap} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function HistoryEntryRow({
  entry,
  bpMap,
}: {
  entry: HistoryEntry
  bpMap: Record<string, { art: { palette: Record<string, string> } }>
}) {
  const bp = bpMap[entry.blueprintId]
  const color = bp ? firstPaletteColor(bp.art.palette) : '#888888'
  const isNamed = entry.kind === 'named'

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: isNamed ? 'var(--cc-gold)' : 'var(--cc-text-default)',
        borderLeft: isNamed ? '2px solid var(--cc-gold)' : '2px solid transparent',
        paddingLeft: isNamed ? 6 : 0,
      }}
    >
      {/* Species color dot */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {/* Detail text */}
      <span style={{ flex: 1, lineHeight: 1.4 }}>{entry.detail}</span>
      {/* Sim time */}
      <span
        style={{
          flexShrink: 0,
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 10,
          color: 'var(--cc-text-muted)',
          letterSpacing: 0.5,
        }}
      >
        {formatSimTime(entry.simTime)}
      </span>
    </li>
  )
}

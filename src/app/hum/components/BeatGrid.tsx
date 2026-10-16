'use client'

import { useEffect, useRef, useState } from 'react'

import { BPM_MAX, BPM_MIN, LANES, OFF, type Row, STEPS, laneFreq } from '@/app/hum/lib/beat'
import { noteName } from '@/app/hum/lib/patch'
import type { Hum } from '@/app/hum/useHum'
import { ChunkyButton } from '@/components/ui/chunky-button'

/* One bar, sixteen steps (docs/hum-design.md §4). Drums are on/off. A sound
   row shows each note as a bar whose height is its place in the scale, and
   opening the row's notes shows the full piano roll for it.

   The section collapses to its header. Play stays in the header, so a beat
   can keep looping while it's folded away. */

export function BeatGrid({ hum }: { hum: Hum }) {
  const { beat, step } = hum
  const [openRow, setOpenRow] = useState<string | null>(null)
  const open = beat.rows.find(r => r.id === openRow && !r.drum) ?? null

  return (
    <section aria-labelledby="hum-beat-title" className="hum-panel hum-beat">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hum-beat-title" className="font-headline text-lg font-extrabold text-on-surface">
          <button
            type="button"
            className="hum-collapse"
            aria-expanded={hum.beatOpen}
            aria-controls="hum-beat-body"
            onClick={() => hum.setBeatOpen(!hum.beatOpen)}
          >
            <span className="hum-collapse-mark" aria-hidden="true">
              ▸
            </span>
            Beat
          </button>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {hum.beatOpen && (
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Tempo
              <input
                type="range"
                min={BPM_MIN}
                max={BPM_MAX}
                value={beat.bpm}
                onChange={e => hum.setBpm(Number(e.target.value))}
                className="hum-range"
                aria-valuetext={`${beat.bpm} beats per minute`}
              />
              <span className="w-14 tabular-nums text-on-surface">{beat.bpm} BPM</span>
            </label>
          )}
          {hum.beatOpen &&
            (hum.canUndoClear ? (
              <button type="button" className="hum-pill" onClick={hum.undoClear}>
                Undo clear
              </button>
            ) : (
              <button
                type="button"
                className="hum-pill"
                disabled={hum.beatIsEmpty}
                onClick={hum.clearBeat}
              >
                Clear all
              </button>
            ))}
          <ChunkyButton size="sm" onClick={hum.toggleBeat} aria-pressed={hum.beatOn}>
            {hum.beatOn ? 'Stop beat' : 'Play beat'}
          </ChunkyButton>
        </div>
      </div>

      {hum.beatOpen && (
        <div id="hum-beat-body" className="flex flex-col gap-3">
          <div className="hum-grid-scroll">
            <div className="hum-grid">
              {beat.rows.map(row => (
                <GridRow
                  key={row.id}
                  row={row}
                  hum={hum}
                  step={step}
                  open={open?.id === row.id}
                  onOpen={() => setOpenRow(open?.id === row.id ? null : row.id)}
                />
              ))}
            </div>
          </div>

          {open && <PianoRoll row={open} hum={hum} step={step} />}
        </div>
      )}
    </section>
  )
}

function GridRow({
  row,
  hum,
  step,
  open,
  onOpen,
}: {
  row: Row
  hum: Hum
  step: number
  open: boolean
  onOpen: () => void
}) {
  const editing = hum.target === row.id
  const [lastLane, setLastLane] = useState(0)

  return (
    <div role="group" aria-label={`${row.name} steps`} className="hum-grid-row">
      <div className="hum-row-head">
        {row.drum ? (
          <span className="hum-row-name">{row.name}</span>
        ) : (
          <RowName row={row} hum={hum} />
        )}
        <span className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`hum-mini${editing ? ' hum-mini-on' : ''}`}
            aria-pressed={editing}
            aria-label={`Edit the ${row.name} sound on the knobs`}
            onClick={() => hum.setTarget(editing ? 'sound' : row.id)}
          >
            Knobs
          </button>
          {!row.drum && (
            <>
              <button
                type="button"
                className={`hum-mini${open ? ' hum-mini-on' : ''}`}
                aria-expanded={open}
                aria-label={`${open ? 'Hide' : 'Show'} the notes for ${row.name}`}
                onClick={onOpen}
              >
                Notes
              </button>
              <button
                type="button"
                className="hum-mini"
                aria-label={`Remove ${row.name} from the beat`}
                onClick={() => hum.removeRow(row.id)}
              >
                ×
              </button>
            </>
          )}
        </span>
      </div>
      {row.steps.map((lane, i) => {
        const on = lane !== OFF
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            aria-label={`${row.name}, step ${i + 1}${on && !row.drum ? `, ${noteName(laneFreq(row.patch.pitch, lane))}` : ''}`}
            className={`hum-cell${on ? ' hum-cell-on' : ''}${i === step ? ' hum-cell-now' : ''}${i % 4 === 0 ? ' hum-cell-beat' : ''}`}
            onClick={() => {
              if (on) {
                if (!row.drum) setLastLane(lane)
                hum.setCell(row.id, i, OFF)
              } else {
                hum.setCell(row.id, i, row.drum ? 0 : lastLane)
              }
            }}
          >
            {on && !row.drum && (
              <span
                className="hum-cell-bar"
                style={{ height: `${30 + (lane / (LANES - 1)) * 65}%` }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

function PianoRoll({ row, hum, step }: { row: Row; hum: Hum; step: number }) {
  const lanes = Array.from({ length: LANES }, (_, i) => LANES - 1 - i)
  return (
    <div className="hum-grid-scroll">
      <p className="mb-2 text-xs text-on-surface-variant">
        Notes for <strong className="text-on-surface">{row.name}</strong>. Every note is in the same
        scale, so any pattern fits with the others. One note per step: tap a square to place it, or
        tap it again to remove it.
      </p>
      <div className="hum-grid">
        {lanes.map(lane => {
          const name = noteName(laneFreq(row.patch.pitch, lane))
          return (
            <div
              role="group"
              aria-label={`${name} notes`}
              key={lane}
              className="hum-grid-row hum-roll-row"
            >
              <div className="hum-row-head hum-roll-head" aria-hidden="true">
                {name}
              </div>
              {Array.from({ length: STEPS }, (_, i) => {
                const on = row.steps[i] === lane
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Step ${i + 1}, ${name}`}
                    className={`hum-cell hum-roll-cell${on ? ' hum-cell-on' : ''}${i === step ? ' hum-cell-now' : ''}${i % 4 === 0 ? ' hum-cell-beat' : ''}`}
                    onClick={() => hum.setCell(row.id, i, on ? OFF : lane)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A sound row's name: tap to rename. A row that was just added opens
 *  straight into editing, since naming it is the obvious next step. */
function RowName({ row, hum }: { row: Row; hum: Hum }) {
  const [editing, setEditing] = useState(hum.newRowId === row.id)
  const [draft, setDraft] = useState(row.name)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  if (!editing) {
    return (
      <button
        type="button"
        className="hum-row-name hum-row-rename"
        aria-label={`${row.name}. Rename this sound`}
        onClick={() => {
          setDraft(row.name)
          setEditing(true)
        }}
      >
        {row.name}
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          edit
        </span>
      </button>
    )
  }

  const done = (save: boolean) => {
    if (save) hum.renameRow(row.id, draft)
    setEditing(false)
  }

  return (
    <input
      ref={input}
      className="hum-row-input"
      value={draft}
      maxLength={24}
      aria-label="Sound name"
      onChange={e => setDraft(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={e => {
        if (e.key === 'Enter') done(true)
        if (e.key === 'Escape') done(false)
      }}
    />
  )
}

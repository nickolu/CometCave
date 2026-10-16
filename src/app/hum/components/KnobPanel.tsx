'use client'

import { MAX_SOUND_ROWS } from '@/app/hum/lib/beat'
import { GROUP_LABEL, KNOBS, type KnobGroup, type KnobId } from '@/app/hum/lib/lessons'
import { LFO_TARGETS, type NumericKey, WAVES, readout } from '@/app/hum/lib/patch'
import { LIBRARY_MAX } from '@/app/hum/lib/storage'
import type { Hum } from '@/app/hum/useHum'

import { Choice, Knob, WaveIcon } from './Knob'

/* The knobs are split into two columns, one on each side of the scope, so
   the full set of 19 never stacks into one tall column. What the knobs are
   editing, and what to do with the sound, sits under the scope (SoundBar). */

export const LEFT_GROUPS: KnobGroup[] = ['tone', 'filter']
export const RIGHT_GROUPS: KnobGroup[] = ['envelope', 'wobble', 'effects']

const ORDER = Object.keys(KNOBS) as KnobId[]

const WAVE_LABEL = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  sawtooth: 'Saw',
} as const
const TARGET_LABEL = { pitch: 'Pitch', volume: 'Volume', filter: 'Filter' } as const

export function KnobColumn({ hum, groups }: { hum: Hum; groups: KnobGroup[] }) {
  const { patch, unlocked, fresh, setKnob, beat } = hum
  const shown = groups
    .map(group => ({
      group,
      ids: ORDER.filter(id => KNOBS[id].group === group && unlocked.has(id)),
    }))
    .filter(g => g.ids.length)
  if (!shown.length) return null

  return (
    <div className="hum-knob-column">
      {shown.map(({ group, ids }) => (
        <fieldset key={group} className={`hum-group hum-g-${group}`}>
          <legend className="hum-group-label">{GROUP_LABEL[group]}</legend>
          <div className="hum-group-knobs">
            {ids.map(id => {
              if (id === 'wave') {
                return (
                  <Choice
                    key={id}
                    label={KNOBS.wave.label}
                    group={group}
                    value={patch.wave}
                    isNew={fresh.has(id)}
                    options={WAVES.map(w => ({
                      value: w,
                      label: WAVE_LABEL[w],
                      icon: <WaveIcon wave={w} />,
                    }))}
                    onChange={v => setKnob('wave', v)}
                    onTouch={() => hum.touch('wave')}
                  />
                )
              }
              if (id === 'lfoTarget') {
                return (
                  <Choice
                    key={id}
                    label={KNOBS.lfoTarget.label}
                    group={group}
                    value={patch.lfoTarget}
                    isNew={fresh.has(id)}
                    options={LFO_TARGETS.map(t => ({ value: t, label: TARGET_LABEL[t] }))}
                    onChange={v => setKnob('lfoTarget', v)}
                    onTouch={() => hum.touch('lfoTarget')}
                  />
                )
              }
              const key = id as NumericKey
              return (
                <Knob
                  key={id}
                  id={key}
                  patch={patch}
                  readout={readout(key, patch, beat.bpm)}
                  isNew={fresh.has(id)}
                  onChange={v => setKnob(key, v)}
                  onTouch={() => hum.touch(key)}
                />
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export function SoundBar({ hum }: { hum: Hum }) {
  const { patch, touched, targetRow } = hum
  const editingLabel = targetRow ? targetRow.name : hum.lesson ? 'Lesson sound' : 'Your sound'

  return (
    <section aria-labelledby="hum-knobs-title" className="hum-soundbar">
      {/* The teaching on touch: whatever knob you last reached for, in one line. */}
      <p className="hum-hint" aria-live="polite">
        {touched ? (
          <>
            <strong className="text-on-surface">{KNOBS[touched].label}:</strong>{' '}
            {KNOBS[touched].hint}
          </>
        ) : (
          'Touch a knob to see what it does.'
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <h2 id="hum-knobs-title" className="text-sm font-semibold text-on-surface">
          The knobs are editing: <span className="text-ds-primary">{editingLabel}</span>
        </h2>
        {targetRow && (
          <button type="button" className="hum-link" onClick={() => hum.setTarget('sound')}>
            Back to {hum.lesson ? 'lesson sound' : 'your sound'}
          </button>
        )}
      </div>

      {hum.gridUnlocked && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!targetRow && (
            <button
              type="button"
              className="hum-pill"
              disabled={!hum.canAddRow}
              onClick={() => hum.addToBeat(patch)}
            >
              {hum.canAddRow
                ? 'Put this sound in the beat'
                : `The beat is full (${MAX_SOUND_ROWS} sounds)`}
            </button>
          )}
          {!hum.visiting && (
            <button
              type="button"
              className="hum-pill"
              disabled={hum.state.library.length >= LIBRARY_MAX}
              onClick={hum.saveSound}
            >
              Save this sound
            </button>
          )}
        </div>
      )}

      {!hum.visiting && hum.state.library.length > 0 && (
        <div>
          <h3 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Saved sounds ({hum.state.library.length}/{LIBRARY_MAX})
          </h3>
          <ul className="flex flex-wrap justify-center gap-2">
            {hum.state.library.map(s => (
              <li key={s.id} className="hum-saved">
                <button
                  type="button"
                  className="hum-saved-load"
                  onClick={() => hum.loadSound(s.patch)}
                  aria-label={`Load ${s.name} onto the knobs`}
                >
                  {s.name}
                </button>
                {hum.canAddRow && (
                  <button
                    type="button"
                    className="hum-saved-act"
                    onClick={() => hum.addToBeat(s.patch, s.name)}
                    aria-label={`Put ${s.name} in the beat`}
                  >
                    +
                  </button>
                )}
                <button
                  type="button"
                  className="hum-saved-act"
                  onClick={() => hum.deleteSound(s.id)}
                  aria-label={`Delete ${s.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

'use client'

import { useEffect } from 'react'

import {
  KNOBS,
  KNOB_GROUPS,
  type Knob,
  TUNING_DEFAULTS,
  type TuningKey,
} from '@/app/micro-land/domain/tuning'
import { useMicroLand } from '@/app/micro-land/store'

const heading: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'var(--cc-text-muted)',
}

const knobLabel: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--cc-text-default)',
}

const knobValue: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 11,
  color: 'var(--cc-mint)',
  whiteSpace: 'nowrap',
}

/** Fractions read as fractions; everything else is a whole number of things. */
function show(knob: Knob, value: number): string {
  const text = knob.step < 1 ? value.toFixed(2) : String(Math.round(value))
  return knob.unit ? `${text}${knob.unit === 's' ? 's' : ` ${knob.unit}`}` : text
}

function ViewScaleButtons() {
  const viewScale = useMicroLand(s => s.viewScale)
  const setViewScale = useMicroLand(s => s.setViewScale)
  const options: Array<{ key: 'wide' | 'standard' | 'close'; label: string }> = [
    { key: 'wide', label: 'Wide' },
    { key: 'standard', label: 'Standard' },
    { key: 'close', label: 'Close' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className="cc-btn"
          onClick={() => setViewScale(key)}
          aria-pressed={viewScale === key}
          style={{
            flex: 1,
            padding: '6px 4px',
            minHeight: 32,
            borderRadius: 6,
            border: `1px solid ${viewScale === key ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
            background: viewScale === key ? 'rgba(100,220,180,0.12)' : 'transparent',
            color: viewScale === key ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase' as const,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * The knobs, out of the way.
 *
 * A drawer down the side rather than a modal over the middle, and with no scrim
 * behind it, because the whole reason to open it is to watch the world while you
 * drag. A dialog that dims what you are trying to look at would make every
 * setting a guess followed by a close-and-check.
 *
 * Every change lands on the next tick — there is no Apply. Ecosystem numbers are
 * not the kind of thing anyone can pick correctly in the abstract; you find the
 * right one by moving it until the meadow looks the way you meant.
 */
export function SettingsPanel() {
  const open = useMicroLand(s => s.settingsOpen)
  const setOpen = useMicroLand(s => s.setSettingsOpen)
  const tuning = useMicroLand(s => s.tuning)
  const setKnob = useMicroLand(s => s.setTuningKnob)
  const reset = useMicroLand(s => s.resetTuningKnobs)
  const notify = useMicroLand(s => s.notify)

  async function copySettings() {
    const text = JSON.stringify(tuning, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      notify('Settings copied to clipboard')
    } catch {
      notify('Could not copy — check clipboard permissions')
    }
  }

  async function pasteSettings() {
    try {
      const text = await navigator.clipboard.readText()
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        notify('Clipboard does not contain valid settings')
        return
      }
      const keys = Object.keys(TUNING_DEFAULTS) as TuningKey[]
      let applied = 0
      for (const key of keys) {
        const value = (parsed as Record<string, unknown>)[key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          setKnob(key, value)
          applied++
        }
      }
      if (applied > 0) {
        notify(`Applied ${applied} setting${applied === 1 ? '' : 's'} from clipboard`)
      } else {
        notify('No valid settings found in clipboard')
      }
    } catch {
      notify('Could not read clipboard')
    }
  }

  // Escape closes, wherever focus happens to be — the panel deliberately does
  // not take focus away from the world, so it can't rely on catching the key
  // itself.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const changed = (Object.keys(TUNING_DEFAULTS) as TuningKey[]).filter(
    key => tuning[key] !== TUNING_DEFAULTS[key]
  ).length

  return (
    <div
      role="dialog"
      aria-label="World settings"
      // Bottom sheet on a phone, drawer down the right on anything wider. The
      // height cap has to come off on desktop or `inset-y-0` would pin a
      // three-quarter-height panel to the top edge and leave a gap under it.
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[72dvh] flex-col rounded-t-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[350px] sm:max-h-none sm:rounded-none"
      style={{
        background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
        borderTop: '1px solid var(--cc-modal-border)',
        borderLeft: '1px solid var(--cc-modal-border)',
      }}
    >
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
          Laws of the land
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cc-btn"
            onClick={copySettings}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              padding: '6px 8px',
              minHeight: 32,
              borderRadius: 4,
              border: '1px solid var(--cc-mint-line)',
              color: 'var(--cc-text-muted)',
            }}
            title="Copy all settings to clipboard as JSON"
          >
            Copy
          </button>
          <button
            type="button"
            className="cc-btn"
            onClick={pasteSettings}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              padding: '6px 8px',
              minHeight: 32,
              borderRadius: 4,
              border: '1px solid var(--cc-mint-line)',
              color: 'var(--cc-text-muted)',
            }}
            title="Paste settings from clipboard"
          >
            Paste
          </button>
          <button
            type="button"
            className="cc-btn"
            onClick={reset}
            disabled={changed === 0}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              padding: '6px 8px',
              minHeight: 32,
              borderRadius: 4,
              border: '1px solid var(--cc-mint-line)',
              color: changed === 0 ? 'var(--cc-text-muted)' : 'var(--cc-gold)',
              opacity: changed === 0 ? 0.4 : 1,
            }}
            title="Put every setting back to the way the game shipped"
          >
            Reset{changed > 0 ? ` (${changed})` : ''}
          </button>
          <button
            type="button"
            className="cc-btn"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
            style={{ minWidth: 40, minHeight: 32, color: 'var(--cc-text-muted)' }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p
          className="px-4 pt-3"
          style={{ fontSize: 12, color: 'var(--cc-text-muted)', lineHeight: 1.5 }}
        >
          Everything here changes the world while you watch. Nothing is saved into your records, and
          the land itself is left alone.
        </p>

        {KNOB_GROUPS.map(group => (
          <section
            key={group.id}
            className="px-4 py-3"
            style={{ borderTop: '1px solid var(--cc-panel-divider)', marginTop: 12 }}
          >
            <h3 style={heading}>{group.title}</h3>
            <p
              className="pb-1 pt-1"
              style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.8, lineHeight: 1.5 }}
            >
              {group.blurb}
            </p>

            <div className="flex flex-col gap-4 pt-2">
              {KNOBS.filter(knob => knob.group === group.id).map(knob => (
                <KnobRow
                  key={knob.key}
                  knob={knob}
                  value={tuning[knob.key]}
                  onChange={value => setKnob(knob.key, value)}
                />
              ))}
            </div>
          </section>
        ))}

        <section
          className="px-4 py-3"
          style={{ borderTop: '1px solid var(--cc-panel-divider)', marginTop: 12 }}
        >
          <h3 style={heading}>Canvas view</h3>
          <p
            className="pb-2 pt-1"
            style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.8, lineHeight: 1.5 }}
          >
            How much of the world is visible at once. Wide shows the whole land; Close shows fine
            detail.
          </p>
          <ViewScaleButtons />
        </section>

        <div className="h-4" />
      </div>
    </div>
  )
}

function KnobRow({
  knob,
  value,
  onChange,
}: {
  knob: Knob
  value: number
  onChange: (value: number) => void
}) {
  const id = `micro-land-knob-${knob.key}`
  const isDefault = value === TUNING_DEFAULTS[knob.key]

  if (knob.type === 'toggle') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} style={{ ...knobLabel, cursor: 'pointer' }}>
            {knob.label}
          </label>
          <input
            id={id}
            type="checkbox"
            checked={value === 1}
            onChange={e => onChange(e.target.checked ? 1 : 0)}
            style={{ accentColor: isDefault ? 'var(--cc-mint)' : 'var(--cc-gold)', width: 18, height: 18, cursor: 'pointer' }}
            aria-describedby={`${id}-help`}
          />
        </div>
        <p
          id={`${id}-help`}
          style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.75, lineHeight: 1.45 }}
        >
          {knob.help}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} style={knobLabel}>
          {knob.label}
        </label>
        <span style={knobValue}>
          {show(knob, value)}
          {!isDefault && (
            // The shipped value stays on screen next to the changed one, so
            // "how far have I pushed this" never needs a reset to answer.
            <span style={{ color: 'var(--cc-text-muted)', opacity: 0.6 }}>
              {' / '}
              {show(knob, TUNING_DEFAULTS[knob.key])}
            </span>
          )}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={knob.min}
        max={knob.max}
        step={knob.step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: isDefault ? 'var(--cc-mint)' : 'var(--cc-gold)', minHeight: 24 }}
        aria-describedby={`${id}-help`}
      />
      <p
        id={`${id}-help`}
        style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.75, lineHeight: 1.45 }}
      >
        {knob.help}
      </p>
    </div>
  )
}

'use client'

import {
  KNOBS,
  KNOB_GROUPS,
  type Knob,
  TUNING_DEFAULTS,
  type TuningKey,
} from '@/app/micro-land/domain/tuning'
import type { CreatureBlueprint, WorldGeneratorEntry } from '@/app/micro-land/domain/types'
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

/**
 * The knobs, out of the way.
 *
 * A column down the side rather than a dialog over the middle, and with no scrim
 * behind it, because the whole reason to open it is to watch the world while you
 * drag. Anything that dims what you are trying to look at would make every
 * setting a guess followed by a close-and-check.
 *
 * Every change lands on the next tick — there is no Apply. Ecosystem numbers are
 * not the kind of thing anyone can pick correctly in the abstract; you find the
 * right one by moving it until the meadow looks the way you meant.
 */
export function SettingsPane() {
  const tuning = useMicroLand(s => s.tuning)
  const setKnob = useMicroLand(s => s.setTuningKnob)
  const reset = useMicroLand(s => s.resetTuningKnobs)
  const notify = useMicroLand(s => s.notify)
  const generators = useMicroLand(s => s.generators)
  const blueprints = useMicroLand(s => s.blueprints)
  const updateGenerator = useMicroLand(s => s.updateGenerator)

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

  const changed = (Object.keys(TUNING_DEFAULTS) as TuningKey[]).filter(
    key => tuning[key] !== TUNING_DEFAULTS[key]
  ).length

  const toolButton: React.CSSProperties = {
    fontFamily: 'var(--cc-font-mono)',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    padding: '6px 10px',
    minHeight: 32,
    borderRadius: 4,
    border: '1px solid var(--cc-mint-line)',
    color: 'var(--cc-text-muted)',
  }

  return (
    <>
      {/* Copy, paste and reset act on every knob at once, so they sit above all
          of them rather than beside any one of them. */}
      <div
        className="flex flex-wrap items-center gap-1 px-4 py-2"
        style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
      >
        <button
          type="button"
          className="cc-btn"
          onClick={copySettings}
          style={toolButton}
          title="Copy all settings to clipboard as JSON"
        >
          Copy
        </button>
        <button
          type="button"
          className="cc-btn"
          onClick={pasteSettings}
          style={toolButton}
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
            ...toolButton,
            color: changed === 0 ? 'var(--cc-text-muted)' : 'var(--cc-gold)',
            opacity: changed === 0 ? 0.4 : 1,
          }}
          title="Put every setting back to the way the game shipped"
        >
          Reset{changed > 0 ? ` (${changed})` : ''}
        </button>
      </div>

      <div>

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

        {/* ── World rhythms ──────────────────────────────────── */}
        {generators.length > 0 && (
          <section
            className="px-4 py-3"
            style={{ borderTop: '1px solid var(--cc-panel-divider)', marginTop: 12 }}
          >
            <h3 style={heading}>World rhythms</h3>
            <p
              className="pb-1 pt-1"
              style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.8, lineHeight: 1.5 }}
            >
              The cave breathes these species into existence on a quiet timer. Plants are on by default;
              animals wait for you to wake them.
            </p>

            {/* Plants */}
            {(() => {
              const plantGens = generators.filter(g => {
                const bp = blueprints.find(b => b.id === g.blueprintId)
                return bp?.move.kind === 'root'
              })
              if (plantGens.length === 0) return null
              return (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 6, fontFamily: 'var(--cc-font-mono)' }}>Plants</p>
                  <div className="flex flex-col gap-3">
                    {plantGens.map(g => (
                      <GeneratorRow
                        key={g.blueprintId}
                        entry={g}
                        blueprint={blueprints.find(b => b.id === g.blueprintId)}
                        onChange={patch => updateGenerator(g.blueprintId, patch)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Animals */}
            {(() => {
              const animalGens = generators.filter(g => {
                const bp = blueprints.find(b => b.id === g.blueprintId)
                return bp && bp.move.kind !== 'root'
              })
              if (animalGens.length === 0) return null
              return (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 6, fontFamily: 'var(--cc-font-mono)' }}>Animals</p>
                  <div className="flex flex-col gap-3">
                    {animalGens.map(g => (
                      <GeneratorRow
                        key={g.blueprintId}
                        entry={g}
                        blueprint={blueprints.find(b => b.id === g.blueprintId)}
                        onChange={patch => updateGenerator(g.blueprintId, patch)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            <button
              type="button"
              className="cc-btn"
              onClick={() => {
                // Reset all generators to default (plants enabled, animals disabled)
                for (const g of generators) {
                  const bp = blueprints.find(b => b.id === g.blueprintId)
                  const isPlant = bp?.move.kind === 'root'
                  updateGenerator(g.blueprintId, {
                    enabled: isPlant,
                    intervalSeconds: isPlant ? 13 : 30,
                  })
                }
              }}
              style={{
                marginTop: 12,
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
            >
              Reset to defaults
            </button>
          </section>
        )}

        <div className="h-4" />
      </div>
    </>
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

/** Seconds-to-label mapping for the rate picker. */
const RATE_PRESETS = [
  { label: 'Slow', seconds: 60 },
  { label: 'Normal', seconds: 30 },
  { label: 'Fast', seconds: 10 },
  { label: 'Relentless', seconds: 5 },
] as const

function GeneratorRow({
  entry,
  blueprint,
  onChange,
}: {
  entry: WorldGeneratorEntry
  blueprint: CreatureBlueprint | undefined
  onChange: (patch: { enabled?: boolean; intervalSeconds?: number }) => void
}) {
  const name = blueprint?.name ?? entry.blueprintId
  const activePreset = RATE_PRESETS.find(p => p.seconds === entry.intervalSeconds)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        opacity: entry.enabled ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          id={`gen-${entry.blueprintId}`}
          checked={entry.enabled}
          onChange={e => onChange({ enabled: e.target.checked })}
          style={{ accentColor: 'var(--cc-mint)', width: 14, height: 14 }}
        />
        <label
          htmlFor={`gen-${entry.blueprintId}`}
          style={{ fontSize: 12, color: 'var(--cc-text-default)', cursor: 'pointer', flex: 1 }}
        >
          {name}
        </label>
        {entry.enabled && (
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              color: 'var(--cc-text-muted)',
            }}
          >
            {activePreset ? activePreset.label : `${entry.intervalSeconds}s`}
          </span>
        )}
      </div>

      {entry.enabled && (
        <div style={{ display: 'flex', gap: 4, paddingLeft: 22 }}>
          {RATE_PRESETS.map(preset => {
            const active = entry.intervalSeconds === preset.seconds
            return (
              <button
                key={preset.label}
                type="button"
                className="cc-btn"
                onClick={() => onChange({ intervalSeconds: preset.seconds })}
                aria-pressed={active}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: `1px solid ${active ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
                  color: active ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                  background: active ? 'rgba(var(--cc-mint-rgb,80,200,160),0.08)' : 'transparent',
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

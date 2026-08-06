'use client'

import { useState } from 'react'

import { canEat } from '@/app/micro-land/domain/blueprint'
import { notableTraits, traitPhrases } from '@/app/micro-land/domain/traits'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'
import { formatDuration } from '@/app/micro-land/format'
import { type Inspected, useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'

/** Plain-language version of the mood the simulation is actually in. */
const MOOD_TEXT: Record<string, string> = {
  wander: 'Wandering about',
  hunt: 'Looking for food',
  flee: 'Running away!',
  eat: 'Eating',
  rest: 'Resting',
  mate: 'Looking for a partner',
}

/**
 * Rooted things share the same moods internally but can't act on them, so
 * "Wandering about" for a mushroom reads as a bug rather than flavour.
 */
function moodText(mood: string, kind: string): string {
  if (kind === 'root') return 'Growing quietly'
  return MOOD_TEXT[mood] ?? mood
}

const KIND_TEXT: Record<string, string> = {
  walk: 'Walks on the ground',
  fly: 'Flies',
  swim: 'Swims — drowns in air',
  crawl: 'Climbs walls and ceilings',
  drift: 'Floats along',
  root: 'Rooted to the spot',
}

/**
 * Join phrases the way a person would: "quick, sharp-eyed and long-lived".
 *
 * Capitalised at the front because it stands on its own line as a sentence
 * rather than following anything.
 */
function sentence(parts: string[]): string {
  const joined =
    parts.length <= 1
      ? parts.join('')
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

/** A springy walker is a hopper first — it is the thing you notice about it. */
function moveText(bp: CreatureBlueprint): string {
  if (bp.move.kind === 'walk' && bp.move.hop >= 0.25) return 'Hops along the ground'
  return KIND_TEXT[bp.move.kind] ?? bp.move.kind
}

function Meter({
  label,
  value,
  tone,
  right,
}: {
  label: string
  value: number
  tone: string
  right?: string
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span style={meterLabel}>{label}</span>
        <span style={{ ...meterLabel, opacity: 0.55 }}>{right ?? `${pct}%`}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
      </div>
    </div>
  )
}

const meterLabel: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 9,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  opacity: 0.75,
}

/**
 * A creature's life as a handful of plain facts.
 *
 * Returns dot-separated phrases that read left to right from origin to present:
 * "Generation 4 · 3m 14s old · 18 meals · 2 children"
 *
 * Shown for everything — plants just have fewer facts to report.
 */
function biography(c: Inspected, bp: CreatureBlueprint): string {
  const parts: string[] = []

  if (c.generation <= 1) {
    parts.push('First of its line')
  } else {
    parts.push(`Generation ${c.generation}`)
  }

  parts.push(`${formatDuration(c.ageSeconds)} old`)

  if (bp.move.kind !== 'root') {
    if (c.mealsEaten === 0) {
      parts.push('no meals yet')
    } else {
      parts.push(`${c.mealsEaten} ${c.mealsEaten === 1 ? 'meal' : 'meals'}`)
    }
    if (c.children === 1) {
      parts.push('1 child')
    } else if (c.children > 1) {
      parts.push(`${c.children} children`)
    }
  }

  return parts.join(' · ')
}

/**
 * Live read-out for one creature.
 *
 * Everything here comes from the same blueprint the simulation runs on, so a
 * creature summoned a moment ago reports exactly as completely as a built-in —
 * including who eats it, which is derived from `canEat` rather than authored.
 */
export function Inspector({ onName }: { onName: (name: string) => boolean }) {
  const inspected = useMicroLand(s => s.inspected)
  const setInspected = useMicroLand(s => s.setInspected)
  const blueprints = useMicroLand(s => s.blueprints)

  /**
   * The half-typed name, tagged with who it is for.
   *
   * Keyed by creature id rather than reset in an effect: tapping a second
   * creature mid-type has to abandon the name, and deriving that from the id
   * makes it true on the same render instead of one render later.
   */
  const [pending, setPending] = useState<{ id: number; text: string } | null>(null)
  const [lifeOpen, setLifeOpen] = useState(false)

  if (!inspected) return null

  const naming = pending?.id === inspected.id
  const draft = naming ? pending.text : ''

  const bp = blueprints.find(b => b.id === inspected.blueprintId)
  if (!bp) return null

  const eats = blueprints.filter(other => canEat(bp, other))
  const eatenBy = blueprints.filter(other => canEat(other, bp))

  const fullness = 1 - inspected.hunger
  const lifeLeft = Math.max(0, 1 - inspected.ageSeconds / Math.max(1, inspected.lifespanSeconds))

  /**
   * What this one inherited, said twice.
   *
   * The sentence is the point and the numbers are the footnote — a player should
   * be able to learn that their hoppers are getting faster without ever reading
   * a multiplier. Both are empty for anything placed by hand, which is every
   * creature at generation 1, so a fresh world's panel looks exactly as it
   * always did.
   */
  const phrases = traitPhrases(inspected.traits)
  const traits = notableTraits(inspected.traits)

  const trouble =
    inspected.sick > 0
      ? 'Diseased!'
      : inspected.starving > 0
        ? 'Starving!'
        : inspected.distress > 1
          ? inspected.inWater
            ? 'Drowning!'
            : 'Out of water!'
          : null

  return (
    <div
      className="pointer-events-auto absolute right-2 top-2 w-[248px] max-w-[calc(100%-1rem)] overflow-y-auto rounded-lg backdrop-blur-sm"
      style={{
        maxHeight: 'calc(100% - 1rem)',
        background: 'rgba(4, 14, 16, 0.88)',
        border: '1px solid var(--cc-mint-line)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-start gap-2.5 p-3"
        style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
      >
        <CreaturePortrait blueprint={bp} size={38} />
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'var(--cc-mint)',
            }}
          >
            {inspected.name ?? bp.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.4 }}>
            {inspected.name ? bp.name : bp.blurb}
          </div>
        </div>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setInspected(null)}
          aria-label="Stop inspecting"
          style={{ minWidth: 28, minHeight: 28, color: 'var(--cc-text-muted)', fontSize: 12 }}
          onPointerDown={e => e.stopPropagation()}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-3">
        {/*
          The elder band is the only thing in this panel that isn't a fact about
          the creature — it's the game acknowledging one. It appears for exactly
          one creature at a time and nowhere else in the UI.
        */}
        {inspected.isElder && (
          <div
            className="flex flex-col gap-1.5 rounded px-2.5 py-2"
            style={{
              background: 'rgba(252, 211, 77, 0.08)',
              border: '1px solid rgba(252, 211, 77, 0.35)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'var(--cc-gold)',
              }}
            >
              ✦ Oldest this land remembers
            </div>

            {inspected.name ? null : naming ? (
              <form
                className="flex gap-1.5"
                onSubmit={e => {
                  e.preventDefault()
                  if (onName(draft)) setPending(null)
                }}
              >
                <label className="sr-only" htmlFor="micro-land-elder-name">
                  Name this creature
                </label>
                <input
                  id="micro-land-elder-name"
                  autoFocus
                  value={draft}
                  onChange={e => setPending({ id: inspected.id, text: e.target.value })}
                  maxLength={24}
                  placeholder="Call it something"
                  className="min-w-0 flex-1 rounded px-2 py-1"
                  style={{
                    fontSize: 12,
                    color: 'var(--cc-text-default)',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--cc-mint-line)',
                  }}
                  // The canvas grabs creatures on pointerdown; without this,
                  // tapping the field throws whatever is underneath it.
                  onPointerDown={e => e.stopPropagation()}
                />
                <button
                  type="submit"
                  className="cc-btn"
                  disabled={draft.trim().length === 0}
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    color: 'var(--cc-gold)',
                    border: '1px solid rgba(252, 211, 77, 0.35)',
                    opacity: draft.trim().length === 0 ? 0.4 : 1,
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="cc-btn self-start"
                onClick={() => setPending({ id: inspected.id, text: '' })}
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  color: 'var(--cc-gold)',
                  border: '1px solid rgba(252, 211, 77, 0.35)',
                }}
                onPointerDown={e => e.stopPropagation()}
              >
                Add name
              </button>
            )}
          </div>
        )}

        {/*
          Naming for non-elder creatures. The elder gets the gold ceremony above;
          this is a quieter offer for any other creature the player has noticed.
        */}
        {!inspected.isElder && !inspected.name && (
          <div className="flex items-center justify-between gap-2">
            {naming ? (
              <form
                className="flex flex-1 gap-1.5"
                onSubmit={e => {
                  e.preventDefault()
                  if (onName(draft)) setPending(null)
                }}
              >
                <label className="sr-only" htmlFor="micro-land-creature-name">
                  Name this creature
                </label>
                <input
                  id="micro-land-creature-name"
                  autoFocus
                  value={draft}
                  onChange={e => setPending({ id: inspected.id, text: e.target.value })}
                  maxLength={24}
                  placeholder="Give it a name"
                  className="min-w-0 flex-1 rounded px-2 py-1"
                  style={{
                    fontSize: 12,
                    color: 'var(--cc-text-default)',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--cc-mint-line)',
                  }}
                  onPointerDown={e => e.stopPropagation()}
                />
                <button
                  type="submit"
                  className="cc-btn"
                  disabled={draft.trim().length === 0}
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    color: 'var(--cc-mint)',
                    border: '1px solid var(--cc-mint-line)',
                    opacity: draft.trim().length === 0 ? 0.4 : 1,
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  Name
                </button>
                <button
                  type="button"
                  className="cc-btn"
                  onClick={() => setPending(null)}
                  style={{
                    fontSize: 10,
                    padding: '4px 8px',
                    color: 'var(--cc-text-muted)',
                    border: '1px solid var(--cc-panel-divider)',
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="cc-btn"
                onClick={() => setPending({ id: inspected.id, text: '' })}
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 9,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  color: 'var(--cc-text-muted)',
                  border: '1px solid var(--cc-panel-divider)',
                }}
                onPointerDown={e => e.stopPropagation()}
              >
                Name this creature
              </button>
            )}
          </div>
        )}

        <div
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 1,
            color: trouble ? 'var(--cc-pink)' : 'var(--cc-text-default)',
          }}
        >
          {trouble ?? moodText(inspected.mood, bp.move.kind)}
          {inspected.targetName && !trouble && bp.move.kind !== 'root' && (
            <span style={{ opacity: 0.7 }}>
              {inspected.mood === 'flee' ? ' from ' : ' → '}
              {inspected.targetName}
            </span>
          )}
          {inspected.followingScent && !trouble && !inspected.targetName && (
            <span style={{ opacity: 0.65 }}> · following a scent</span>
          )}
          {inspected.packSize > 1 && inspected.mood === 'hunt' && !trouble && (
            <span style={{ opacity: 0.65 }}> · pack of {inspected.packSize}</span>
          )}
        </div>

        {/*
          Sits directly under the mood, above the meters, because it is the one
          line on this panel that is about *this* creature rather than about its
          kind — everything below is true of every hopper alive.
        */}
        {phrases.length > 0 && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--cc-gold)',
            }}
          >
            {sentence(phrases)}
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            color: 'var(--cc-text-muted)',
            lineHeight: 1.5,
            opacity: 0.8,
          }}
        >
          {biography(inspected, bp)}
        </div>

        <Meter
          label="Full"
          value={fullness}
          tone={fullness < 0.25 ? 'var(--cc-pink)' : 'var(--cc-mint)'}
        />
        <Meter
          label="Life left"
          value={lifeLeft}
          tone="var(--cc-gold)"
          right={`${Math.round(inspected.ageSeconds)}s old`}
        />

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5">
          <Stat label="Size" value={String(bp.size)} />
          <Stat label="Speed" value={inspected.speed.toFixed(1)} />
          <Stat label="Roam" value={`${(inspected.traits.roam ?? 1).toFixed(2)}×`} />
          <Stat label="Territorial" value={`${(inspected.traits.territorial ?? 0.5).toFixed(2)}×`} />
          {/*
            The evidence under the sentence above. Only the traits that earned a
            phrase are listed, and only as a ratio against the species — "1.24×"
            says what "quicker than most" means without the panel having to
            explain what a hopper's speed is in tiles per second.
          */}
          {traits.filter(t => t.label !== 'Own roam').map(t => (
            <Stat key={t.label} label={t.label} value={`${t.value.toFixed(2)}×`} />
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}>
          {moveText(bp)}
          {bp.body.immuneTo.length > 0 && ' · fireproof'}
          {bp.glow > 0 && ' · glows'}
          {inspected.inWater && ' · in water'}
        </div>

        <div style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600, color: 'var(--cc-text-default)' }}>Eats:</strong>{' '}
          {eats.length > 0
            ? eats.map(e => e.name).join(', ')
            : bp.move.kind === 'root'
              ? 'sunlight'
              : 'nothing here'}
          <br />
          <strong style={{ fontWeight: 600, color: 'var(--cc-text-default)' }}>
            Eaten by:
          </strong>{' '}
          {eatenBy.length > 0 ? eatenBy.map(e => e.name).join(', ') : 'nothing here'}
        </div>

        {inspected.lifeLog.length > 0 && (
          <div>
            <button
              type="button"
              className="cc-btn"
              onClick={() => setLifeOpen(o => !o)}
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'var(--cc-text-muted)',
                padding: '2px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ opacity: 0.6 }}>{lifeOpen ? '▾' : '▸'}</span>
              Life story
            </button>
            {lifeOpen && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {inspected.lifeLog.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontFamily: 'var(--cc-font-mono)',
                        fontSize: 9,
                        color: 'var(--cc-text-muted)',
                        opacity: 0.55,
                        minWidth: 32,
                        flexShrink: 0,
                      }}
                    >
                      {Math.round(entry.elapsed)}s
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>
                      {entry.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span style={meterLabel}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 12,
          color: 'var(--cc-text-default)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

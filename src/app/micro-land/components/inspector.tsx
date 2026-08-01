'use client'

import { canEat } from '@/app/micro-land/domain/blueprint'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'

/** Plain-language version of the mood the simulation is actually in. */
const MOOD_TEXT: Record<string, string> = {
  wander: 'Wandering about',
  hunt: 'Looking for food',
  flee: 'Running away!',
  eat: 'Eating',
  rest: 'Resting',
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
 * Live read-out for one creature.
 *
 * Everything here comes from the same blueprint the simulation runs on, so a
 * creature summoned a moment ago reports exactly as completely as a built-in —
 * including who eats it, which is derived from `canEat` rather than authored.
 */
export function Inspector() {
  const inspected = useMicroLand((s) => s.inspected)
  const blueprints = useMicroLand((s) => s.blueprints)
  const setTool = useMicroLand((s) => s.setTool)

  if (!inspected) return null

  const bp = blueprints.find((b) => b.id === inspected.blueprintId)
  if (!bp) return null

  const eats = blueprints.filter((other) => canEat(bp, other))
  const eatenBy = blueprints.filter((other) => canEat(other, bp))

  const fullness = 1 - inspected.hunger
  const lifeLeft = Math.max(
    0,
    1 - inspected.ageSeconds / Math.max(1, inspected.lifespanSeconds)
  )

  const trouble =
    inspected.starving > 0
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
            {bp.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.4 }}>
            {bp.blurb}
          </div>
        </div>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setTool({ kind: 'inspect' })}
          aria-label="Stop inspecting"
          style={{ minWidth: 28, minHeight: 28, color: 'var(--cc-text-muted)', fontSize: 12 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-3">
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
          <Stat label="Meals eaten" value={String(inspected.mealsEaten)} />
          <Stat label="Babies" value={String(inspected.children)} />
          <Stat label="Size" value={String(bp.size)} />
          <Stat label="Speed" value={inspected.speed.toFixed(1)} />
          {bp.dig.through.length > 0 && (
            <Stat label="Tiles dug" value={String(inspected.tilesDug)} />
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}>
          {KIND_TEXT[bp.move.kind] ?? bp.move.kind}
          {bp.body.immuneTo.length > 0 && ' · fireproof'}
          {bp.glow > 0 && ' · glows'}
          {inspected.inWater && ' · in water'}
          {bp.dig.through.length > 0 && (
            <>
              <br />
              Digs through {bp.dig.through.join(', ')}
            </>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600, color: 'var(--cc-text-default)' }}>
            Eats:
          </strong>{' '}
          {eats.length > 0
            ? eats.map((e) => e.name).join(', ')
            : bp.move.kind === 'root'
              ? 'sunlight'
              : 'nothing here'}
          <br />
          <strong style={{ fontWeight: 600, color: 'var(--cc-text-default)' }}>
            Eaten by:
          </strong>{' '}
          {eatenBy.length > 0 ? eatenBy.map((e) => e.name).join(', ') : 'nothing here'}
        </div>
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

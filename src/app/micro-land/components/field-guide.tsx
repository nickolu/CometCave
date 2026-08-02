'use client'

import type { SpeciesRecord } from '@/app/micro-land/chronicle/types'
import { canEat } from '@/app/micro-land/domain/blueprint'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'
import { formatDuration } from '@/app/micro-land/format'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'


const KIND_WORDS: Record<string, string> = {
  walk: 'walks',
  fly: 'flies',
  swim: 'swims',
  crawl: 'climbs',
  drift: 'floats',
  root: 'stays put',
}

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'var(--cc-text-muted)',
}

const recordLabel: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 9,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: 'var(--cc-text-muted)',
}

/**
 * The field guide — and, behind the same tap, the logbook.
 *
 * Every relationship shown here is derived from the same `canEat` rule the
 * simulation uses, so a creature summoned thirty seconds ago is described as
 * accurately as one that shipped with the game.
 *
 * The records, the remembered species and the milestones all live in here
 * rather than anywhere on the main screen. That is deliberate: the world stays a
 * world, and everything the game has been quietly counting is one tap away for
 * whoever wants it.
 */
export function FieldGuide() {
  const open = useMicroLand((s) => s.guideOpen)
  const setOpen = useMicroLand((s) => s.setGuideOpen)
  const blueprints = useMicroLand((s) => s.blueprints)
  const population = useMicroLand((s) => s.population)
  const records = useMicroLand((s) => s.records)
  const archive = useMicroLand((s) => s.archive)
  const milestones = useMicroLand((s) => s.milestones)

  if (!open) return null

  const counts = new Map(population.map((p) => [p.blueprintId, p.count]))
  const ordered = [...blueprints].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
  )

  // Species the player has met before that aren't in this world — the reason a
  // summoned creature no longer dies with the tab it was invented in.
  const here = new Set(blueprints.map((b) => b.id))
  const remembered = archive.filter((s) => !here.has(s.blueprint.id))

  const hasRecords =
    records.elder !== null ||
    records.bestSteadySeconds > 0 ||
    records.bestGenerations > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'var(--cc-modal-scrim)' }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Field guide"
        className="w-full max-w-2xl overflow-y-auto rounded-t-xl sm:rounded-xl"
        style={{
          maxHeight: '88dvh',
          background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
          border: '1px solid var(--cc-modal-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 flex items-center justify-between px-4 py-3"
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
            Field Guide
          </h2>
          <button
            type="button"
            className="cc-btn"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ minWidth: 44, minHeight: 34, color: 'var(--cc-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {hasRecords && (
          <section
            className="flex flex-col gap-2.5 px-4 py-3"
            style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
          >
            <h3 style={sectionHeading}>This land&rsquo;s records</h3>

            {records.elder && (
              <div className="flex flex-col gap-0.5">
                <span style={recordLabel}>Longest life</span>
                <span style={{ fontSize: 13, color: 'var(--cc-gold)' }}>
                  {formatDuration(records.elder.seconds)}
                  <span style={{ color: 'var(--cc-text-muted)' }}>
                    {' — '}
                    {records.elder.name
                      ? `${records.elder.name}, a ${records.elder.speciesName}`
                      : records.elder.speciesName}
                  </span>
                </span>
              </div>
            )}

            {records.bestSteadySeconds > 0 && (
              <div className="flex flex-col gap-0.5">
                <span style={recordLabel}>Longest without losing a kind</span>
                <span style={{ fontSize: 13, color: 'var(--cc-text-default)' }}>
                  {formatDuration(records.bestSteadySeconds)}
                  {records.steadySeconds >= records.bestSteadySeconds &&
                    records.steadySeconds > 0 && (
                      <span style={{ color: 'var(--cc-gold)' }}> — going now</span>
                    )}
                </span>
              </div>
            )}

            {records.bestGenerations > 1 && (
              <div className="flex flex-col gap-0.5">
                <span style={recordLabel}>Deepest family line</span>
                <span style={{ fontSize: 13, color: 'var(--cc-text-default)' }}>
                  {records.bestGenerations} generations
                  {records.bestGenerationsSpeciesName && (
                    <span style={{ color: 'var(--cc-text-muted)' }}>
                      {' — '}
                      {records.bestGenerationsSpeciesName}
                    </span>
                  )}
                </span>
              </div>
            )}
          </section>
        )}

        <ul className="flex flex-col">
          {ordered.map((bp) => (
            <GuideEntry
              key={bp.id}
              bp={bp}
              alive={counts.get(bp.id) ?? 0}
              blueprints={blueprints}
            />
          ))}
        </ul>

        {remembered.length > 0 && (
          <section style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
            <h3 className="px-4 pb-1 pt-3" style={sectionHeading}>
              Remembered · {remembered.length}
            </h3>
            <p
              className="px-4 pb-2"
              style={{ fontSize: 12, color: 'var(--cc-text-muted)', opacity: 0.8 }}
            >
              Kinds you have met before. None of them are in this land.
            </p>
            <ul className="flex flex-col">
              {remembered.map((record) => (
                <RememberedEntry key={record.blueprint.id} record={record} />
              ))}
            </ul>
          </section>
        )}

        {milestones.length > 0 && (
          <section
            className="px-4 py-3"
            style={{ borderTop: '1px solid var(--cc-panel-divider)' }}
          >
            <h3 className="pb-2" style={sectionHeading}>
              Things that have happened
            </h3>
            <ul className="flex flex-col gap-1.5">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-baseline justify-between gap-3"
                  style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}
                >
                  <span>{m.text}</span>
                  <span
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 10,
                      opacity: 0.6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(m.at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function GuideEntry({
  bp,
  alive,
  blueprints,
}: {
  bp: CreatureBlueprint
  alive: number
  blueprints: CreatureBlueprint[]
}) {
  const eats = blueprints.filter((other) => canEat(bp, other))
  const eatenBy = blueprints.filter((other) => canEat(other, bp))

  return (
    <li
      className="flex gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
    >
      <div className="shrink-0 pt-0.5">
        <CreaturePortrait blueprint={bp} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: alive > 0 ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
            }}
          >
            {bp.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              color: alive > 0 ? 'var(--cc-text-muted)' : 'var(--cc-pink)',
            }}
          >
            {alive > 0 ? `${alive} alive` : 'none left'}
          </span>
          {bp.summoned && (
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 999,
                color: 'var(--cc-pink)',
                border: '1px solid var(--cc-pink-border)',
              }}
            >
              Summoned
            </span>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--cc-text-muted)', marginTop: 2 }}>
          {bp.blurb}
        </p>

        <p
          style={{
            fontSize: 12,
            color: 'var(--cc-text-muted)',
            opacity: 0.85,
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          Size {bp.size} · {KIND_WORDS[bp.move.kind] ?? bp.move.kind}
          {bp.body.immuneTo.length > 0 && ` · unburnable`}
          {bp.glow > 0 && ` · glows`}
          {bp.dig.through.length > 0 && ` · digs through ${bp.dig.through.join(', ')}`}
          <br />
          <strong style={{ fontWeight: 600 }}>Eats:</strong>{' '}
          {eats.length > 0
            ? eats.map((e) => e.name).join(', ')
            : bp.move.kind === 'root'
              ? 'sunlight'
              : 'nothing here'}
          <br />
          <strong style={{ fontWeight: 600 }}>Eaten by:</strong>{' '}
          {eatenBy.length > 0 ? eatenBy.map((e) => e.name).join(', ') : 'nothing here'}
        </p>
      </div>
    </li>
  )
}

/**
 * A species from a past visit.
 *
 * Says less than a live entry on purpose: who eats whom is a fact about *this*
 * world, and repeating it for a creature that isn't here would be describing a
 * food chain that doesn't exist.
 */
function RememberedEntry({ record }: { record: SpeciesRecord }) {
  const bp = record.blueprint
  return (
    <li
      className="flex gap-3 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--cc-panel-divider)', opacity: 0.62 }}
    >
      <div className="shrink-0 pt-0.5">
        <CreaturePortrait blueprint={bp} size={30} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'var(--cc-text-muted)',
            }}
          >
            {bp.name}
          </span>
          {bp.summoned && (
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '1px 5px',
                borderRadius: 999,
                color: 'var(--cc-pink)',
                border: '1px solid var(--cc-pink-border)',
              }}
            >
              Summoned
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginTop: 1 }}>
          {bp.blurb}
        </p>
        <p
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            color: 'var(--cc-text-muted)',
            opacity: 0.75,
            marginTop: 4,
          }}
        >
          First seen {new Date(record.firstSeen).toLocaleDateString()}
          {record.longestLife > 0 && ` · lived ${formatDuration(record.longestLife)}`}
        </p>
      </div>
    </li>
  )
}

'use client'

import { canEat } from '@/app/micro-land/domain/blueprint'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'
import { SparkleIcon } from './sparkle-icon'

const KIND_WORDS: Record<string, string> = {
  walk: 'walks',
  fly: 'flies',
  swim: 'swims',
  crawl: 'climbs',
  drift: 'floats',
  root: 'stays put',
}

/**
 * The field guide.
 *
 * Every relationship shown here is derived from the same `canEat` rule the
 * simulation uses, so a creature summoned thirty seconds ago is described as
 * accurately as one that shipped with the game.
 */
export function FieldGuide() {
  const open = useMicroLand((s) => s.guideOpen)
  const setOpen = useMicroLand((s) => s.setGuideOpen)
  const blueprints = useMicroLand((s) => s.blueprints)
  const population = useMicroLand((s) => s.population)

  if (!open) return null

  const counts = new Map(population.map((p) => [p.blueprintId, p.count]))
  const ordered = [...blueprints].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
  )

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

        <ul className="flex flex-col">
          {ordered.map((bp) => {
            const eats = blueprints.filter((other) => canEat(bp, other))
            const eatenBy = blueprints.filter((other) => canEat(other, bp))
            const alive = counts.get(bp.id) ?? 0

            return (
              <li
                key={bp.id}
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
                        className="inline-flex items-center gap-1"
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
                        <SparkleIcon size={9} />
                        Generated
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
                    {bp.dig.through.length > 0 &&
                      ` · digs through ${bp.dig.through.join(', ')}`}
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
          })}
        </ul>
      </div>
    </div>
  )
}

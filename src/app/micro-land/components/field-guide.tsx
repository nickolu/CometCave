'use client'

import { useState } from 'react'

import type { ElderRecord, SpeciesRecord } from '@/app/micro-land/chronicle/types'
import { canEat, isPlantLike, moveWord } from '@/app/micro-land/domain/blueprint'
import { type CreatureBlueprint, LIFE_KINDS } from '@/app/micro-land/domain/types'
import { formatDuration } from '@/app/micro-land/format'
import { useMicroLand, type PopulationSnapshot } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'
import { SparkleIcon } from './sparkle-icon'

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

/** The two column headings. Same treatment as a row label, but centred over its column. */
const columnHeading: React.CSSProperties = {
  ...recordLabel,
  textAlign: 'left',
  paddingBottom: 4,
}

const recordCell: React.CSSProperties = {
  fontSize: 13,
  verticalAlign: 'top',
  paddingBottom: 8,
  // The two columns are read against each other, so they get equal width
  // regardless of which one happens to hold the longer species name.
  width: '38%',
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
  const open = useMicroLand(s => s.guideOpen)
  const setOpen = useMicroLand(s => s.setGuideOpen)
  const blueprints = useMicroLand(s => s.blueprints)
  const population = useMicroLand(s => s.population)
  const records = useMicroLand(s => s.records)
  const archive = useMicroLand(s => s.archive)
  const milestones = useMicroLand(s => s.milestones)
  const populationHistory = useMicroLand(s => s.populationHistory)
  const requestLocate = useMicroLand(s => s.requestLocate)

  const [hiddenPlantIds, setHiddenPlantIds] = useState<ReadonlySet<string>>(new Set())

  function hideSpecies(id: string) {
    setHiddenPlantIds(prev => new Set([...prev, id]))
  }

  function showAll() {
    setHiddenPlantIds(new Set())
  }

  if (!open) return null

  const counts = new Map(population.map(p => [p.blueprintId, p.count]))
  const allOrdered = [...blueprints].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  const hiddenCount = [...allOrdered].filter(bp => hiddenPlantIds.has(bp.id)).length
  const ordered = allOrdered.filter(bp => !hiddenPlantIds.has(bp.id))

  // Species the player has met before that aren't in this world — the reason a
  // summoned creature no longer dies with the tab it was invented in.
  const here = new Set(blueprints.map(b => b.id))
  const remembered = archive.filter(s => !here.has(s.blueprint.id))

  const hasRecords =
    records.elder !== null || records.bestSteadySeconds > 0 || records.bestGenerations > 1

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
        onClick={e => e.stopPropagation()}
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

            {/*
              Two columns rather than one list, because one list is a plant
              leaderboard. Nothing rooted is ever chased or ever has to find a
              meal, so moss out-lives and out-breeds every animal in the world by
              an order of magnitude and took both records on every land, every
              session — leaving the creatures the player actually watches move
              with nothing to win. Both columns show at all times, empty ones
              included: an Animals column that only appeared once an animal had
              earned something would hide the very thing worth chasing.
            */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {/* Empty corner cell — the row labels below are the row headers. */}
                  <td />
                  <th scope="col" style={columnHeading}>
                    Plants
                  </th>
                  <th scope="col" style={columnHeading}>
                    Animals
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" style={{ ...recordLabel, textAlign: 'left', paddingRight: 8 }}>
                    Longest life
                  </th>
                  {LIFE_KINDS.map(kind => (
                    <td key={kind} style={recordCell}>
                      <ElderCell elder={records.byKind[kind].elder} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" style={{ ...recordLabel, textAlign: 'left', paddingRight: 8 }}>
                    Deepest family line
                  </th>
                  {LIFE_KINDS.map(kind => (
                    <td key={kind} style={recordCell}>
                      <LineCell
                        generations={records.byKind[kind].bestGenerations}
                        speciesName={records.byKind[kind].bestGenerationsSpeciesName}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

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
          </section>
        )}

        {hiddenCount > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: '1px solid var(--cc-panel-divider)', background: 'var(--cc-modal-bg-from)' }}
          >
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'var(--cc-text-muted)',
              }}
            >
              {hiddenCount} {hiddenCount === 1 ? 'plant' : 'plants'} hidden
            </span>
            <button
              type="button"
              className="cc-btn"
              onClick={showAll}
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '4px 8px',
                minHeight: 28,
                borderRadius: 4,
                border: '1px solid var(--cc-mint-line)',
                color: 'var(--cc-text-muted)',
              }}
            >
              Show all
            </button>
          </div>
        )}
        <ul className="flex flex-col">
          {ordered.map(bp => (
            <GuideEntry
              key={bp.id}
              bp={bp}
              alive={counts.get(bp.id) ?? 0}
              blueprints={blueprints}
              onLocate={(counts.get(bp.id) ?? 0) > 0 ? () => requestLocate(bp.id) : undefined}
              onHide={isPlantLike(bp) ? () => hideSpecies(bp.id) : undefined}
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
              {remembered.map(record => (
                <RememberedEntry key={record.blueprint.id} record={record} />
              ))}
            </ul>
          </section>
        )}

        {milestones.length > 0 && (
          <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
            <h3 className="pb-2" style={sectionHeading}>
              Things that have happened
            </h3>
            <ul className="flex flex-col gap-1.5">
              {milestones.map(m => (
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
        <PopulationGraph history={populationHistory} blueprints={blueprints} />
      </div>
    </div>
  )
}

/**
 * A column that has nothing in it yet.
 *
 * A dash rather than a blank cell, and rather than nothing at all: an empty cell
 * reads as a rendering fault, whereas a dash reads as a record still going
 * spare. It is also the only thing marking the state — never colour alone.
 */
function NoRecord() {
  return (
    <span style={{ color: 'var(--cc-text-muted)', opacity: 0.55 }}>
      <span aria-hidden>—</span>
      <span className="sr-only">none yet</span>
    </span>
  )
}

function ElderCell({ elder }: { elder: ElderRecord | null }) {
  if (!elder) return <NoRecord />
  return (
    <>
      <span style={{ color: 'var(--cc-gold)' }}>{formatDuration(elder.seconds)}</span>
      {/* The holder on its own line: two columns of "4m 12s — a sky moss" on a
          phone wraps into something unreadable, and the number is what is being
          compared across the columns. */}
      <br />
      <span style={{ color: 'var(--cc-text-muted)', fontSize: 12 }}>
        {elder.name ? `${elder.name}, a ${elder.speciesName}` : elder.speciesName}
      </span>
    </>
  )
}

function LineCell({
  generations,
  speciesName,
}: {
  generations: number
  speciesName: string | null
}) {
  // One generation is everything the player put there by hand, so it is not a
  // family line yet and saying "1 generations" would suggest otherwise.
  if (generations <= 1) return <NoRecord />
  return (
    <>
      <span style={{ color: 'var(--cc-text-default)' }}>{generations} generations</span>
      {speciesName && (
        <>
          <br />
          <span style={{ color: 'var(--cc-text-muted)', fontSize: 12 }}>{speciesName}</span>
        </>
      )}
    </>
  )
}

function GuideEntry({
  bp,
  alive,
  blueprints,
  onHide,
  onLocate,
}: {
  bp: CreatureBlueprint
  alive: number
  blueprints: CreatureBlueprint[]
  onHide?: () => void
  onLocate?: () => void
}) {
  const eats = blueprints.filter(other => canEat(bp, other))
  const eatenBy = blueprints.filter(other => canEat(other, bp))

  return (
    <li
      className="flex gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
    >
      <div className="shrink-0 pt-0.5">
        <CreaturePortrait blueprint={bp} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
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
          {(onLocate || onHide) && (
            <div className="flex shrink-0 items-center gap-1">
              {onLocate && (
                <button
                  type="button"
                  className="cc-btn"
                  onClick={onLocate}
                  aria-label={`Pan camera to ${bp.name}`}
                  title="Pan to this creature in the world"
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    padding: '3px 7px',
                    minHeight: 24,
                    borderRadius: 4,
                    border: '1px solid var(--cc-mint-line)',
                    color: 'var(--cc-mint)',
                    opacity: 0.8,
                  }}
                >
                  Find
                </button>
              )}
              {onHide && (
                <button
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={onHide}
                  aria-label={`Hide ${bp.name} from field guide`}
                  title="Hide from field guide (plant still lives in the world)"
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    padding: '3px 7px',
                    minHeight: 24,
                    borderRadius: 4,
                    border: '1px solid var(--cc-mint-line)',
                    color: 'var(--cc-text-muted)',
                    opacity: 0.65,
                  }}
                >
                  Hide
                </button>
              )}
            </div>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--cc-text-muted)', marginTop: 2 }}>{bp.blurb}</p>

        <p
          style={{
            fontSize: 12,
            color: 'var(--cc-text-muted)',
            opacity: 0.85,
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          Size {bp.size} · {moveWord(bp)}
          {bp.body.immuneTo.length > 0 && ` · unburnable`}
          {bp.glow > 0 && ` · glows`}
          {bp.dig.through.length > 0 && ` · digs through ${bp.dig.through.join(', ')}`}
          {bp.aura && (
            <>
              <br />
              <strong style={{ fontWeight: 600 }}>Helps:</strong>{' '}
              {[
                bp.aura.helps.length > 0 &&
                  bp.aura.boost > 1 &&
                  `${bp.aura.helps.join(' and ')} nearby grow back faster`,
                bp.aura.converts && `turns ${bp.aura.converts.from} into ${bp.aura.converts.to}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </>
          )}
          <br />
          <strong style={{ fontWeight: 600 }}>Eats:</strong>{' '}
          {eats.length > 0
            ? eats.map(e => e.name).join(', ')
            : bp.move.kind === 'root'
              ? 'sunlight'
              : 'nothing here'}
          <br />
          <strong style={{ fontWeight: 600 }}>Eaten by:</strong>{' '}
          {eatenBy.length > 0 ? eatenBy.map(e => e.name).join(', ') : 'nothing here'}
        </p>
      </div>
    </li>
  )
}

const GRAPH_COLORS = [
  '#4fc3f7',
  '#81c784',
  '#ffb74d',
  '#f06292',
  '#ba68c8',
  '#4db6ac',
  '#fff176',
  '#90a4ae',
]

function PopulationGraph({
  history,
  blueprints,
}: {
  history: PopulationSnapshot[]
  blueprints: CreatureBlueprint[]
}) {
  if (history.length < 2) {
    return (
      <section
        className="px-4 py-3"
        style={{ borderTop: '1px solid var(--cc-panel-divider)' }}
      >
        <h3 className="pb-2" style={sectionHeading}>
          Population over time
        </h3>
        <p style={{ fontSize: 12, color: 'var(--cc-text-muted)', opacity: 0.6 }}>
          Gathering data…
        </p>
      </section>
    )
  }

  const MAX_SPECIES = 8
  const W = 320
  const H = 72
  const PAD_TOP = 4
  const PAD_BOTTOM = 4

  // Determine which species to show: top MAX_SPECIES by peak count in history
  const bpMap = new Map(blueprints.map(b => [b.id, b]))
  const peakByBp = new Map<string, number>()
  for (const snap of history) {
    for (const [id, count] of Object.entries(snap.counts)) {
      peakByBp.set(id, Math.max(peakByBp.get(id) ?? 0, count))
    }
  }
  const shown = [...peakByBp.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SPECIES)
    .map(([id]) => id)
    .filter(id => bpMap.has(id))

  const minT = history[0].elapsed
  const maxT = history[history.length - 1].elapsed
  const tRange = Math.max(maxT - minT, 1)

  let maxCount = 1
  for (const snap of history) {
    for (const id of shown) {
      maxCount = Math.max(maxCount, snap.counts[id] ?? 0)
    }
  }

  function toX(elapsed: number) {
    return ((elapsed - minT) / tRange) * W
  }

  function toY(count: number) {
    return PAD_TOP + (1 - count / maxCount) * (H - PAD_TOP - PAD_BOTTOM)
  }

  return (
    <section
      className="px-4 py-3"
      style={{ borderTop: '1px solid var(--cc-panel-divider)' }}
    >
      <h3 className="pb-2" style={sectionHeading}>
        Population over time
      </h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        aria-hidden
      >
        {/* Zero line */}
        <line
          x1={0}
          y1={toY(0)}
          x2={W}
          y2={toY(0)}
          stroke="var(--cc-panel-divider)"
          strokeWidth={1}
        />
        {shown.map((bpId, i) => {
          const points = history
            .map(snap => `${toX(snap.elapsed).toFixed(1)},${toY(snap.counts[bpId] ?? 0).toFixed(1)}`)
            .join(' ')
          return (
            <polyline
              key={bpId}
              points={points}
              fill="none"
              stroke={GRAPH_COLORS[i % GRAPH_COLORS.length]}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
            />
          )
        })}
      </svg>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {shown.map((bpId, i) => {
          const bp = bpMap.get(bpId)
          if (!bp) return null
          const latest = history[history.length - 1].counts[bpId] ?? 0
          return (
            <span key={bpId} className="flex items-center gap-1">
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: GRAPH_COLORS[i % GRAPH_COLORS.length],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 9,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: 'var(--cc-text-muted)',
                }}
              >
                {bp.name} · {latest}
              </span>
            </span>
          )
        })}
      </div>
    </section>
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
        <p style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginTop: 1 }}>{bp.blurb}</p>
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

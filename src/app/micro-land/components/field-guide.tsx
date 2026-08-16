'use client'

import { useState } from 'react'

import type { ElderRecord, SpeciesRecord } from '@/app/micro-land/chronicle/types'
import { canEat, isPlantLike, moveWord, sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { type CreatureBlueprint, type CreatureThumb, type Traits, LIFE_KINDS } from '@/app/micro-land/domain/types'
import { formatDuration } from '@/app/micro-land/format'
import { useMicroLand, type PopulationSnapshot, type TraitHistoryEntry } from '@/app/micro-land/store'
import { TUNING } from '@/app/micro-land/domain/tuning'

import { CreaturePortrait } from './creature-chip'
import { SparkleIcon } from './sparkle-icon'

function worldGdd(elapsed: number): number {
  if (TUNING.seasonAmplitude === 0 || TUNING.seasonPeriod <= 0) return 1000
  const yearsElapsed = Math.floor(elapsed / TUNING.seasonPeriod)
  const climateBonus = Math.min(400, yearsElapsed * TUNING.climateWarmingRate)
  const yearFrac = (elapsed % TUNING.seasonPeriod) / TUNING.seasonPeriod
  const baseGdd = Math.round((1 - Math.cos(2 * Math.PI * yearFrac)) / 2 * 1000)
  return Math.min(1000, baseGdd + climateBonus)
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
 *
 * Nothing else hangs off it. The guide used to carry the workshop and the
 * challenges behind two tabs in its own header, which made "look something up"
 * and "make something new" the same door — those live in the main menu now, and
 * the guide is only ever a guide.
 */
export function FieldGuidePane() {
  const blueprints = useMicroLand(s => s.blueprints)
  const population = useMicroLand(s => s.population)
  const records = useMicroLand(s => s.records)
  const archive = useMicroLand(s => s.archive)
  const milestones = useMicroLand(s => s.milestones)
  const populationHistory = useMicroLand(s => s.populationHistory)
  const traitOverlay = useMicroLand(s => s.traitOverlay)
  const invasionFront = useMicroLand(s => s.invasionFront)
  const biomeZones = useMicroLand(s => s.biomeZones)
  const atmosphericCO2 = useMicroLand(s => s.atmosphericCO2)
  const atmosphericO2 = useMicroLand(s => s.atmosphericO2)
  const migrationStats = useMicroLand(s => s.migrationStats)
  const networkDegree = useMicroLand(s => s.networkDegree)
  const networkStats = useMicroLand(s => s.networkStats)
  const setTraitOverlay = useMicroLand(s => s.setTraitOverlay)
  const addBlueprint = useMicroLand(s => s.addBlueprint)
  const trailsEnabled = useMicroLand(s => s.trailsEnabled)
  const setTrailsEnabled = useMicroLand(s => s.setTrailsEnabled)
  const extinctions = useMicroLand(s => s.extinctions)
  const worldStats = useMicroLand(s => s.worldStats)
  const namedCreatures = useMicroLand(s => s.namedCreatures)
  const foodWeb = useMicroLand(s => s.foodWeb)
  const populationItems = useMicroLand(s => s.populationItems)
  const requestLocateCreature = useMicroLand(s => s.requestLocateCreature)
  const compareId = useMicroLand(s => s.compareId)
  const setCompareId = useMicroLand(s => s.setCompareId)
  const traitHistory = useMicroLand(s => s.traitHistory)
  const agePyramid = useMicroLand(s => s.agePyramid)
  const heatmapBlueprintId = useMicroLand(s => s.heatmapBlueprintId)
  const setHeatmapBlueprint = useMicroLand(s => s.setHeatmapBlueprint)
  const elapsed = useMicroLand(s => s.elapsed)
  const allBlueprintNames = Object.fromEntries(blueprints.map(b => [b.id, b.name]))

  const [plantsHidden, setPlantsHidden] = useState(false)
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('fg-compact') === '1' } catch { return false }
  })
  const [compareTarget, setCompareTarget] = useState<string | null>(null)

  const counts = new Map(population.map(p => [p.blueprintId, p.count]))
  const genByBp = new Map(population.map(p => [p.blueprintId, p.maxGeneration]))
  const allOrdered = [...blueprints].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  const ordered = allOrdered.filter(bp => !plantsHidden || !isPlantLike(bp))

  // Species the player has met before that aren't in this world — the reason a
  // summoned creature no longer dies with the tab it was invented in.
  const here = new Set(blueprints.map(b => b.id))
  const remembered = archive.filter(s => !here.has(s.blueprint.id))

  const hasRecords =
    records.elder !== null || records.bestSteadySeconds > 0 || records.bestGenerations > 1

  const handleCompare = (bpId: string) => {
    if (compareTarget !== null) {
      // Already in comparison — clear it
      setCompareTarget(null)
      setCompareId(null)
      return
    }
    if (compareId === null) {
      setCompareId(bpId)
    } else if (compareId === bpId) {
      setCompareId(null)
    } else {
      setCompareTarget(bpId)
    }
  }

  function biomeIcon(type: string): string {
    const icons: Record<string, string> = {
      'tropical-rainforest': '🌴',
      'tropical-savanna': '🌿',
      'desert': '🏜',
      'temperate-grassland': '🌾',
      'temperate-forest': '🌲',
      'boreal': '🌲',
      'tundra': '❄',
      'ice-cap': '🧊',
    }
    return icons[type] ?? '🌍'
  }

  function biomeLabel(type: string): string {
    return type.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <>
      {compareTarget !== null && compareId !== null && (
        <ComparisonPanel
          bpA={blueprints.find(b => b.id === compareId)!}
          bpB={blueprints.find(b => b.id === compareTarget)!}
          onDismiss={() => { setCompareTarget(null); setCompareId(null) }}
        />
      )}

      {compareTarget === null && hasRecords && (
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

      {compareTarget === null && <>

      {namedCreatures.some(e => e.alive) && (
        <section style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="px-4 pb-1 pt-3" style={sectionHeading}>
            Named · {namedCreatures.filter(e => e.alive).length}
          </h3>
          <ul className="flex flex-col">
            {namedCreatures
              .filter(e => e.alive)
              .slice()
              .sort((a, b) => b.ageSeconds - a.ageSeconds)
              .map((entry, i) => {
                const bp = blueprints.find(b => b.id === entry.blueprintId)
                return (
                  <li
                    key={entry.name + entry.blueprintId + i}
                    className="flex gap-3 px-4 py-2.5"
                    style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
                  >
                    {bp && (
                      <div className="shrink-0 pt-0.5">
                        <CreaturePortrait blueprint={bp} size={30} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        style={{
                          fontFamily: 'var(--cc-font-mono)',
                          fontSize: 12,
                          letterSpacing: 1.4,
                          textTransform: 'uppercase',
                          color: 'var(--cc-mint)',
                        }}
                      >
                        {entry.name}
                      </span>
                      {bp && (
                        <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginTop: 1 }}>
                          {bp.name}
                        </p>
                      )}
                      <p
                        style={{
                          fontFamily: 'var(--cc-font-mono)',
                          fontSize: 10,
                          color: 'var(--cc-text-muted)',
                          opacity: 0.75,
                          marginTop: 4,
                          lineHeight: 1.6,
                        }}
                      >
                        alive · {formatDuration(entry.ageSeconds)}
                        {entry.generation > 1 && ` · gen ${entry.generation}`}
                        {entry.children > 0 && ` · ${entry.children} offspring`}
                        {entry.mealsEaten > 0 && ` · ${entry.mealsEaten} meals`}
                      </p>
                    </div>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      {namedCreatures.some(e => !e.alive) && (
        <section style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="px-4 pb-1 pt-3" style={sectionHeading}>
            Graveyard · {namedCreatures.filter(e => !e.alive).length}
          </h3>
          <ul className="flex flex-col">
            {namedCreatures
              .filter(e => !e.alive)
              .slice()
              .sort((a, b) => b.ageSeconds - a.ageSeconds)
              .map((entry, i) => {
                const bp = blueprints.find(b => b.id === entry.blueprintId)
                return (
                  <li
                    key={entry.name + entry.blueprintId + i}
                    className="flex gap-3 px-4 py-2.5"
                    style={{
                      borderBottom: '1px solid var(--cc-panel-divider)',
                      opacity: 0.65,
                    }}
                  >
                    {/* Pixel tombstone */}
                    <div className="shrink-0" style={{ paddingTop: 2 }}>
                      <svg
                        width="30"
                        height="30"
                        viewBox="0 0 8 8"
                        style={{ imageRendering: 'pixelated', display: 'block' }}
                        aria-hidden
                      >
                        {/* stone body */}
                        <rect x="1" y="3" width="6" height="4" fill="#6b7280" />
                        {/* rounded top — two rows forming an arch */}
                        <rect x="2" y="1" width="4" height="3" fill="#6b7280" />
                        <rect x="1" y="2" width="6" height="1" fill="#6b7280" />
                        {/* highlight edge */}
                        <rect x="1" y="1" width="1" height="5" fill="#9ca3af" />
                        <rect x="2" y="1" width="4" height="1" fill="#9ca3af" />
                        {/* cross */}
                        <rect x="3" y="2" width="2" height="4" fill="#374151" />
                        <rect x="2" y="3" width="4" height="1" fill="#374151" />
                        {/* base ground */}
                        <rect x="0" y="7" width="8" height="1" fill="#4b5563" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          style={{
                            fontFamily: 'var(--cc-font-mono)',
                            fontSize: 12,
                            letterSpacing: 1.4,
                            textTransform: 'uppercase',
                            color: 'var(--cc-text-muted)',
                          }}
                        >
                          {entry.name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--cc-font-mono)',
                            fontSize: 9,
                            color: 'var(--cc-text-muted)',
                            opacity: 0.55,
                          }}
                        >
                          †
                        </span>
                      </div>
                      {bp && (
                        <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginTop: 1 }}>
                          {bp.name}
                        </p>
                      )}
                      <p
                        style={{
                          fontFamily: 'var(--cc-font-mono)',
                          fontSize: 10,
                          color: 'var(--cc-text-muted)',
                          opacity: 0.65,
                          marginTop: 4,
                          lineHeight: 1.6,
                        }}
                      >
                        lived {formatDuration(entry.ageSeconds)}
                        {entry.generation > 1 && ` · gen ${entry.generation}`}
                        {entry.children > 0 && ` · ${entry.children} offspring`}
                        {entry.mealsEaten > 0 && ` · ${entry.mealsEaten} meals`}
                      </p>
                    </div>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      {/* Filter row — sits right above the list it affects so it reads as a
          list control rather than a navigation option. */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
      >
        <span
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: 'var(--cc-text-muted)',
          }}
        >
          {ordered.length} {ordered.length === 1 ? 'species' : 'species'} in this land
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cc-btn"
            onClick={() => {
              setCompact(c => {
                const next = !c
                try { localStorage.setItem('fg-compact', next ? '1' : '0') } catch {}
                return next
              })
            }}
            aria-pressed={compact}
            title={compact ? 'Switch to full view' : 'Switch to compact view'}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '2px 7px',
              minHeight: 22,
              borderRadius: 3,
              border: compact ? '1px solid var(--cc-mint)' : '1px solid var(--cc-panel-divider)',
              color: compact ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
            }}
          >
            {compact ? '≡ Full' : '≡ Compact'}
          </button>
          <button
            type="button"
            className="cc-btn"
            onClick={() => setPlantsHidden(h => !h)}
            aria-pressed={plantsHidden}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '2px 7px',
              minHeight: 22,
              borderRadius: 3,
              border: plantsHidden ? '1px solid var(--cc-mint)' : '1px solid var(--cc-panel-divider)',
              color: plantsHidden ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
            }}
          >
            {plantsHidden ? 'Plants hidden' : 'Hide plants'}
          </button>
        </div>
      </div>
      <ul className="flex flex-col">
        {ordered.map(bp => (
          <GuideEntry
            key={bp.id}
            bp={bp}
            alive={counts.get(bp.id) ?? 0}
            maxGeneration={genByBp.get(bp.id) ?? 1}
            blueprints={blueprints}
            thumbs={populationItems.filter(t => t.blueprintId === bp.id)}
            onLocateCreature={requestLocateCreature}
            onCompare={() => handleCompare(bp.id)}
            isComparePin={compareId === bp.id}
            traitHistory={traitHistory[bp.id]}
            agePyramidEntry={agePyramid[bp.id]}
            compact={compact}
            isHeatmap={heatmapBlueprintId === bp.id}
            onHeatmap={() => setHeatmapBlueprint(heatmapBlueprintId === bp.id ? null : bp.id)}
            elapsed={elapsed}
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

      <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
        <h3 className="pb-2" style={sectionHeading}>
          Evolution view
        </h3>
        <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', lineHeight: 1.5, marginBottom: 8, opacity: 0.8 }}>
          Color creatures by trait — blue is below average, red is above.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(['speed', 'sight', 'lifespan', 'roam'] as const).map(trait => (
            <button
              key={trait}
              type="button"
              className="cc-btn"
              onClick={() => setTraitOverlay(trait)}
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '4px 10px',
                minHeight: 28,
                borderRadius: 4,
                border: traitOverlay === trait
                  ? '1px solid var(--cc-mint)'
                  : '1px solid var(--cc-mint-line)',
                color: traitOverlay === trait ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                background: traitOverlay === trait ? 'rgba(100,220,200,0.1)' : 'transparent',
              }}
            >
              {trait === 'lifespan' ? 'Life' : trait.charAt(0).toUpperCase() + trait.slice(1)}
            </button>
          ))}
          <button
            type="button"
            className="cc-btn"
            onClick={() => setTrailsEnabled(!trailsEnabled)}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              padding: '4px 10px',
              minHeight: 28,
              borderRadius: 4,
              border: trailsEnabled
                ? '1px solid var(--cc-mint)'
                : '1px solid var(--cc-mint-line)',
              color: trailsEnabled ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
              background: trailsEnabled ? 'rgba(100,220,200,0.1)' : 'transparent',
            }}
          >
            Trails
          </button>
        </div>
        {traitOverlay && (
          <button
            type="button"
            className="cc-btn"
            onClick={() => setTraitOverlay(null)}
            style={{
              marginTop: 8,
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '3px 8px',
              color: 'var(--cc-text-muted)',
              border: '1px solid var(--cc-panel-divider)',
            }}
          >
            Clear
          </button>
        )}
      </section>

      {extinctions.length > 0 && (
        <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="pb-2" style={sectionHeading}>
            Extinctions
          </h3>
          <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
            Species that lived and died in this land.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[...extinctions].reverse().map(ext => (
              <li
                key={ext.blueprintId + ext.elapsed}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '3px 0',
                  opacity: 0.6,
                  fontSize: 11,
                  fontFamily: 'var(--cc-font-mono)',
                }}
              >
                <span>🦴 {ext.name}</span>
                <span style={{ color: 'var(--cc-text-muted)', fontSize: 10 }}>
                  gen {ext.maxGeneration} · {Math.round(ext.livedFor / 60)} min
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {biomeZones.length > 0 && (
        <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="pb-2" style={sectionHeading}>
            Climate Zones
          </h3>
          <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
            Whittaker biome classification by world depth — temperature and moisture shape each band&rsquo;s ecology.
          </p>
          {atmosphericCO2 > 0.05 && (
            <p className="biome-co2-warning" style={{ fontSize: 11, color: 'var(--cc-gold)', marginBottom: 8 }}>
              CO&#x2082;: {Math.round(atmosphericCO2 * 100)}% above baseline
              {atmosphericCO2 > 0.5 ? ' — biomes shifting rapidly' : atmosphericCO2 > 0.2 ? ' — warming detected' : ''}
            </p>
          )}
          {/* O2 level display. Issue #3275. */}
          {atmosphericO2 !== undefined && (
            <p className={atmosphericO2 < 0.7 ? 'biome-co2-warning' : ''} style={{ fontSize: 11, color: atmosphericO2 < 0.7 ? 'var(--cc-gold)' : 'var(--cc-text-muted)', marginBottom: 8 }}>
              O&#x2082;: {(atmosphericO2 * 100).toFixed(0)}% of baseline
              {atmosphericO2 < 0.7 ? ' \u2014 thin atmosphere, animals sluggish' :
               atmosphericO2 > 1.5 ? ' \u2014 oxygen-rich, fire risk elevated' : ''}
            </p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {biomeZones.map(zone => (
              <li
                key={zone.regionIndex}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '3px 0',
                  fontSize: 11,
                  fontFamily: 'var(--cc-font-mono)',
                }}
              >
                <span>
                  {biomeIcon(zone.type)}{' '}{biomeLabel(zone.type)}
                </span>
                <span style={{ color: 'var(--cc-text-muted)', fontSize: 10 }}>
                  {Math.round(zone.temperature * 100)}&deg;&nbsp;&nbsp;{Math.round(zone.precipitation * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(migrationStats).length > 0 && (
        <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="pb-2" style={sectionHeading}>
            Migration Routes
          </h3>
          <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
            Seasonal travellers following ancient corridors across the world.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {Object.entries(migrationStats).map(([bpId, stats]) => (
              <li
                key={bpId}
                style={{
                  padding: '4px 0',
                  borderBottom: '1px solid var(--cc-panel-divider)',
                  fontSize: 11,
                  fontFamily: 'var(--cc-font-mono)',
                  lineHeight: 1.7,
                }}
              >
                <div style={{ color: 'var(--cc-text-default)', letterSpacing: 0.8, textTransform: 'uppercase', fontSize: 10 }}>
                  {stats.name}
                </div>
                <div style={{ color: 'var(--cc-text-muted)' }}>
                  {stats.migrating > 0
                    ? `${stats.migrating} of ${stats.total} en route`
                    : `${stats.total} resident`}
                </div>
                {stats.winteringX !== undefined && (
                  <div style={{ color: 'var(--cc-text-muted)', opacity: 0.8 }}>
                    {'← Winter grounds: tile '}{stats.winteringX}
                  </div>
                )}
                {stats.summerX !== undefined && (
                  <div style={{ color: 'var(--cc-text-muted)', opacity: 0.8 }}>
                    {'→ Summer grounds: tile '}{stats.summerX}
                  </div>
                )}
                {stats.stopoverHabitat.length > 0 && (
                  <div style={{ color: 'var(--cc-text-muted)', opacity: 0.7 }}>
                    {'Stopovers: '}{stats.stopoverHabitat.join(', ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(networkDegree).length > 0 && (() => {
        const maxDegree = Math.max(...Object.values(networkDegree))
        if (maxDegree < 2) return null  // not interesting until trees are well-connected
        const hubEntries = Object.entries(networkDegree)
          .filter(([, d]) => d >= Math.max(3, maxDegree * 0.6))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
        if (hubEntries.length === 0) return null
        return (
          <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
            <h3 className="pb-2" style={sectionHeading}>Hub Trees</h3>
            <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
              Mother trees with the most fungal connections — keystone nodes of the Wood Wide Web.
            </p>
            {hubEntries.map(([id, degree]) => {
              const creature = populationItems.find(p => String(p.id) === id)
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '3px 0',
                    fontSize: 11,
                    fontFamily: 'var(--cc-font-mono)',
                    borderBottom: '1px solid var(--cc-panel-divider)',
                  }}
                >
                  <span style={{ color: 'var(--cc-text-default)' }}>
                    {creature?.name ?? `Node ${id}`}
                  </span>
                  <span style={{ color: 'var(--cc-text-muted)' }}>{degree} links</span>
                </div>
              )
            })}
          </section>
        )
      })()}

      {networkStats && (
        <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="pb-2" style={sectionHeading}>Wood Wide Web</h3>
          <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
            The invisible fungal network threading between plant roots.
          </p>
          <div style={{ fontSize: 11, fontFamily: 'var(--cc-font-mono)', lineHeight: 1.8 }}>
            <div style={{ color: 'var(--cc-text-default)' }}>
              {networkStats.connected} plants networked · {networkStats.isolated} isolated
            </div>
            <div style={{ color: 'var(--cc-text-muted)' }}>
              {networkStats.clusterCount} cluster{networkStats.clusterCount !== 1 ? 's' : ''} · {networkStats.totalLinks} fungal links
            </div>
          </div>
        </section>
      )}

      {Object.keys(foodWeb).length > 0 && (
        <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
          <h3 className="pb-2" style={sectionHeading}>
            Food web
          </h3>
          <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
            Who ate whom — observed in this world so far.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {Object.entries(foodWeb).map(([eaterId, preyIds]) => (
              <li
                key={eaterId}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--cc-font-mono)',
                  padding: '3px 0',
                  lineHeight: 1.6,
                }}
              >
                <span style={{ color: 'var(--cc-text-default)' }}>
                  {allBlueprintNames[eaterId] ?? eaterId}
                </span>
                <span style={{ color: 'var(--cc-text-muted)' }}>{' → '}</span>
                <span style={{ color: 'var(--cc-text-muted)' }}>
                  {preyIds.map(id => allBlueprintNames[id] ?? id).join(', ')}
                </span>
              </li>
            ))}
          </ul>
          <FoodWebGraph blueprints={blueprints} populations={counts} foodWeb={foodWeb} />
        </section>
      )}

      <SuccessionBar blueprints={blueprints} populations={counts} elapsed={elapsed} />

      {/* World Statistics */}
      <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
        <h3 className="pb-2" style={sectionHeading}>
          This session
        </h3>
        <table style={{ width: '100%', fontSize: 11, fontFamily: 'var(--cc-font-mono)', borderCollapse: 'collapse' }}>
          <tbody>
            {(
              [
                ['Born', worldStats.totalBorn],
                ['Died', worldStats.totalDeaths],
                ['Predation events', worldStats.totalEats],
                ['Peak population', worldStats.peakPopulation],
                ['Longest life', worldStats.longestLived > 0 ? `${Math.round(worldStats.longestLived)}s` : '—'],
                ['Most prolific', worldStats.mostProlificName
                  ? `${worldStats.mostProlificName} (${worldStats.mostProlificChildren} offspring)`
                  : '—'],
              ] as [string, string | number][]
            ).map(([label, value]) => (
              <tr key={label} style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}>
                <td style={{ padding: '4px 0', color: 'var(--cc-text-muted)', width: '55%' }}>{label}</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ImportSection addBlueprint={addBlueprint} />

      </>}
    </>
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
  maxGeneration,
  thumbs,
  onLocateCreature,
  onCompare,
  isComparePin,
  traitHistory,
  agePyramidEntry,
  compact,
  isHeatmap,
  onHeatmap,
  elapsed,
}: {
  bp: CreatureBlueprint
  alive: number
  blueprints: CreatureBlueprint[]
  maxGeneration: number
  thumbs?: CreatureThumb[]
  onLocateCreature?: (id: number) => void
  onCompare?: () => void
  isComparePin?: boolean
  traitHistory?: TraitHistoryEntry[]
  agePyramidEntry?: { j: number; a: number; e: number }
  compact?: boolean
  isHeatmap?: boolean
  onHeatmap?: () => void
  elapsed: number
}) {
  const eats = blueprints.filter(other => canEat(bp, other))
  const eatenBy = blueprints.filter(other => canEat(other, bp))
  const bpColor = Object.values(bp.art.palette)[0] ?? '#888888'

  return (
    <li
      style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
    >
      {thumbs && thumbs.length > 0 && onLocateCreature && (
        <div
          className="flex flex-wrap gap-1 px-3 pt-2"
          role="group"
          aria-label={`${bp.name} population — ${thumbs.length} alive`}
        >
          {thumbs.map(t => (
            <button
              key={t.id}
              type="button"
              className="cc-btn"
              title={
                t.name
                  ? `${t.name} · ${Math.round(t.ageSeconds)}s`
                  : `${Math.round(t.ageSeconds)}s`
              }
              onClick={() => onLocateCreature(t.id)}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: bpColor,
                border: t.name ? '2px solid gold' : '1px solid rgba(0,0,0,0.3)',
                padding: 0,
                flexShrink: 0,
              }}
              aria-label={
                t.name
                  ? `${t.name}, age ${Math.round(t.ageSeconds)}s`
                  : `${bp.name}, age ${Math.round(t.ageSeconds)}s`
              }
            />
          ))}
        </div>
      )}
      {agePyramidEntry && (() => {
        const { j, a, e } = agePyramidEntry
        const total = j + a + e
        if (total === 0) return null
        return (
          <div style={{ display: 'flex', height: '4px', width: '100%', marginTop: '2px', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(j / total * 100).toFixed(1)}%`, background: '#88cc44' }} title={`Juvenile: ${j}`} />
            <div style={{ width: `${(a / total * 100).toFixed(1)}%`, background: '#4488cc' }} title={`Adult: ${a}`} />
            <div style={{ width: `${(e / total * 100).toFixed(1)}%`, background: '#cc8844' }} title={`Elder: ${e}`} />
          </div>
        )
      })()}
      <div className={`flex gap-3 px-4 ${compact ? 'py-1.5' : 'py-3'}`}>
      {!compact && (
        <div className="shrink-0 pt-0.5">
          <CreaturePortrait blueprint={bp} size={40} />
        </div>
      )}
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
            {bp.minViablePopulation && alive < bp.minViablePopulation && alive > 0 && (
              <span style={{ color: '#ff4444', marginLeft: '4px', fontSize: '11px' }}>
                ⚠ MVP risk
              </span>
            )}
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
          {(onCompare || onHeatmap) && (
            <div className="flex shrink-0 items-center gap-1">
              {onHeatmap && (
                <button
                  type="button"
                  className="cc-btn"
                  onClick={onHeatmap}
                  aria-pressed={isHeatmap}
                  title={isHeatmap ? 'Turn off heatmap' : 'Show activity heatmap'}
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    padding: '3px 7px',
                    minHeight: 24,
                    borderRadius: 4,
                    border: isHeatmap ? '1px solid var(--cc-pink)' : '1px solid var(--cc-mint-line)',
                    color: isHeatmap ? 'var(--cc-pink)' : 'var(--cc-text-muted)',
                  }}
                >
                  ⬤
                </button>
              )}
              {onCompare && (
                <button
                  type="button"
                  className="cc-btn"
                  onClick={onCompare}
                  aria-label={`Compare ${bp.name}`}
                  title="Pin for comparison"
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    padding: '3px 7px',
                    minHeight: 24,
                    borderRadius: 4,
                    border: isComparePin ? '1px solid var(--cc-gold)' : '1px solid var(--cc-mint-line)',
                    color: isComparePin ? 'var(--cc-gold)' : 'var(--cc-text-muted)',
                  }}
                >
                  ⇄
                </button>
              )}
            </div>
          )}
        </div>

        {!compact && (
          <p style={{ fontSize: 13, color: 'var(--cc-text-muted)', marginTop: 2 }}>{bp.blurb}</p>
        )}

        {!compact && (
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
            {maxGeneration > 1 && ` · ${maxGeneration} generations born here`}
            {bp.body.immuneTo.length > 0 && ` · unburnable`}
            {bp.glow > 0 && ` · glows`}
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
            {bp.symbiosisPartnerId && (() => {
              const partner = blueprints.find(b => b.id === bp.symbiosisPartnerId)
              return partner ? (
                <>
                  <br />
                  <span style={{ color: 'var(--cc-text-muted)', fontSize: 10 }}>
                    Partners with: {partner.name}
                  </span>
                </>
              ) : null
            })()}
            {bp.phenology?.breedingGdd !== undefined && TUNING.seasonAmplitude > 0 && (
              <>
                <br />
                {(() => {
                  const gdd = worldGdd(elapsed)
                  const breedingGdd = bp.phenology!.breedingGdd!
                  const inSeason = gdd >= breedingGdd
                  // Synchrony: 1 = breeds at summer peak (GDD 500), 0 = maximally mismatched
                  const synchrony = Math.round((1 - Math.abs(breedingGdd - 500) / 500) * 100)
                  // For predators: check if any prey species also has a breeding window
                  const preyWithPhenology = eats.filter(e => e.phenology?.breedingGdd !== undefined)
                  const preyOverlap = preyWithPhenology.length > 0
                    ? Math.round(
                        preyWithPhenology.reduce((sum, prey) => {
                          const preyGdd = prey.phenology!.breedingGdd!
                          const overlap = 1 - Math.abs(breedingGdd - preyGdd) / 1000
                          return sum + overlap
                        }, 0) / preyWithPhenology.length * 100
                      )
                    : null
                  return (
                    <>
                      <strong style={{ fontWeight: 600 }}>Breeding season:</strong>{' '}
                      opens at GDD {breedingGdd} · current{' '}
                      <span style={{ color: inSeason ? 'var(--cc-primary)' : 'var(--cc-text-muted)' }}>
                        {gdd}/{1000}{inSeason ? ' ✓ in season' : ''}
                      </span>
                      <br />
                      <strong style={{ fontWeight: 600 }}>Synchrony:</strong>{' '}
                      <span style={{ color: synchrony >= 70 ? 'var(--cc-primary)' : synchrony >= 40 ? 'inherit' : 'var(--cc-text-muted)' }}>
                        {synchrony}%
                      </span>
                      {' '}with summer peak
                      {preyOverlap !== null && (
                        <span style={{ color: 'var(--cc-text-muted)' }}>
                          {' '}· {preyOverlap}% prey overlap
                        </span>
                      )}
                    </>
                  )
                })()}
              </>
            )}
            {bp.invasive && invasionFront[bp.id] && (
              <>
                <br />
                {(() => {
                  const { originX, frontX } = invasionFront[bp.id]
                  const spread = Math.abs(frontX - originX)
                  const pct = Math.round((spread / 672) * 100)
                  return (
                    <>
                      <strong style={{ fontWeight: 600 }}>Invasion origin:</strong>{' '}
                      tile {originX}
                      <br />
                      <strong style={{ fontWeight: 600 }}>Current front:</strong>{' '}
                      tile {frontX} · spread {spread} tiles{' '}
                      <span style={{ color: pct >= 50 ? '#ef4444' : pct >= 25 ? '#f97316' : 'var(--cc-text-muted)' }}>
                        ({pct}% of world)
                      </span>
                    </>
                  )
                })()}
              </>
            )}
          </p>
        )}

        {!compact && traitHistory && traitHistory.length >= 3 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <Sparkline data={traitHistory.map(e => e.speed)} label="speed" />
            <Sparkline data={traitHistory.map(e => e.sight)} label="sight" />
            <Sparkline data={traitHistory.map(e => e.size)} label="size" />
          </div>
        )}

        {!compact && bp.derivedFrom && (
          <div style={{ marginTop: 8 }}>
            <span style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: 'var(--cc-text-muted)',
              display: 'block',
              marginBottom: 4,
            }}>
              Lineage
            </span>
            <LineageTree blueprint={bp} allBlueprints={blueprints} />
          </div>
        )}
      </div>
    </div>
  </li>
  )
}

function ImportSection({ addBlueprint }: { addBlueprint: (bp: import('@/app/micro-land/domain/types').CreatureBlueprint) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleImport() {
    setError(null)
    setSuccess(false)
    try {
      const json = JSON.parse(atob(code.trim()))
      const bp = sanitizeBlueprint(json, { summoned: true })
      addBlueprint(bp)
      setCode('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch {
      setError('Invalid code — paste the full code copied from another world.')
    }
  }

  return (
    <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
      <h3 className="pb-2" style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--cc-text-muted)' }}>
        Import blueprint
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value); setError(null) }}
          placeholder="Paste code here"
          style={{
            flex: 1,
            background: 'var(--cc-panel-bg)',
            border: `1px solid ${error ? 'var(--cc-pink)' : 'var(--cc-mint-line)'}`,
            borderRadius: 4,
            padding: '4px 8px',
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            color: 'var(--cc-text-default)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          className="cc-btn"
          onClick={handleImport}
          disabled={!code.trim()}
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            letterSpacing: 1,
            textTransform: 'uppercase',
            padding: '4px 10px',
            border: '1px solid var(--cc-mint-line)',
            color: success ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
          }}
        >
          {success ? 'Added!' : 'Import'}
        </button>
      </div>
      {error && (
        <p style={{ fontSize: 10, color: 'var(--cc-pink)', marginTop: 4 }}>{error}</p>
      )}
    </section>
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
/**
 * A tiny inline SVG line graph showing a trait's drift over the last N samples.
 *
 * Lines are mint when the trait has drifted > 0.15 from its first recorded value,
 * dimmed otherwise — the point is to surface meaningful evolution, not noise.
 */
function Sparkline({
  data,
  label,
}: {
  data: number[]
  label: string
}) {
  if (data.length < 3) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 0.001
  const W = 56
  const H = 16
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 2) - 1}`)
    .join(' ')
  const drifted = Math.abs(data[data.length - 1] - data[0]) > 0.15
  const color = drifted ? 'var(--cc-mint)' : 'rgba(255,255,255,0.3)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg
        width={W}
        height={H}
        style={{ overflow: 'visible' }}
        aria-label={`${label} trend`}
      >
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 8,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: drifted ? 'var(--cc-mint)' : 'rgba(255,255,255,0.35)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature #3121: Food Web Graph
// ---------------------------------------------------------------------------

function deriveTrophicLevel(bp: CreatureBlueprint, allBlueprints: CreatureBlueprint[]): number {
  if (bp.trophicLevel !== undefined) return bp.trophicLevel
  if (isPlantLike(bp)) return 1
  const preyBps = allBlueprints.filter(other => canEat(bp, other))
  if (preyBps.length === 0) return 2
  const eatsPlants = preyBps.some(p => isPlantLike(p))
  const eatsMeat = preyBps.some(p => !isPlantLike(p))
  if (eatsMeat) return 3
  if (eatsPlants) return 2
  return 2
}

function FoodWebGraph({
  blueprints,
  populations,
  foodWeb,
}: {
  blueprints: CreatureBlueprint[]
  populations: Map<string, number>
  foodWeb: Record<string, string[]>
}) {
  const eaterIds = Object.keys(foodWeb)
  if (eaterIds.length === 0) return null

  const allInvolved = new Set<string>()
  for (const [eaterId, preyIds] of Object.entries(foodWeb)) {
    allInvolved.add(eaterId)
    for (const p of preyIds) allInvolved.add(p)
  }

  const bpMap = new Map(blueprints.map(b => [b.id, b]))
  const living = [...allInvolved].filter(id => bpMap.has(id))
  if (living.length === 0) return null

  const levels = new Map<string, number>()
  for (const id of living) {
    const bp = bpMap.get(id)!
    levels.set(id, deriveTrophicLevel(bp, blueprints))
  }

  const byLevel = new Map<number, string[]>()
  for (const [id, lv] of levels.entries()) {
    const lvCapped = Math.min(lv, 3)
    if (!byLevel.has(lvCapped)) byLevel.set(lvCapped, [])
    byLevel.get(lvCapped)!.push(id)
  }

  const W = 280
  const H = 200
  const cx = W / 2
  const cy = H / 2
  const ringRadii: Record<number, number> = { 1: 0, 2: 55, 3: 90 }

  const nodePos = new Map<string, { x: number; y: number }>()
  for (const [lv, ids] of byLevel.entries()) {
    const r = ringRadii[lv] ?? 80
    if (r === 0) {
      ids.forEach((id, i) => {
        const angle = (i / Math.max(ids.length, 1)) * 2 * Math.PI
        const spread = ids.length === 1 ? 0 : 20
        nodePos.set(id, { x: cx + Math.cos(angle) * spread, y: cy + Math.sin(angle) * spread })
      })
    } else {
      ids.forEach((id, i) => {
        const angle = (i / ids.length) * 2 * Math.PI - Math.PI / 2
        nodePos.set(id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r })
      })
    }
  }

  const maxPop = Math.max(...living.map(id => populations.get(id) ?? 0), 1)
  const nodeRadius = (id: string) => 5 + Math.round(((populations.get(id) ?? 0) / maxPop) * 9)
  const levelColor = (lv: number) => lv === 1 ? '#44aa88' : lv === 2 ? '#f5a623' : '#e55'

  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (const [eaterId, preyIds] of Object.entries(foodWeb)) {
    const ePos = nodePos.get(eaterId)
    if (!ePos) continue
    for (const preyId of preyIds) {
      const pPos = nodePos.get(preyId)
      if (!pPos) continue
      edges.push({ x1: ePos.x, y1: ePos.y, x2: pPos.x, y2: pPos.y })
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 180, display: 'block', marginTop: 8 }}
      aria-label="Food web graph"
    >
      <defs>
        <marker id="fw-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(255,255,255,0.22)" />
        </marker>
      </defs>
      {[55, 90].map(r => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          markerEnd="url(#fw-arrow)"
        />
      ))}
      {living.map(id => {
        const pos = nodePos.get(id)
        if (!pos) return null
        const lv = levels.get(id) ?? 2
        const bp = bpMap.get(id)
        const r = nodeRadius(id)
        const bpColor = bp ? (Object.values(bp.art.palette)[0] ?? levelColor(lv)) : levelColor(lv)
        return (
          <g key={id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={r}
              fill={bpColor}
              fillOpacity={0.82}
              stroke={levelColor(lv)}
              strokeWidth={1.5}
            />
            <text
              x={pos.x}
              y={pos.y + r + 9}
              textAnchor="middle"
              fontSize={7}
              fill="rgba(255,255,255,0.55)"
              fontFamily="var(--cc-font-mono)"
            >
              {(bp?.name ?? id).slice(0, 11)}
            </text>
          </g>
        )
      })}
      <g transform={`translate(4, ${H - 26})`}>
        {[
          { label: 'Producer', color: '#44aa88' },
          { label: 'Herbivore', color: '#f5a623' },
          { label: 'Carnivore', color: '#e55' },
        ].map(({ label, color }, i) => (
          <g key={label} transform={`translate(${i * 76}, 0)`}>
            <circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.8} />
            <text x={13} y={9} fontSize={7} fill="rgba(255,255,255,0.4)" fontFamily="var(--cc-font-mono)">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Feature #3126: Succession Progress Bar
// ---------------------------------------------------------------------------

function SuccessionBar({
  blueprints,
  populations,
  elapsed,
}: {
  blueprints: CreatureBlueprint[]
  populations: Map<string, number>
  elapsed: number
}) {
  let totalWeight = 0
  let weightedStage = 0
  for (const bp of blueprints) {
    if (bp.successionStage === undefined) continue
    const pop = populations.get(bp.id) ?? 0
    if (pop === 0) continue
    totalWeight += pop
    weightedStage += bp.successionStage * pop
  }

  let avgStage: number
  if (totalWeight > 0) {
    avgStage = weightedStage / totalWeight
  } else {
    if (elapsed < 300) avgStage = 1
    else if (elapsed < 900) avgStage = 1 + (elapsed - 300) / 600
    else if (elapsed < 2400) avgStage = 2 + (elapsed - 900) / 1500
    else avgStage = Math.min(4, 3 + (elapsed - 2400) / 2400)
  }

  const progress = Math.min(1, Math.max(0, (avgStage - 1) / 3))
  const stageName =
    avgStage < 1.5 ? 'Pioneer'
    : avgStage < 2.5 ? 'Early Succession'
    : avgStage < 3.5 ? 'Mid-Succession'
    : 'Climax'

  if (elapsed < 5 && totalWeight === 0) return null

  return (
    <section className="px-4 py-3" style={{ borderTop: '1px solid var(--cc-panel-divider)' }}>
      <h3 className="pb-2" style={sectionHeading}>
        Succession
      </h3>
      <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', marginBottom: 8 }}>
        The ecosystem&rsquo;s position on the pioneer-to-climax continuum.
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--cc-font-mono)', letterSpacing: 1, textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 4 }}>
        <span>Pioneer</span>
        <span>Climax</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{
          background: 'linear-gradient(to right, #44aa88, #8bc34a)',
          width: `${Math.max(4, progress * 100)}%`,
          height: '100%',
          borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: 'var(--cc-mint)', fontFamily: 'var(--cc-font-mono)', letterSpacing: 0.5 }}>
          {stageName}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Pioneer', 'Early', 'Mid', 'Climax'] as const).map((name, i) => {
            const stageNum = i + 1
            const active = Math.round(avgStage) === stageNum
            return (
              <span key={name} style={{
                fontSize: 8,
                fontFamily: 'var(--cc-font-mono)',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: active ? 'var(--cc-mint)' : 'rgba(255,255,255,0.22)',
              }}>
                {name}
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Feature #3167: Evolutionary Lineage Tree
// ---------------------------------------------------------------------------

function LineageTree({
  blueprint,
  allBlueprints,
}: {
  blueprint: CreatureBlueprint
  allBlueprints: CreatureBlueprint[]
}) {
  const bpMap = new Map(allBlueprints.map(b => [b.id, b]))
  const chain: CreatureBlueprint[] = []
  const seen = new Set<string>([blueprint.id])
  let current: CreatureBlueprint | undefined = blueprint
  while (current?.derivedFrom) {
    const parent = bpMap.get(current.derivedFrom)
    if (!parent || seen.has(parent.id)) break
    seen.add(parent.id)
    chain.unshift(parent)
    current = parent
  }

  if (chain.length === 0) {
    return (
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--cc-font-mono)' }}>
        Origin species
      </span>
    )
  }

  return (
    <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontFamily: 'var(--cc-font-mono)' }}>
      {chain.map(ancestor => (
        <span key={ancestor.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{ancestor.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>›</span>
        </span>
      ))}
      <strong style={{ color: 'var(--cc-mint)', fontWeight: 600 }}>{blueprint.name}</strong>
    </div>
  )
}

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

function ComparisonPanel({
  bpA,
  bpB,
  onDismiss,
}: {
  bpA: CreatureBlueprint
  bpB: CreatureBlueprint
  onDismiss: () => void
}) {
  // Traits to compare as numeric multipliers
  const TRAIT_KEYS: Array<{ key: keyof Traits; label: string }> = [
    { key: 'speed', label: 'Speed' },
    { key: 'sight', label: 'Sight' },
    { key: 'lifespan', label: 'Lifespan' },
    { key: 'roam', label: 'Roam' },
    { key: 'size', label: 'Size' },
    { key: 'territorial', label: 'Territorial' },
    { key: 'cooperation', label: 'Cooperation' },
    { key: 'camouflage', label: 'Camouflage' },
    { key: 'toxicity', label: 'Toxicity' },
  ]

  // Use traitDefaults if set by builder/workshop; otherwise neutral
  const getTraitVal = (bp: CreatureBlueprint, key: keyof Traits): number => {
    const v = bp.traitDefaults?.[key]
    if (v !== undefined) return v as number
    // Neutral defaults per trait
    if (key === 'territorial') return 0.5
    if (key === 'camouflage') return 0.2
    if (key === 'toxicity') return 0
    if (key === 'cooperation') return 0.3
    return 1
  }

  const mono: React.CSSProperties = {
    fontFamily: 'var(--cc-font-mono)',
    fontSize: 10,
    letterSpacing: 0.5,
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between pb-2">
        <span style={{ ...mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cc-text-muted)' }}>
          Comparing
        </span>
        <button type="button" className="cc-btn" onClick={onDismiss}
          style={{ fontFamily: 'var(--cc-font-mono)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
            padding: '2px 8px', border: '1px solid var(--cc-panel-divider)', color: 'var(--cc-text-muted)' }}>
          Dismiss
        </button>
      </div>

      {/* Species name header */}
      <div className="grid gap-1 pb-2" style={{ gridTemplateColumns: '90px 1fr 1fr' }}>
        <div />
        <div style={{ ...mono, color: 'var(--cc-mint)', textTransform: 'uppercase', fontSize: 9, letterSpacing: 1 }}>
          {bpA.name}
        </div>
        <div style={{ ...mono, color: 'var(--cc-mint)', textTransform: 'uppercase', fontSize: 9, letterSpacing: 1 }}>
          {bpB.name}
        </div>
      </div>

      {/* Categorical rows */}
      {[
        { label: 'Moves', a: bpA.move.kind, b: bpB.move.kind },
        { label: 'Diet', a: bpA.diet.eats.join(', '), b: bpB.diet.eats.join(', ') },
        { label: 'Body size', a: String(bpA.size), b: String(bpB.size) },
      ].map(row => (
        <div key={row.label} className="grid gap-1 py-1" style={{ gridTemplateColumns: '90px 1fr 1fr', borderBottom: '1px solid var(--cc-panel-divider)' }}>
          <span style={{ ...mono, fontSize: 9, color: 'var(--cc-text-muted)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>{row.label}</span>
          <span style={{ ...mono, color: row.a !== row.b ? 'var(--cc-text-default)' : 'var(--cc-text-muted)' }}>{row.a}</span>
          <span style={{ ...mono, color: row.a !== row.b ? 'var(--cc-text-default)' : 'var(--cc-text-muted)' }}>{row.b}</span>
        </div>
      ))}

      {/* Numeric trait rows */}
      {TRAIT_KEYS.map(({ key, label }) => {
        const a = getTraitVal(bpA, key)
        const b = getTraitVal(bpB, key)
        const diff = Math.abs(a - b)
        const notable = diff > 0.1
        return (
          <div key={key} className="grid gap-1 py-1" style={{ gridTemplateColumns: '90px 1fr 1fr', borderBottom: '1px solid var(--cc-panel-divider)' }}>
            <span style={{ ...mono, fontSize: 9, color: 'var(--cc-text-muted)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
            <span style={{
              ...mono,
              color: notable ? (a > b ? 'var(--cc-mint)' : 'var(--cc-pink)') : 'var(--cc-text-muted)',
            }}>
              {a.toFixed(2)}{notable && a > b ? ' ▲' : notable && a < b ? ' ▼' : ''}
            </span>
            <span style={{
              ...mono,
              color: notable ? (b > a ? 'var(--cc-mint)' : 'var(--cc-pink)') : 'var(--cc-text-muted)',
            }}>
              {b.toFixed(2)}{notable && b > a ? ' ▲' : notable && b < a ? ' ▼' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

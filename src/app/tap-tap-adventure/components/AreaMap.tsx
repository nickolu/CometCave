'use client'

/**
 * The map of this country, drawn in ink on paper. Landmarks are small circles
 * with their names beside them (hollow once explored, a "?" while unknown),
 * the one dotted line is your road to where you are heading, the target is
 * ringed in the stamp's red, and region exits are arrows at the edge. Under
 * the sheet the same places are printed as a list, nearest first, so a place
 * can be picked by name as well as by eye.
 */

import { type DiscoveryTier, discoveryTier } from '@/app/tap-tap-adventure/lib/discovery'
import { euclidean } from '@/app/tap-tap-adventure/lib/movementUtils'
import { RegionGlyph } from '@/app/tap-tap-adventure/stage/glyphs'
import { PlaybillCaption, PlaybillLine, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'

import type { ReactNode } from 'react'

interface AreaMapLandmark {
  index: number
  name: string
  icon: string
  position: { x: number; y: number }
  explored: boolean
  hidden: boolean
  /** Named by a map or chart: drawn at any distance. */
  mapped?: boolean
  hasShop: boolean
}

interface AreaMapExit {
  index: number
  name: string
  icon: string
  position: { x: number; y: number }
}

interface AreaMapProps {
  playerPosition: { x: number; y: number }
  landmarks: AreaMapLandmark[]
  exits: AreaMapExit[]
  activeTargetIndex: number
  regionBounds: { width: number; height: number }
  regionName: string
  regionIcon: string
  /** When given, the region's drawn glyph is printed instead of the icon text. */
  regionId?: string
  onSelectTarget: (index: number) => void
  /** A place a map just put on the sheet: ringed in gold and stamped New until the drawer closes. */
  highlightIndex?: number | null
  compact?: boolean
}

function getDiscoveryTier(distance: number, lm: Pick<AreaMapLandmark, 'explored' | 'hidden' | 'mapped'>): DiscoveryTier {
  return discoveryTier(distance, { explored: lm.explored, hidden: lm.hidden, mapped: lm.mapped ?? false })
}

// Scale a world coordinate to SVG viewBox (500x500)
function toSVG(val: number, worldSize: number): number {
  return (val / worldSize) * 500
}

const INK = 'var(--ps-ink)'
const INK_SOFT = 'var(--ps-ink-soft)'
const INK_FAINT = 'var(--ps-ink-faint)'
const PAPER = 'var(--ps-playbill)'
const RED = 'var(--ps-stamp-red)'
const GOLD = 'var(--ps-stamp-gold)'
const LABEL_FONT = 'var(--font-playbill)'

/** Where a label sits so it stays on the sheet: to the right unless the node is near the right edge. */
function labelSide(x: number): { dx: number; anchor: 'start' | 'end' } {
  return x > 360 ? { dx: -12, anchor: 'end' } : { dx: 12, anchor: 'start' }
}

/** A clickable spot on the map: keyboard reachable, named for a screen reader. */
function Spot({ label, active, onSelect, children }: { label: string; active: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{ cursor: 'pointer' }}
      className="rounded-[3px] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
    >
      <title>{label}</title>
      {children}
    </g>
  )
}

export function AreaMap({
  playerPosition,
  landmarks,
  exits,
  activeTargetIndex,
  regionBounds,
  regionName,
  regionIcon,
  regionId,
  onSelectTarget,
  highlightIndex = null,
  compact = false,
}: AreaMapProps) {
  const worldW = regionBounds.width || 500
  const worldH = regionBounds.height || 500

  // Scale factors for converting km distances to SVG units
  const scaleX = 500 / worldW
  const scaleY = 500 / worldH
  const avgScale = (scaleX + scaleY) / 2

  const px = toSVG(playerPosition.x, worldW)
  const py = toSVG(playerPosition.y, worldH)

  // Find the active target position in SVG coords
  const allTargets = [
    ...landmarks.map(lm => ({ index: lm.index, position: lm.position })),
    ...exits.map(ex => ({ index: ex.index, position: ex.position })),
  ]
  const activeTarget = allTargets.find(t => t.index === activeTargetIndex)
  const activeTx = activeTarget ? toSVG(activeTarget.position.x, worldW) : null
  const activeTy = activeTarget ? toSVG(activeTarget.position.y, worldH) : null

  // Distance circle radii in SVG units
  const r20 = 20 * avgScale
  const r50 = 50 * avgScale
  const r100 = 100 * avgScale

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <PlaybillCaption className="text-ps-ink">
            {regionId ? <RegionGlyph id={regionId} className="mr-1" /> : <span className="font-body normal-case tracking-normal" aria-hidden>{regionIcon}</span>} {regionName}
          </PlaybillCaption>
          <PlaybillCaption>Tap a place to head there</PlaybillCaption>
        </div>
      )}
      <div className="ps-paper-flat relative w-full overflow-hidden rounded-[3px] border-2 border-ps-ink" style={{ paddingBottom: compact ? '60%' : '100%' }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 500 500"
          role="group"
          aria-label={`Map of ${regionName}`}
        >
          {/* The sheet's inner rule */}
          <rect x="6" y="6" width="488" height="488" fill="none" stroke={INK} strokeOpacity="0.6" strokeWidth="1" />

          {/* How far you can see: 20, 50 and 100 km out */}
          <circle cx={px} cy={py} r={r100} fill="none" stroke={INK_FAINT} strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 6" />
          <circle cx={px} cy={py} r={r50} fill="none" stroke={INK_FAINT} strokeWidth="1" strokeOpacity="0.7" strokeDasharray="2 6" />
          <circle cx={px} cy={py} r={r20} fill="none" stroke={INK_SOFT} strokeWidth="1" strokeOpacity="0.7" strokeDasharray="2 6" />

          {/* Your road to the target */}
          {activeTx !== null && activeTy !== null && (
            <line x1={px} y1={py} x2={activeTx} y2={activeTy} stroke={INK} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
          )}

          {/* Exits: an arrow pointing out of the country */}
          {exits.map(exit => {
            const ex = toSVG(exit.position.x, worldW)
            const ey = toSVG(exit.position.y, worldH)
            const isActive = exit.index === activeTargetIndex
            // Point the arrow away from the middle of the sheet.
            const angle = (Math.atan2(ey - 250, ex - 250) * 180) / Math.PI
            const side = labelSide(ex)

            return (
              <Spot key={`exit-${exit.index}`} label={`${exit.name}${isActive ? ' (heading there)' : ''}`} active={isActive} onSelect={() => onSelectTarget(exit.index)}>
                {isActive && <circle cx={ex} cy={ey} r={15} fill="none" stroke={RED} strokeWidth="2" />}
                <circle cx={ex} cy={ey} r={13} fill={PAPER} fillOpacity="0.8" stroke="none" />
                <g transform={`translate(${ex} ${ey}) rotate(${angle})`} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M-8 0H8" />
                  <path d="M3 -5l5 5-5 5" />
                </g>
                <text
                  x={ex + side.dx}
                  y={ey - 10}
                  textAnchor={side.anchor}
                  fontSize="11"
                  fill={INK}
                  stroke={PAPER}
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ fontFamily: LABEL_FONT }}
                >
                  {exit.icon} {exit.name}
                </text>
              </Spot>
            )
          })}

          {/* Landmarks */}
          {landmarks.map(lm => {
            const lx = toSVG(lm.position.x, worldW)
            const ly = toSVG(lm.position.y, worldH)
            const distance = euclidean(playerPosition, lm.position)
            const tier = getDiscoveryTier(distance, lm)
            const isActive = lm.index === activeTargetIndex
            const isNew = lm.index === highlightIndex
            const side = labelSide(lx)

            if (tier === 'hidden') return null

            if (tier === 'distant') {
              return (
                <Spot key={`lm-${lm.index}`} label={`A distant landmark, about ${Math.round(distance)} km away`} active={isActive} onSelect={() => onSelectTarget(lm.index)}>
                  {isActive && <circle cx={lx} cy={ly} r={15} fill="none" stroke={RED} strokeWidth="2" />}
                  <text x={lx} y={ly + 3} textAnchor="middle" fontSize="14" fill={INK_FAINT} stroke={PAPER}
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ fontFamily: LABEL_FONT }}>
                    …
                  </text>
                </Spot>
              )
            }

            if (tier === 'unknown') {
              return (
                <Spot key={`lm-${lm.index}`} label={`An unknown landmark, about ${Math.round(distance)} km away`} active={isActive} onSelect={() => onSelectTarget(lm.index)}>
                  {isActive && <circle cx={lx} cy={ly} r={15} fill="none" stroke={RED} strokeWidth="2" />}
                  <circle cx={lx} cy={ly} r={8} fill={PAPER} stroke={INK_FAINT} strokeWidth="1.5" strokeDasharray="2 3" />
                  <text x={lx} y={ly + 4} textAnchor="middle" fontSize="12" fill={INK_FAINT} stroke={PAPER}
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ fontFamily: LABEL_FONT }}>
                    ?
                  </text>
                </Spot>
              )
            }

            // revealed
            const label = `${lm.name}${isNew ? ', newly mapped' : ''}${lm.hasShop ? ', has a shop' : ''}${lm.explored ? ', explored' : ''}${isActive ? ' (heading there)' : ''}`
            return (
              <Spot key={`lm-${lm.index}`} label={label} active={isActive} onSelect={() => onSelectTarget(lm.index)}>
                {isNew && (
                  <circle cx={lx} cy={ly} r={22} fill="none" stroke={GOLD} strokeWidth="3" className="animate-pulse motion-reduce:animate-none" />
                )}
                {isActive && <circle cx={lx} cy={ly} r={15} fill="none" stroke={RED} strokeWidth="2" />}
                <circle cx={lx} cy={ly} r={7} fill={lm.explored ? PAPER : INK} stroke={INK} strokeWidth="2" />
                {lm.hasShop && <circle cx={lx} cy={ly} r={2} fill={lm.explored ? INK : PAPER} />}
                <text
                  x={lx + side.dx}
                  y={ly + 4}
                  textAnchor={side.anchor}
                  fontSize="11"
                  fill={lm.explored ? INK_SOFT : INK}
                  stroke={PAPER}
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ fontFamily: LABEL_FONT }}
                >
                  {lm.icon} {lm.name}
                </text>
              </Spot>
            )
          })}

          {/* You: a solid ink dot with a ring */}
          <g aria-label="You are here">
            <title>You are here</title>
            <circle cx={px} cy={py} r={10} fill="none" stroke={INK} strokeWidth="1.5" />
            <circle cx={px} cy={py} r={5} fill={INK} />
          </g>
        </svg>
      </div>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft" aria-label="Key">
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke={INK} strokeWidth="1.2" /><circle cx="6" cy="6" r="2.5" fill={INK} /></svg>
          You
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4" fill={INK} /></svg>
          Not yet seen
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4" fill="none" stroke={INK} strokeWidth="1.5" /></svg>
          Explored
        </li>
        <li className="flex items-center gap-1">
          <span className="font-playbill text-xs normal-case tracking-normal text-ps-ink-faint" aria-hidden>?</span>
          Unknown
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke={RED} strokeWidth="1.5" /></svg>
          Heading there
        </li>
        <li className="flex items-center gap-1">
          <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden><line x1="1" y1="6" x2="17" y2="6" stroke={INK} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" /></svg>
          Your road
        </li>
        <li className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke={INK_SOFT} strokeWidth="1" strokeDasharray="1.5 3" /></svg>
          How far you see
        </li>
        {highlightIndex != null && (
          <li className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke={GOLD} strokeWidth="2" /></svg>
            Newly mapped
          </li>
        )}
      </ul>

      {!compact && (
        <PlacesList
          playerPosition={playerPosition}
          landmarks={landmarks}
          exits={exits}
          activeTargetIndex={activeTargetIndex}
          highlightIndex={highlightIndex}
          onSelectTarget={onSelectTarget}
        />
      )}
    </div>
  )
}

/**
 * The same places as a list, nearest first: the list the road prints when you
 * arrive somewhere, available from the map at any time.
 */
export function PlacesList({
  playerPosition,
  landmarks,
  exits,
  activeTargetIndex,
  highlightIndex = null,
  onSelectTarget,
}: Pick<AreaMapProps, 'playerPosition' | 'landmarks' | 'exits' | 'activeTargetIndex' | 'highlightIndex' | 'onSelectTarget'>) {
  const rows = [
    ...landmarks.map(lm => {
      const km = Math.ceil(euclidean(playerPosition, lm.position))
      return { kind: 'landmark' as const, index: lm.index, km, tier: getDiscoveryTier(km, lm), lm }
    }),
    ...exits.map(exit => ({ kind: 'exit' as const, index: exit.index, km: Math.ceil(euclidean(playerPosition, exit.position)), tier: 'revealed' as DiscoveryTier, exit })),
  ]
    .filter(r => r.tier !== 'hidden')
    .sort((a, b) => a.km - b.km)

  if (rows.length === 0) return null

  return (
    <div>
      <PlaybillCaption className="mb-1.5">Places · tap one to head there</PlaybillCaption>
      <ul className="grid gap-2" aria-label="Places in this country">
        {rows.map(row => {
          const isActive = row.index === activeTargetIndex
          const isNew = row.index === highlightIndex
          const name =
            row.kind === 'exit'
              ? `${row.exit.icon} ${row.exit.name}`
              : row.tier === 'revealed'
                ? `${row.lm.icon} ${row.lm.name}`
                : row.tier === 'unknown'
                  ? 'An unknown landmark'
                  : 'A distant landmark'
          const explored = row.kind === 'landmark' && row.lm.explored
          const hasShop = row.kind === 'landmark' && row.tier === 'revealed' && row.lm.hasShop
          return (
            <li key={`${row.kind}-${row.index}`}>
              <PlaybillLine
                tone={row.kind === 'exit' ? 'quiet' : 'ink'}
                aria-pressed={isActive}
                onClick={() => onSelectTarget(row.index)}
                note={
                  <>
                    {row.km > 0 ? `${row.km} km` : 'Right here'}
                    {row.kind === 'exit' ? ' · leaves this country' : explored ? ' · explored' : ''}
                  </>
                }
                trailing={
                  <>
                    {isNew && <Stamp tone="gold" tilt={false} animate>New</Stamp>}
                    {hasShop && <Stamp tone="gold" tilt={false}>Shop</Stamp>}
                    {isActive && <Stamp tone="red" tilt={false}>Heading there</Stamp>}
                  </>
                }
              >
                {name}
              </PlaybillLine>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

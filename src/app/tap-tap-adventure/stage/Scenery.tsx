'use client'

/**
 * The painted flats behind the actors.
 *
 * Each region is a different set of card flats: a backcloth (sky), a far, a
 * mid and a near flat, and the ground. Shapes are authored per region family
 * and coloured by the `.paper-stage [data-region]` tokens, so a region change
 * is a palette and a silhouette change together. Time of day is a lighting gel
 * over the backcloth; weather is a cut-paper effect on its own flat.
 *
 * The SVG fills the proscenium and keeps its bottom edge pinned (the flats
 * stand on the stage floor whatever the viewport does).
 */
import * as React from 'react'

import type { WeatherId } from '@/app/tap-tap-adventure/config/weather'

type Family = 'hills' | 'forest' | 'crystals' | 'dunes' | 'peaks' | 'shadow' | 'clouds' | 'abyss' | 'throne' | 'ruins' | 'volcano'

const REGION_FAMILY: Record<string, Family> = {
  green_meadows: 'hills',
  dark_forest: 'forest',
  crystal_caves: 'crystals',
  scorched_wastes: 'dunes',
  frozen_peaks: 'peaks',
  shadow_realm: 'shadow',
  sky_citadel: 'clouds',
  abyssal_depths: 'abyss',
  celestial_throne: 'throne',
  sunken_ruins: 'ruins',
  volcanic_forge: 'volcano',
}

/* Every flat is drawn in a 1000 x 500 box with its base on y=500. */
const FLATS: Record<Family, { far: React.ReactNode; mid: React.ReactNode; near: React.ReactNode }> = {
  hills: {
    far: (
      <>
        <path d="M0 360 Q120 300 240 340 T480 330 T720 350 T1000 320 L1000 500 L0 500 Z" />
        <path d="M560 338 L584 290 L608 338 Z" /><path d="M600 332 L622 296 L644 332 Z" />
      </>
    ),
    mid: (
      <>
        <path d="M0 410 Q160 350 320 400 T640 390 T1000 400 L1000 500 L0 500 Z" />
        <path d="M130 392 Q118 360 150 346 Q168 326 190 346 Q216 356 200 386 Q196 396 172 394 Z" /><rect x="162" y="386" width="10" height="36" />
        <path d="M676 386 Q664 350 700 338 Q724 318 748 342 Q776 352 756 382 Q746 392 722 390 Z" /><rect x="712" y="382" width="12" height="40" />
        <path d="M400 404 L430 404 L420 380 L440 380 L428 362 L452 362 L436 338 L416 338 L402 362 L424 362 L410 380 L430 380 Z" />
      </>
    ),
    near: (
      <>
        <path d="M0 455 Q250 420 500 450 T1000 440 L1000 500 L0 500 Z" />
        <path d="M850 436 Q836 392 876 378 Q898 352 924 380 Q956 392 936 428 Q926 440 896 438 Z" /><rect x="884" y="432" width="14" height="48" />
        <path d="M40 442 Q28 404 60 392 Q78 372 100 392 Q126 402 110 436 Q104 446 80 444 Z" /><rect x="68" y="438" width="12" height="44" />
        <path d="M300 468 L320 446 L340 468 Z" /><path d="M330 470 L352 442 L374 470 Z" /><path d="M364 470 L380 452 L396 470 Z" />
      </>
    ),
  },
  forest: {
    far: (
      <g>
        {[40, 140, 240, 340, 440, 540, 640, 740, 840, 940].map(x => (
          <path key={x} d={`M${x - 50} 500 L${x - 50} 300 L${x} 190 L${x + 50} 300 L${x + 50} 500 Z`} />
        ))}
      </g>
    ),
    mid: (
      <g>
        {[0, 180, 360, 540, 720, 900].map(x => (
          <g key={x}>
            <path d={`M${x} 500 L${x} 330 L${x + 60} 240 L${x + 120} 330 L${x + 120} 500 Z`} />
            <rect x={x + 50} y="400" width="20" height="100" />
          </g>
        ))}
      </g>
    ),
    near: (
      <>
        <path d="M0 470 L1000 460 L1000 500 L0 500 Z" />
        <rect x="100" y="250" width="34" height="250" />
        <path d="M60 320 L117 200 L174 320 Z" />
        <rect x="820" y="230" width="38" height="270" />
        <path d="M770 300 L839 170 L908 300 Z" />
      </>
    ),
  },
  crystals: {
    far: (
      <g>
        {[80, 260, 420, 600, 760, 920].map((x, i) => (
          <path key={x} d={`M${x - 30} 500 L${x - 10} ${300 - (i % 2) * 60} L${x + 10} ${260 - (i % 3) * 40} L${x + 30} 500 Z`} />
        ))}
      </g>
    ),
    mid: (
      <g>
        {[160, 360, 540, 720].map((x, i) => (
          <path key={x} d={`M${x - 44} 500 L${x - 20} ${340 - (i % 2) * 40} L${x} ${300 - (i % 2) * 50} L${x + 24} ${350 - i * 10} L${x + 44} 500 Z`} />
        ))}
      </g>
    ),
    near: (
      <>
        <path d="M0 460 L1000 470 L1000 500 L0 500 Z" />
        <path d="M60 500 L100 360 L150 500 Z" />
        <path d="M860 500 L910 330 L960 500 Z" />
      </>
    ),
  },
  dunes: {
    far: <path d="M0 380 Q250 330 500 370 T1000 350 L1000 500 L0 500 Z" />,
    mid: <path d="M0 430 Q200 380 400 420 Q600 460 800 410 Q900 390 1000 420 L1000 500 L0 500 Z" />,
    near: (
      <>
        <path d="M0 470 Q300 440 600 465 T1000 455 L1000 500 L0 500 Z" />
        <path d="M120 470 L132 400 L144 470 Z" /><path d="M110 430 L132 420 L154 430 Z" />
      </>
    ),
  },
  peaks: {
    far: <path d="M0 400 L120 240 L220 330 L340 180 L460 320 L580 220 L700 340 L820 200 L940 330 L1000 290 L1000 500 L0 500 Z" />,
    mid: <path d="M0 440 L160 300 L300 400 L440 280 L600 420 L760 300 L900 410 L1000 360 L1000 500 L0 500 Z" />,
    near: (
      <>
        <path d="M0 480 L1000 470 L1000 500 L0 500 Z" />
        <path d="M0 500 L90 380 L200 500 Z" /><path d="M780 500 L900 360 L1000 500 Z" />
      </>
    ),
  },
  shadow: {
    far: (
      <g>
        {[60, 200, 330, 470, 610, 750, 900].map((x, i) => (
          <path key={x} d={`M${x - 20} 500 L${x - 8} ${260 + (i % 3) * 30} L${x} ${230 + (i % 2) * 50} L${x + 8} ${260 + (i % 3) * 30} L${x + 20} 500 Z`} />
        ))}
      </g>
    ),
    mid: <path d="M0 420 L80 380 L140 410 L260 350 L340 400 L460 340 L560 400 L700 360 L820 400 L920 370 L1000 400 L1000 500 L0 500 Z" />,
    near: (
      <>
        <path d="M0 460 L1000 465 L1000 500 L0 500 Z" />
        <path d="M120 500 L130 330 L136 330 L150 500 Z" /><path d="M100 400 L130 380 L160 400" />
        <path d="M860 500 L870 300 L876 300 L890 500 Z" />
      </>
    ),
  },
  clouds: {
    far: (
      <g>
        <ellipse cx="200" cy="360" rx="140" ry="40" /><ellipse cx="560" cy="330" rx="180" ry="46" /><ellipse cx="880" cy="370" rx="150" ry="42" />
        <rect x="470" y="200" width="60" height="140" /><path d="M460 200 L500 150 L540 200 Z" />
      </g>
    ),
    mid: (
      <g>
        <ellipse cx="120" cy="430" rx="170" ry="50" /><ellipse cx="500" cy="440" rx="220" ry="56" /><ellipse cx="900" cy="425" rx="190" ry="50" />
      </g>
    ),
    near: (
      <>
        <ellipse cx="300" cy="500" rx="300" ry="60" /><ellipse cx="800" cy="505" rx="320" ry="64" />
      </>
    ),
  },
  abyss: {
    far: <path d="M0 380 L1000 380 L1000 500 L0 500 Z" />,
    mid: (
      <g>
        {[120, 300, 520, 700, 880].map((x, i) => (
          <path key={x} d={`M${x} 500 Q${x + 30} ${420 - i * 10} ${x} ${340 - i * 15} Q${x - 30} ${280 - i * 10} ${x + 10} ${200 + i * 20}`} fill="none" stroke="var(--ps-mid)" strokeWidth="14" strokeLinecap="round" />
        ))}
        <path d="M0 450 Q200 420 400 450 T800 440 T1000 450 L1000 500 L0 500 Z" />
      </g>
    ),
    near: (
      <>
        <path d="M0 470 L1000 475 L1000 500 L0 500 Z" />
        <ellipse cx="150" cy="480" rx="90" ry="26" /><ellipse cx="820" cy="484" rx="120" ry="30" />
      </>
    ),
  },
  throne: {
    far: (
      <g>
        {[200, 400, 600, 800].map(x => <rect key={x} x={x - 18} y="200" width="36" height="300" />)}
        <rect x="150" y="190" width="700" height="20" />
      </g>
    ),
    mid: (
      <g>
        <rect x="0" y="420" width="1000" height="80" /><rect x="100" y="390" width="800" height="30" /><rect x="200" y="360" width="600" height="30" />
      </g>
    ),
    near: (
      <>
        <rect x="0" y="470" width="1000" height="30" />
        <path d="M430 470 L430 330 L470 300 L530 300 L570 330 L570 470 Z" />
      </>
    ),
  },
  ruins: {
    far: (
      <g>
        {[120, 240, 420, 560, 760, 900].map((x, i) => <rect key={x} x={x - 16} y={300 + (i % 3) * 40} width="32" height="200" />)}
        <rect x="220" y="300" width="220" height="16" />
      </g>
    ),
    mid: <path d="M0 440 Q200 400 400 440 T800 430 T1000 440 L1000 500 L0 500 Z" />,
    near: (
      <>
        <path d="M0 470 L1000 475 L1000 500 L0 500 Z" />
        <rect x="80" y="330" width="40" height="150" /><rect x="60" y="320" width="80" height="14" />
        <rect x="840" y="360" width="44" height="120" />
      </>
    ),
  },
  volcano: {
    far: <path d="M0 420 L300 400 L420 180 L470 200 L520 170 L640 400 L1000 410 L1000 500 L0 500 Z" />,
    mid: (
      <>
        <path d="M0 450 L1000 440 L1000 500 L0 500 Z" />
        <path d="M470 200 Q480 300 440 360 Q470 420 460 500 L500 500 Q510 420 480 360 Q520 300 500 200 Z" fill="var(--ps-far)" stroke="none" />
      </>
    ),
    near: (
      <>
        <path d="M0 475 L1000 480 L1000 500 L0 500 Z" />
        <path d="M100 500 L140 400 L200 500 Z" /><path d="M820 500 L870 410 L930 500 Z" />
      </>
    ),
  },
}

function Weather({ id }: { id: WeatherId }) {
  switch (id) {
    case 'rain':
    case 'storm':
      return (
        <g stroke="var(--ps-playbill)" strokeOpacity={id === 'storm' ? 0.5 : 0.35} strokeWidth="3" strokeLinecap="round">
          {Array.from({ length: 26 }, (_, i) => (
            <line key={i} x1={i * 40 + 10} y1={(i * 37) % 300} x2={i * 40 - 6} y2={(i * 37) % 300 + 36} />
          ))}
          {id === 'storm' && <path d="M560 60 L520 160 L560 150 L510 260" fill="none" stroke="var(--ps-brass-light)" strokeWidth="6" />}
        </g>
      )
    case 'fog':
      return (
        <g fill="var(--ps-playbill)" fillOpacity="0.28">
          <ellipse cx="300" cy="380" rx="420" ry="50" /><ellipse cx="760" cy="420" rx="380" ry="46" />
        </g>
      )
    case 'blizzard':
      return (
        <g fill="var(--ps-playbill)" fillOpacity="0.8">
          {Array.from({ length: 50 }, (_, i) => (
            <circle key={i} cx={(i * 73) % 1000} cy={(i * 131) % 460} r={2 + (i % 3)} />
          ))}
        </g>
      )
    case 'sandstorm':
      return (
        <g fill="var(--ps-far)" fillOpacity="0.45">
          <path d="M0 200 Q250 140 500 220 T1000 180 L1000 500 L0 500 Z" />
        </g>
      )
    case 'heat_wave':
      return (
        <g fill="none" stroke="var(--ps-playbill)" strokeOpacity="0.35" strokeWidth="3">
          {[120, 170, 220].map(y => (
            <path key={y} d={`M0 ${y} Q125 ${y - 16} 250 ${y} T500 ${y} T750 ${y} T1000 ${y}`} />
          ))}
        </g>
      )
    default:
      return null
  }
}

/**
 * One card flat: the cut shape, drawn twice. The lower copy, offset down and
 * darkened, is the card's thickness; the upper copy carries a pale paper rim
 * along its cut edge. Together they read as stacked card, not one painting.
 */
function Flat({ fill, children, className, style }: { fill: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <g className={className} style={style}>
      <g transform="translate(0 5)" fill="var(--ps-house)" fillOpacity="0.45" stroke="none" aria-hidden>
        {children}
      </g>
      <g fill={fill} stroke="var(--ps-playbill)" strokeOpacity="0.7" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
        {children}
      </g>
    </g>
  )
}

export interface SceneryProps {
  regionId: string
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'nightfall'
  weather: WeatherId
  /** Bump to replay the flats sliding in (a region change). */
  changeKey?: string | number
  /** Bump to nudge the near flat (a step). */
  stepKey?: number
  className?: string
}

export function Scenery({ regionId, timeOfDay, weather, changeKey, stepKey = 0, className }: SceneryProps) {
  const family = REGION_FAMILY[regionId] ?? 'hills'
  const flats = FLATS[family]
  const night = timeOfDay === 'nightfall'
  // Each step nudges the near flat a few px so walking reads as walking.
  const nudge = (stepKey % 4) * 6

  return (
    <svg
      className={className}
      viewBox="0 0 1000 500"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      focusable="false"
    >
      <rect width="1000" height="500" fill="var(--ps-sky)" />
      {/* the sun or moon, cut from paper */}
      {night ? (
        <g fill="var(--ps-playbill)" fillOpacity="0.9">
          <path d="M830 80 A46 46 0 1 0 870 150 A36 36 0 1 1 830 80 Z" />
          {[120, 260, 420, 600, 720, 940].map((x, i) => <circle key={x} cx={x} cy={40 + (i * 29) % 120} r="2.5" />)}
        </g>
      ) : (
        <circle cx={timeOfDay === 'morning' ? 180 : timeOfDay === 'midday' ? 500 : 820} cy={timeOfDay === 'midday' ? 190 : 230} r="44" fill="var(--ps-brass-light)" fillOpacity="0.85" />
      )}
      <Weather id={weather} />
      <Flat key={`far-${changeKey}`} className="ps-flat-in-left" fill="var(--ps-far)">
        {flats.far}
      </Flat>
      <Flat key={`mid-${changeKey}`} className="ps-flat-in-right" fill="var(--ps-mid)">
        {flats.mid}
      </Flat>
      <Flat
        key={`near-${changeKey}`}
        className="ps-flat-in-left transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${-nudge}px)` }}
        fill="var(--ps-near)"
      >
        {flats.near}
      </Flat>
      <rect x="-20" y="486" width="1040" height="30" fill="var(--ps-ground)" />
      {/* time-of-day gel over everything */}
      <rect width="1000" height="500" fill="var(--ps-gel, transparent)" />
    </svg>
  )
}

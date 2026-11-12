'use client'

/**
 * A paper cut-out on a stick: how every person on the stage is drawn.
 *
 * Figures are flat card silhouettes in the cut-out ink with a paper rim, each
 * on a thin stick that rises from below the apron. A figure rocks on its stick
 * when it speaks or strikes (`rock` prop) and the name hangs under it on a
 * small bill. No raster, no emoji: the figure is drawn, the game's own glyph
 * for the person (an NPC icon from config) rides as a small tag on the bill.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

export type CutoutRole = 'hero' | 'npc' | 'party' | 'enemy' | 'boss' | 'mount'

export interface CutoutProps extends React.HTMLAttributes<HTMLDivElement> {
  role: CutoutRole
  name?: string
  /** A glyph from game data (NPC / enemy icon), shown on the name bill. */
  glyph?: string
  facing?: 'left' | 'right'
  /** Bump this key to replay the rock animation. */
  rockKey?: number
  /** Height of the figure in px (stick not included). */
  height?: number
  /** Fade the figure (knocked out, hidden). */
  dim?: boolean
  /** 0..1 fill shown as a small bar on the bill (HP). */
  meter?: number
  meterLabel?: string
}

const FIGURES: Record<CutoutRole, React.ReactNode> = {
  // Shapes drawn in a 60 x 100 box. Ink fill, pale rim.
  hero: (
    <>
      <path d="M22 98 L22 62 L38 62 L38 98 Z" />
      <path d="M14 64 Q14 40 30 38 Q46 40 46 64 L46 70 L14 70 Z" />
      <circle cx="30" cy="24" r="12" />
      <path d="M18 22 Q30 6 44 20 L42 14 Q30 2 18 14 Z" />
      <path d="M46 44 L58 70 L52 72 L42 52 Z" />
      <path d="M14 44 L4 66 L10 68 L18 52 Z" />
    </>
  ),
  npc: (
    <>
      <path d="M20 98 L20 60 L40 60 L40 98 Z" />
      <path d="M12 62 Q12 38 30 36 Q48 38 48 62 L48 72 L12 72 Z" />
      <circle cx="30" cy="22" r="12" />
      <path d="M14 10 L46 10 L42 20 L18 20 Z" />
      <path d="M48 46 L54 74 L48 76 L44 52 Z" />
      <path d="M12 46 L6 74 L12 76 L16 52 Z" />
    </>
  ),
  party: (
    <>
      <path d="M22 98 L22 62 L38 62 L38 98 Z" />
      <path d="M16 64 Q16 42 30 40 Q44 42 44 64 L44 70 L16 70 Z" />
      <circle cx="30" cy="25" r="11" />
      <path d="M44 46 L56 58 L52 64 L42 54 Z" />
      <path d="M16 46 L8 68 L14 70 L20 54 Z" />
    </>
  ),
  enemy: (
    <>
      <path d="M18 98 L18 60 L42 60 L42 98 Z" />
      <path d="M8 64 Q8 34 30 32 Q52 34 52 64 L52 74 L8 74 Z" />
      <circle cx="30" cy="22" r="13" />
      <path d="M18 14 L10 0 L24 10 Z" />
      <path d="M42 14 L50 0 L36 10 Z" />
      <path d="M52 44 L60 72 L54 74 L46 50 Z" />
      <path d="M8 44 L0 72 L6 74 L14 50 Z" />
    </>
  ),
  boss: (
    <>
      <path d="M16 98 L16 58 L44 58 L44 98 Z" />
      <path d="M4 62 Q4 28 30 26 Q56 28 56 62 L56 76 L4 76 Z" />
      <circle cx="30" cy="18" r="14" />
      <path d="M16 10 L4 -4 L22 6 Z" />
      <path d="M44 10 L56 -4 L38 6 Z" />
      <path d="M30 2 L26 -8 L34 -8 Z" />
      <path d="M56 42 L60 76 L52 78 L48 48 Z" />
      <path d="M4 42 L0 76 L8 78 L12 48 Z" />
    </>
  ),
  mount: (
    <>
      <path d="M6 70 Q6 46 24 44 L46 44 Q58 44 58 56 L58 72 L50 72 L50 60 L44 60 L44 98 L36 98 L36 72 L24 72 L24 98 L16 98 L16 72 L6 72 Z" />
      <path d="M46 44 L52 26 L58 30 L56 46 Z" />
      <circle cx="56" cy="24" r="6" />
    </>
  ),
}

export function Cutout({
  role,
  name,
  glyph,
  facing = 'right',
  rockKey = 0,
  height = 120,
  dim = false,
  meter,
  meterLabel,
  className,
  ...rest
}: CutoutProps) {
  const [rocking, setRocking] = React.useState(false)
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setRocking(true)
    const t = setTimeout(() => setRocking(false), 450)
    return () => clearTimeout(t)
  }, [rockKey])

  const isFoe = role === 'enemy' || role === 'boss'
  return (
    <div
      className={cn('pointer-events-none flex flex-col items-center', dim && 'opacity-40 grayscale', className)}
      style={{ width: height * 0.6 + 24 }}
      {...rest}
    >
      <svg
        viewBox="-4 -10 68 112"
        width={height * 0.6 + 8}
        height={height + 10}
        className={cn('overflow-visible', rocking && 'ps-rock', facing === 'left' && '-scale-x-100')}
        aria-hidden
      >
        <g
          fill={isFoe ? 'var(--ps-lacquer-ink)' : 'var(--ps-cutout)'}
          stroke="var(--ps-playbill)"
          strokeWidth="2"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {FIGURES[role]}
        </g>
        {/* the stick */}
        <rect x="28" y="96" width="4" height="30" fill="var(--ps-brass-deep)" />
      </svg>
      {(name || meter != null) && (
        <div className="ps-paper-flat -mt-1 flex max-w-[150px] flex-col items-center rounded-[2px] border border-ps-ink px-2 py-1 text-center">
          {name && (
            <span className="font-playbill text-xs uppercase leading-none tracking-wide text-ps-ink">
              {glyph && <span className="mr-1 font-body normal-case">{glyph}</span>}
              {name}
            </span>
          )}
          {meter != null && (
            <span
              className="mt-1 block h-1.5 w-full min-w-[60px] overflow-hidden rounded-full bg-ps-ink/20"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.max(0, Math.min(1, meter)) * 100)}
              aria-label={meterLabel ?? `${name ?? role} health`}
            >
              <span
                className={cn('block h-full rounded-full', isFoe ? 'bg-ps-stamp-red' : 'bg-ps-stamp-green')}
                style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }}
              />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

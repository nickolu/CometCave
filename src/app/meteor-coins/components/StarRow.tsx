import { PALETTE } from '@/app/meteor-coins/scene/palette'

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'

/**
 * Three stars, earned ones filled and the rest outlined — the difference is
 * in the shape, not only the color. `label` is what a screen reader hears.
 */
export function StarRow({ earned, size, label }: { earned: number; size: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {[1, 2, 3].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path
            d={STAR_PATH}
            fill={n <= earned ? PALETTE.puck : 'none'}
            stroke={n <= earned ? PALETTE.puck : 'currentColor'}
            strokeOpacity={n <= earned ? 1 : 0.5}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  )
}

'use client'


import type { GlyphPos } from '@/app/starmatch/lib/deck'
import styles from '@/app/starmatch/starmatch.module.css'
import type { MatchState } from '@/app/starmatch/useStarmatch'
import { cn } from '@/lib/utils'

interface StarChartProps {
  layout: GlyphPos[]
  symGlyph: string[]
  match: number
  matchState: MatchState
  tone: 'primary' | 'secondary'
  shaking: boolean
  resolving: boolean
  onSelect: (sym: number) => void
  onClearShake: () => void
}

export function StarChart({
  layout,
  symGlyph,
  match,
  matchState,
  tone,
  shaking,
  resolving,
  onSelect,
  onClearShake,
}: StarChartProps) {
  return (
    <div
      className={styles.disc}
      style={{ '--rim': `var(--ds-${tone})` } as React.CSSProperties}
      aria-label="Star chart"
    >
      <div
        className={cn(styles.glyphLayer, shaking && styles.discShake)}
        onAnimationEnd={onClearShake}
      >
        {layout.map((p, i) => {
          const isMatch = p.sym === match
          return (
            <button
              key={i}
              type="button"
              className={cn(
                styles.glyph,
                isMatch && matchState === 'hit' && styles.glyphHit,
                isMatch && matchState === 'reveal' && styles.glyphReveal
              )}
              style={
                {
                  '--x': `${p.x}%`,
                  '--y': `${p.y}%`,
                  '--rot': `${p.rot}deg`,
                  '--scale': p.scale,
                  '--z': i,
                } as React.CSSProperties
              }
              aria-label={`Symbol ${symGlyph[p.sym]}`}
              onClick={() => onSelect(p.sym)}
              disabled={resolving}
            >
              {symGlyph[p.sym]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

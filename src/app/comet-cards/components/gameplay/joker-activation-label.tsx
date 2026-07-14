'use client'

import { useReducedMotion } from 'framer-motion'

export type JokerLabelType = 'chips' | 'mult' | 'xmult' | 'mixed'

interface JokerActivationLabelProps {
  label: string
  activationKey: number
}

/**
 * Derives a label type from the label string for color selection.
 * Checks for prefix patterns: "x" → xmult, "+N chips" → chips, "+N mult" → mult, else mixed.
 */
function getLabelType(label: string): JokerLabelType {
  const trimmed = label.trim()
  if (trimmed.startsWith('x')) return 'xmult'
  if (trimmed.includes('chips') && !trimmed.includes('mult')) return 'chips'
  if (trimmed.includes('mult') && !trimmed.includes('chips')) return 'mult'
  return 'mixed'
}

/**
 * Floating pill that appears above a joker card when it activates during scoring.
 * Animates upward and fades out. Under prefers-reduced-motion, shows a static badge instead.
 */
export function JokerActivationLabel({ label, activationKey }: JokerActivationLabelProps) {
  const reducedMotion = useReducedMotion()
  const type = getLabelType(label)

  const colorMap: Record<JokerLabelType, string> = {
    chips: 'var(--cc-mint)',
    mult: 'var(--cc-pink)',
    xmult: 'var(--cc-gold)',
    mixed: 'var(--cc-mint)',
  }

  const bgMap: Record<JokerLabelType, string> = {
    chips: 'rgba(94, 234, 212, 0.18)',
    mult: 'rgba(255, 107, 157, 0.18)',
    xmult: 'rgba(255, 209, 102, 0.18)',
    mixed: 'rgba(94, 234, 212, 0.12)',
  }

  const color = colorMap[type]
  const bg = bgMap[type]

  if (reducedMotion) {
    // Static badge — no animation, just a visible pill
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          pointerEvents: 'none',
          padding: '2px 7px',
          borderRadius: 999,
          background: bg,
          border: `1px solid ${color}`,
          color,
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
    )
  }

  return (
    <div
      // Use activationKey in the element key (via parent) so React remounts for re-trigger.
      // The aria-hidden prevents screen readers from announcing floating decorations.
      aria-hidden
      key={activationKey}
      className="animate-float-up"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 4px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        pointerEvents: 'none',
        padding: '2px 7px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${color}`,
        color,
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        letterSpacing: 0.3,
        textShadow: `0 0 8px ${color}`,
      }}
    >
      {label}
    </div>
  )
}

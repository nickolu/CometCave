'use client'

import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'

/**
 * Pinned portrait overlay — shown while any creature is inspected.
 *
 * Sits in the top-right corner above the inspector, showing a large scaled-up
 * version of the creature's sprite using the same SVG pixel-art renderer the
 * inspector header uses. The close button dismisses the inspector entirely
 * (same action as the inspector's own X).
 */
export function PinnedPortrait() {
  const inspected = useMicroLand(s => s.inspected)
  const blueprints = useMicroLand(s => s.blueprints)
  const setInspected = useMicroLand(s => s.setInspected)

  if (!inspected) return null

  const bp = blueprints.find(b => b.id === inspected.blueprintId)
  if (!bp) return null

  // Use the first palette color for the border/glow accent.
  const paletteColors = Object.values(bp.art.palette)
  const primaryColor = paletteColors[0] ?? '#888'

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: 60,
        right: 276,
        zIndex: 44,
        background: 'rgba(2, 8, 10, 0.92)',
        border: `1px solid ${primaryColor}55`,
        borderRadius: 8,
        padding: 12,
        width: 120,
        textAlign: 'center',
        fontFamily: 'var(--cc-font-mono)',
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={() => setInspected(null)}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--cc-text-muted)',
          fontSize: 14,
          lineHeight: 1,
        }}
        aria-label="Close portrait"
        onPointerDown={e => e.stopPropagation()}
      >
        ×
      </button>

      {/* Large pixel-art portrait */}
      <div
        style={{
          width: 80,
          height: 80,
          margin: '0 auto 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.35)',
          border: `2px solid ${primaryColor}55`,
          boxShadow: `0 0 12px ${primaryColor}33`,
        }}
      >
        <CreaturePortrait blueprint={bp} size={64} />
      </div>

      {/* Individual name (if any) */}
      {inspected.name && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--cc-text-default)',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {inspected.name}
        </div>
      )}

      {/* Species name */}
      <div
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: primaryColor,
          opacity: 0.85,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {bp.name}
      </div>

      {/* Age */}
      <div style={{ fontSize: 9, color: 'var(--cc-text-muted)', marginTop: 4 }}>
        {Math.floor(inspected.ageSeconds)}s old
      </div>
    </div>
  )
}

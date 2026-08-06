'use client'

import { useMicroLand } from '@/app/micro-land/store'

const MOOD_EMOJI: Record<string, string> = {
  eat: '🌿',
  hunt: '⚔',
  flee: '→',
  mate: '♡',
  rest: '~',
  wander: '·',
}

const MOOD_COLOR: Record<string, string> = {
  eat: '#22c55e',
  hunt: '#ef4444',
  flee: '#f97316',
  mate: '#c084fc',
  rest: '#60a5fa',
  wander: '#94a3b8',
}

export function CreatureTooltip() {
  const hovered = useMicroLand(s => s.hoveredCreature)
  if (!hovered) return null

  const fullness = 1 - hovered.hunger
  const color = MOOD_COLOR[hovered.mood] ?? '#94a3b8'
  const emoji = MOOD_EMOJI[hovered.mood] ?? '·'

  return (
    <div
      style={{
        position: 'fixed',
        left: hovered.screenX + 14,
        top: hovered.screenY - 58,
        pointerEvents: 'none',
        zIndex: 45,
        background: 'rgba(2, 8, 10, 0.9)',
        border: `1px solid ${color}55`,
        borderRadius: 6,
        padding: '5px 9px',
        minWidth: 120,
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 11,
        color: 'var(--cc-text-default)',
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 12, width: 14, textAlign: 'center' }}>{emoji}</span>
        <span style={{ color, fontWeight: 500, flex: 1 }}>{hovered.mood}</span>
        <span style={{ color: 'var(--cc-text-muted)', fontSize: 10, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hovered.name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--cc-text-muted)', width: 38 }}>hunger</span>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${fullness * 100}%`,
              background: fullness > 0.5 ? '#22c55e' : fullness > 0.25 ? '#f59e0b' : '#ef4444',
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </div>
  )
}

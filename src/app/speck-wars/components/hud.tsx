'use client'
import { useSpeckWarsStore } from '../store'
import { PLAYER_COLOR, AI_COLOR } from '../domain/constants'

function colorHex(n: number) {
  return `#${n.toString(16).padStart(6, '0')}`
}

export function HUD() {
  const hud = useSpeckWarsStore(s => s.hud)
  if (!hud) return null

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      fontFamily: 'monospace', fontSize: 13, color: '#fff',
    }}>
      {/* Player stats — bottom left */}
      <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
        {Object.entries(hud.players).map(([pid, data]) => {
          const color = pid === 'player' ? colorHex(PLAYER_COLOR) : colorHex(AI_COLOR)
          const label = pid === 'player' ? 'YOU' : 'AI'
          const totalHp = Object.values(data.buildingHp).reduce((a, b) => a + b, 0)
          return (
            <div key={pid} style={{ marginBottom: 6, color }}>
              <strong>{label}</strong> — specks: {data.speckCount} | bases: {data.buildingCount} | HP: {totalHp}
            </div>
          )
        })}
      </div>
    </div>
  )
}

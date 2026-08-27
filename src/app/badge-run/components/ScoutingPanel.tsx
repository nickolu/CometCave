'use client'
import type { CatalogUnit } from '../domain/unit-catalog'

interface ScoutingPanelProps {
  opponentTeams: CatalogUnit[][]  // one team per round
  currentRound: number            // 1-indexed
}

function getTypeSummary(team: CatalogUnit[]): Array<{ type: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const unit of team) {
    for (const type of unit.types) {
      counts[type] = (counts[type] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

const TYPE_COLORS: Record<string, string> = {
  Fire: '#f5a142',
  Water: '#5b8fe8',
  Grass: '#4ade80',
  Electric: '#f5e642',
  Ice: '#a5f3fc',
  Fighting: '#e57373',
  Poison: '#c084fc',
  Ground: '#c8a16e',
  Flying: '#93c5fd',
  Psychic: '#f472b6',
  Bug: '#a3e635',
  Rock: '#a8956a',
  Ghost: '#818cf8',
  Dragon: '#7c3aed',
  Dark: '#6b7280',
  Steel: '#94a3b8',
  Normal: '#d1d5db',
}

function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? 'rgba(255,255,255,0.5)'
}

export function ScoutingPanel({ opponentTeams, currentRound }: ScoutingPanelProps) {
  return (
    <div role="region" aria-label="Rival scouting — opponent type composition by round">
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 10px', textTransform: 'uppercase' }}>
        Rival scouts
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opponentTeams.map((team, idx) => {
          const round = idx + 1
          const isCurrent = round === currentRound
          const isPast = round < currentRound
          const summary = getTypeSummary(team)

          return (
            <div
              key={round}
              aria-label={`Round ${round} rival: ${summary.map(s => `${s.count} ${s.type}`).join(', ')}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: isCurrent
                  ? 'rgba(124,106,255,0.12)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isCurrent ? 'rgba(124,106,255,0.40)' : 'rgba(255,255,255,0.06)'}`,
                opacity: isPast ? 0.45 : 1,
              }}
            >
              {/* Round number */}
              <span style={{
                fontSize: 11,
                color: isCurrent ? '#7c6aff' : 'rgba(255,255,255,0.65)',
                fontWeight: isCurrent ? 700 : 400,
                minWidth: 28,
                textAlign: 'right',
              }}>
                {round}
              </span>

              {/* Type chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                {summary.map(({ type, count }) => (
                  <span
                    key={type}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: `${typeColor(type)}22`,
                      border: `1px solid ${typeColor(type)}55`,
                      color: typeColor(type),
                      fontWeight: 600,
                    }}
                  >
                    {count > 1 ? `${count}× ` : ''}{type}
                  </span>
                ))}
              </div>

              {/* Current round indicator */}
              {isCurrent && (
                <span style={{ fontSize: 10, color: '#7c6aff', fontWeight: 700, letterSpacing: 0.5 }}>
                  NOW
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

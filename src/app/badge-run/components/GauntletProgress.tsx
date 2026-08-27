'use client'
import { GAUNTLET_SCHEDULE } from '../domain/gauntlet/schedule'
import { BOSS_BOARDS } from '../domain/gauntlet/bosses'

interface GauntletProgressProps {
  currentRound: number
  playerHp: number
  maxHp?: number
}

/** Map arena ID to a short type label for display. */
const ARENA_TYPE_LABELS: Record<string, string> = {
  'rock-tunnel':    'Rock',
  'tidal-shelf':    'Water',
  'storm-plateau':  'Electric',
  'overgrown-ruins':'Grass',
  'poison-marsh':   'Poison',
  'silph-rooftop':  'Psychic',
  'volcanic-cavern':'Fire',
  'excavation-site':'Ground',
  'frozen-pass':    'Ice',
}

const BOSS_NAMES: Record<string, string> = {
  brock:    'Brock',
  misty:    'Misty',
  surge:    'Lt. Surge',
  erika:    'Erika',
  koga:     'Koga',
  sabrina:  'Sabrina',
  blaine:   'Blaine',
  giovanni: 'Giovanni',
  lorelei:  'Lorelei',
  bruno:    'Bruno',
  agatha:   'Agatha',
  lance:    'Lance',
  champion: 'Champion',
}

const TYPE_COLORS: Record<string, string> = {
  Fire:     '#f5a142',
  Water:    '#5b8fe8',
  Grass:    '#4ade80',
  Electric: '#f5e642',
  Ice:      '#a5f3fc',
  Fighting: '#e57373',
  Poison:   '#c084fc',
  Ground:   '#c8a16e',
  Psychic:  '#f472b6',
  Rock:     '#a8956a',
  Ghost:    '#818cf8',
  Dragon:   '#7c3aed',
}

export function GauntletProgress({ currentRound, playerHp, maxHp = 100 }: GauntletProgressProps) {
  return (
    <div role="region" aria-label="Gauntlet schedule — all 29 rounds">
      {/* HP bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            HP
          </span>
          <span style={{ color: playerHp > 30 ? '#4ade80' : '#f87171', fontSize: 13, fontWeight: 700 }}>
            {playerHp} / {maxHp}
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.10)', borderRadius: 3 }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (playerHp / maxHp) * 100)}%`,
            background: playerHp > 30 ? '#4ade80' : '#f87171',
            borderRadius: 3,
            transition: 'width 0.3s, background 0.3s',
          }} />
        </div>
      </div>

      {/* Schedule */}
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' }}>
        Schedule
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {GAUNTLET_SCHEDULE.map(info => {
          const isCurrent = info.round === currentRound
          const isPast = info.round < currentRound
          const isEliteFour = info.round >= 25
          const typeLabel = ARENA_TYPE_LABELS[info.arenaId] ?? info.arenaId
          const color = TYPE_COLORS[typeLabel] ?? 'rgba(255,255,255,0.5)'
          const bossName = info.bossId ? BOSS_NAMES[info.bossId] : null

          // Get boss types from their team
          const bossTypes = info.bossId && BOSS_BOARDS[info.bossId]
            ? [...new Set(BOSS_BOARDS[info.bossId].flatMap(u => u.types))].slice(0, 2)
            : []

          return (
            <div
              key={info.round}
              aria-label={`Round ${info.round}${bossName ? `: ${bossName}` : ''} — ${typeLabel}${isCurrent ? ', current' : isPast ? ', completed' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: info.isBoss ? '8px 10px' : '4px 10px',
                borderRadius: 6,
                background: isCurrent
                  ? 'rgba(124,106,255,0.12)'
                  : info.isBoss
                  ? 'rgba(255,255,255,0.04)'
                  : 'transparent',
                border: isCurrent
                  ? '1px solid rgba(124,106,255,0.40)'
                  : info.isBoss
                  ? '1px solid rgba(255,255,255,0.10)'
                  : '1px solid transparent',
                opacity: isPast ? 0.40 : 1,
              }}
            >
              {/* Round number */}
              <span style={{
                fontSize: 10,
                color: isCurrent ? '#7c6aff' : 'rgba(255,255,255,0.45)',
                fontWeight: isCurrent ? 700 : 400,
                minWidth: 20,
                textAlign: 'right',
              }}>
                {info.round}
              </span>

              {/* Boss name or free-round dot */}
              {info.isBoss ? (
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: 12,
                    color: '#fff',
                    fontWeight: 700,
                  }}>
                    {isEliteFour ? '⬡ ' : ''}{bossName}
                  </span>
                  {!info.draftEnabled && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', marginLeft: 6 }}>
                      (no draft)
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                  ·
                </span>
              )}

              {/* Type chips for boss rounds, or type label for free rounds */}
              {info.isBoss && bossTypes.length > 0 ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  {bossTypes.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: `${TYPE_COLORS[t] ?? 'rgba(255,255,255,0.3)'}22`,
                        color: TYPE_COLORS[t] ?? 'rgba(255,255,255,0.7)',
                        border: `1px solid ${TYPE_COLORS[t] ?? 'rgba(255,255,255,0.3)'}44`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : !info.isBoss ? (
                <span style={{ fontSize: 10, color: `${color}99`, padding: '1px 5px' }}>
                  {typeLabel}
                </span>
              ) : null}

              {isCurrent && (
                <span style={{ fontSize: 10, color: '#7c6aff', fontWeight: 700 }}>◀</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

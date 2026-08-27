'use client'
import { useBlitzStore } from '../store'
import { ARENA_SCHEDULE, getArena } from '../domain/data/arenas'

export function DraftScreen() {
  const { run, pick } = useBlitzStore()
  if (!run || !run.offers) return null

  const arenaId = ARENA_SCHEDULE[(run.round - 1) % ARENA_SCHEDULE.length]
  const arena = getArena(arenaId)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 24, maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: 2, margin: 0, textTransform: 'uppercase' }}>
          Round {run.round} of 8
        </p>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '4px 0 0', letterSpacing: 1 }}>
          {arena?.name ?? arenaId}
        </h2>
        {arena && arena.houseRules.length > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0 0' }}>
            {arena.houseRules.join(' · ')}
          </p>
        )}
      </div>

      {run.team.length > 0 && (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 1, margin: '0 0 6px', textTransform: 'uppercase' }}>
            Your team
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>
            {run.team.map(u => u.name).join(' · ')}
          </p>
        </div>
      )}

      <div>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 1, margin: '0 0 12px', textTransform: 'uppercase' }}>
          Choose one
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {run.offers.map((unit) => (
            <button
              key={unit.dexId}
              onClick={() => pick(unit.dexId)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '14px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#fff',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{unit.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>{unit.tier}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {unit.types.map(t => (
                  <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                    {t}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{unit.kin}</span>
              </div>
              {unit.signatureMove && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>
                  {unit.signatureMove}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

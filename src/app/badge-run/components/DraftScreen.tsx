'use client'
import { useBlitzStore } from '../store'
import { ARENA_SCHEDULE, getArena } from '../domain/data/arenas'
import { computeInterest } from '../domain/economy/gold'
import { REROLL_COST, XP_COST, XP_TO_NEXT_LEVEL, maxSlotsForLevel } from '../domain/shop/tier-odds'

export function DraftScreen() {
  const { run, pick, reroll, buyXP } = useBlitzStore()
  if (!run || !run.offers) return null

  const arenaId = ARENA_SCHEDULE[(run.round - 1) % ARENA_SCHEDULE.length]
  const arena = getArena(arenaId)
  const interest = computeInterest(run.gold)
  const xpToNextLevel = XP_TO_NEXT_LEVEL[run.level] ?? null
  const xpProgress = xpToNextLevel ? run.xp / xpToNextLevel : 1
  const canReroll = run.gold >= REROLL_COST
  const canBuyXP = run.gold >= XP_COST
  const maxSlots = maxSlotsForLevel(run.level)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 20, maxWidth: 640, margin: '0 auto', width: '100%' }}>

      {/* Header: Round + Arena */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, letterSpacing: 2, margin: 0, textTransform: 'uppercase' }}>
          Round {run.round} of 8
        </p>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '4px 0 0', letterSpacing: 1 }}>
          {arena?.name ?? arenaId}
        </h2>
        {arena && arena.houseRules.length > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '4px 0 0' }}>
            {arena.houseRules.join(' · ')}
          </p>
        )}
      </div>

      {/* Economy bar: Gold + Level + XP */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Gold */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, letterSpacing: 1, margin: '0 0 2px', textTransform: 'uppercase' }}>Gold</p>
          <p style={{ color: '#f5c542', fontSize: 22, fontWeight: 700, margin: 0 }}>{run.gold}g</p>
          {interest > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '2px 0 0' }}>+{interest} interest</p>
          )}
        </div>

        {/* Level + XP */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, letterSpacing: 1, margin: '0 0 2px', textTransform: 'uppercase' }}>Level</p>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>{run.level}</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '2px 0 0' }}>
            {maxSlots} slot{maxSlots !== 1 ? 's' : ''}
            {xpToNextLevel ? ` · ${run.xp}/${xpToNextLevel} XP` : ' · Max level'}
          </p>
          {xpToNextLevel && (
            <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, marginTop: 6 }}>
              <div style={{ height: '100%', width: `${Math.min(100, xpProgress * 100)}%`, background: '#7c6aff', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>
      </div>

      {/* Shop actions: Reroll + Buy XP */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="br-btn"
          onClick={reroll}
          disabled={!canReroll}
          aria-label={`Reroll offers for ${REROLL_COST} gold`}
          style={{
            flex: 1,
            background: canReroll ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${canReroll ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 8,
            padding: '10px 12px',
            cursor: canReroll ? 'pointer' : 'not-allowed',
            color: canReroll ? '#fff' : 'rgba(255,255,255,0.30)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Reroll</span>
          <span style={{ fontSize: 11, color: canReroll ? '#f5c542' : 'rgba(255,255,255,0.30)', marginLeft: 6 }}>{REROLL_COST}g</span>
        </button>

        <button
          className="br-btn"
          onClick={buyXP}
          disabled={!canBuyXP || run.level >= 10}
          aria-label={`Buy XP for ${XP_COST} gold`}
          style={{
            flex: 1,
            background: (canBuyXP && run.level < 10) ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${(canBuyXP && run.level < 10) ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 8,
            padding: '10px 12px',
            cursor: (canBuyXP && run.level < 10) ? 'pointer' : 'not-allowed',
            color: (canBuyXP && run.level < 10) ? '#fff' : 'rgba(255,255,255,0.30)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{run.level >= 10 ? 'Max level' : 'Buy XP'}</span>
          {run.level < 10 && <span style={{ fontSize: 11, color: (canBuyXP) ? '#f5c542' : 'rgba(255,255,255,0.30)', marginLeft: 6 }}>{XP_COST}g</span>}
        </button>
      </div>

      {/* Team */}
      {run.team.length > 0 && (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 6px', textTransform: 'uppercase' }}>
            Your team ({run.team.length}/{maxSlots})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {run.team.map(u => (
              <span key={u.dexId} style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', background: 'rgba(255,255,255,0.07)', padding: '3px 8px', borderRadius: 6 }}>
                {u.name}
                {(run.boardLevels[u.dexId] ?? 0) > 0 && (
                  <span style={{ color: '#7c6aff', marginLeft: 4, fontSize: 10 }}>Lv.{run.boardLevels[u.dexId]}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Offers */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 12px', textTransform: 'uppercase' }}>
          Choose one
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {run.offers.map((unit) => (
            <button
              key={unit.dexId}
              className="br-btn"
              onClick={() => pick(unit.dexId)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#fff',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{unit.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: 1 }}>{unit.tier}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {unit.types.map(t => (
                  <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                    {t}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{unit.kin}</span>
              </div>
              {unit.signatureMove && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', margin: '4px 0 0' }}>
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

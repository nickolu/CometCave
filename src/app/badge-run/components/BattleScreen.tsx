'use client'
import { useBlitzStore } from '../store'
import { ScoutingPanel } from './ScoutingPanel'

function effectivenessLabel(e: number): { text: string; color: string } | null {
  if (e >= 2) return { text: 'Super effective!', color: '#f5c542' }
  if (e === 0) return { text: 'No effect', color: '#555' }
  if (e < 1) return { text: 'Not very effective', color: '#888' }
  return null
}

export function BattleScreen() {
  const { run, battle, evolve } = useBlitzStore()
  if (!run) return null

  const result = run.lastBattleResult

  // Show fight button if no result yet or still in battle phase
  if (!result || run.phase === 'battle') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Round {run.round}</h2>
        <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: 14, margin: 0 }}>
          Your team enters the arena.
        </p>
        {/* Rival type preview for this round */}
        <ScoutingPanel
          opponentTeams={run.opponentTeams}
          currentRound={run.round}
        />
        <button
          className="br-btn"
          onClick={battle}
          style={{ padding: '12px 32px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600, letterSpacing: 1 }}
        >
          Fight
        </button>
      </div>
    )
  }

  // Render battle log
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 16, maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
        Battle Log — Round {run.round}
      </h2>
      <div role="log" aria-live="polite" aria-label="Battle events" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'monospace', fontSize: 12 }}>
        {result.events.map((ev, i) => {
          if (ev.type === 'synergy_applied') {
            return (
              <div key={i} style={{ color: '#8ab4f8', padding: '1px 0' }}>
                synergy {ev.synergyId}: {ev.effect}
              </div>
            )
          }
          if (ev.type === 'arena_tick' && ev.affectedUnitIds.length > 0) {
            return (
              <div key={i} style={{ color: '#c084fc', padding: '1px 0' }}>
                [arena] {ev.rule} → {ev.affectedUnitIds.length} affected
              </div>
            )
          }
          if (ev.type === 'unit_acts') {
            return (
              <div key={i} style={{ color: 'rgba(255,255,255,0.8)', padding: '1px 0' }}>
                {ev.actorId} uses {ev.moveName} on {ev.targetId}
              </div>
            )
          }
          if (ev.type === 'damage') {
            const label = effectivenessLabel(ev.effectiveness)
            return (
              <div key={i} style={{ color: 'rgba(255,255,255,0.70)', padding: '1px 0 1px 12px' }}>
                {ev.amount} dmg
                {label && (
                  <span style={{ color: label.color, marginLeft: 8 }}>{label.text}</span>
                )}
              </div>
            )
          }
          if (ev.type === 'faint') {
            return (
              <div key={i} style={{ color: '#f87171', padding: '1px 0 1px 12px' }}>
                {ev.unitId} fainted
              </div>
            )
          }
          if (ev.type === 'battle_end') {
            const won = ev.winnerId === result.config.attackerTeamId
            return (
              <div key={i} style={{ color: won ? '#4ade80' : '#f87171', fontWeight: 700, padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
                {won ? 'Victory' : 'Defeat'} — {result.totalTurns} turns
              </div>
            )
          }
          return null
        })}
      </div>
      <button
        className="br-btn"
        onClick={run.phase === 'evolve' ? evolve : undefined}
        style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: run.phase === 'evolve' ? 'pointer' : 'default', fontSize: 14, alignSelf: 'center' }}
      >
        {run.phase === 'evolve' ? 'Evolve and continue' : 'Continue'}
      </button>
    </div>
  )
}

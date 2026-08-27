'use client'
import { useBlitzStore } from '../store'

export function BattleScreen() {
  const { run, battle, evolve } = useBlitzStore()
  if (!run) return null

  if (run.phase === 'evolve') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Victory!</h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0 }}>
          Your champion evolves.
        </p>
        <button onClick={evolve} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>
          Continue
        </button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Battle!</h2>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0 }}>
        Round {run.round} — your team faces the arena.
      </p>
      <button onClick={battle} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>
        Fight
      </button>
    </div>
  )
}

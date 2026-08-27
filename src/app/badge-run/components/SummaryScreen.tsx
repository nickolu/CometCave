'use client'
import { useBlitzStore } from '../store'

export function SummaryScreen() {
  const { run, reset } = useBlitzStore()
  if (!run) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>
        {run.won ? 'Champion!' : 'Defeated'}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 320 }}>
        {run.won
          ? `You conquered all 8 rounds. Your team: ${run.team.map(u => u.name).join(', ')}.`
          : `Fell in round ${run.round}. Your team: ${run.team.map(u => u.name).join(', ')}.`
        }
      </p>
      <button onClick={reset} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>
        Try again
      </button>
    </div>
  )
}

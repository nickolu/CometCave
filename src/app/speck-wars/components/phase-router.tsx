'use client'
import { useSpeckWarsStore } from '../store'

export function PhaseRouter({ children }: { children: React.ReactNode }) {
  const { phase, winnerId, setPhase } = useSpeckWarsStore()

  if (phase === 'menu') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <h1 style={{ color: '#fff', fontSize: 48, margin: 0 }}>Speck Wars</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Destroy the enemy base. Last base standing wins.</p>
        <button
          onClick={() => setPhase('playing')}
          style={{ padding: '12px 32px', fontSize: 18, cursor: 'pointer', background: '#4af7c4', border: 'none', borderRadius: 8, fontWeight: 'bold' }}
        >
          Play
        </button>
      </div>
    )
  }

  if (phase === 'victory' || phase === 'defeat') {
    const won = winnerId === 'player'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <h1 style={{ color: won ? '#4af7c4' : '#ff4f7b', fontSize: 48 }}>{won ? 'Victory' : 'Defeated'}</h1>
        <button onClick={() => window.location.reload()} style={{ padding: '12px 32px', fontSize: 18, cursor: 'pointer' }}>
          Play Again
        </button>
      </div>
    )
  }

  // 'playing' — render game + HUD overlay
  return <>{children}</>
}

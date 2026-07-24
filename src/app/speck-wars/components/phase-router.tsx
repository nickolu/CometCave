'use client'
import { useSpeckWarsStore } from '../store'

export function PhaseRouter({ children }: { children: React.ReactNode }) {
  const { phase, winnerId, setPhase, difficulty, setDifficulty } = useSpeckWarsStore()

  const difficulties: Array<{ key: 'easy' | 'medium' | 'hard'; label: string; color: string }> = [
    { key: 'easy', label: 'Easy', color: '#44ff88' },
    { key: 'medium', label: 'Medium', color: '#ffcc44' },
    { key: 'hard', label: 'Hard', color: '#ff4f7b' },
  ]

  if (phase === 'menu') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <h1 style={{ color: '#fff', fontSize: 48, margin: 0 }}>Speck Wars</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Destroy the enemy base. Last base standing wins.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {difficulties.map(d => (
            <button
              key={d.key}
              onClick={() => setDifficulty(d.key)}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                cursor: 'pointer',
                border: `2px solid ${difficulty === d.key ? d.color : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 6,
                background: difficulty === d.key ? `${d.color}22` : 'transparent',
                color: difficulty === d.key ? d.color : 'rgba(255,255,255,0.5)',
                fontWeight: difficulty === d.key ? 'bold' : 'normal',
                transition: 'all 0.15s',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
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

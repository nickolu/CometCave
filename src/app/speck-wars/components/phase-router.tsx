'use client'
import { useState, useEffect } from 'react'
import { useSpeckWarsStore } from '../store'
import { getBestTime, getWinStreak, getRecentResults } from '../lib/personal-best'
import type { Difficulty } from '../store'

export function PhaseRouter({ children }: { children: React.ReactNode }) {
  const { phase, winnerId, setPhase, difficulty, setDifficulty, elapsedMs, resetGame, kills, losses, isNewBest, victoryType, hud } = useSpeckWarsStore()
  const [copied, setCopied] = useState(false)
  const [bestTimes, setBestTimes] = useState<Partial<Record<Difficulty, number>>>({})
  const [winStreak, setWinStreak] = useState(0)

  useEffect(() => {
    if (phase === 'menu') {
      setBestTimes({
        easy: getBestTime('easy') ?? undefined,
        medium: getBestTime('medium') ?? undefined,
        hard: getBestTime('hard') ?? undefined,
      })
      setWinStreak(getWinStreak())
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'menu') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') setPhase('playing')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, setPhase])

  const difficulties: Array<{ key: 'easy' | 'medium' | 'hard' | 'very-hard'; label: string; color: string }> = [
    { key: 'easy', label: 'Easy', color: '#44ff88' },
    { key: 'medium', label: 'Medium', color: '#ffcc44' },
    { key: 'hard', label: 'Hard', color: '#ff4f7b' },
    { key: 'very-hard', label: 'Brutal', color: '#cc00ff' },
  ]

  if (phase === 'menu') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <h1 style={{ color: '#fff', fontSize: 48, margin: 0 }}>Speck Wars</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Destroy the enemy base. Last base standing wins.</p>
        {winStreak >= 2 && (
          <div style={{ color: '#ffd700', fontSize: 14, letterSpacing: 2, fontWeight: 'bold' }}>
            🔥 {winStreak} WIN STREAK
          </div>
        )}
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
        {/* Best times per difficulty */}
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {difficulties.map(d => {
            const best = bestTimes[d.key]
            if (!best) return null
            const mm = String(Math.floor(Math.floor(best / 1000) / 60)).padStart(2, '0')
            const ss = String(Math.floor(best / 1000) % 60).padStart(2, '0')
            return (
              <span key={d.key} style={{ color: d.color, opacity: 0.6 }}>
                {d.label}: {mm}:{ss}
              </span>
            )
          })}
        </div>
        <button
          onClick={() => setPhase('playing')}
          style={{ padding: '12px 32px', fontSize: 18, cursor: 'pointer', background: '#4af7c4', border: 'none', borderRadius: 8, fontWeight: 'bold' }}
        >
          Play
        </button>
        {/* Controls hint */}
        <div style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 24px',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 11,
          letterSpacing: 0.5,
          textAlign: 'left',
          maxWidth: 280,
        }}>
          <span>🖱 Click — rally specks</span>
          <span>Space — pause</span>
          <span>Scroll — zoom</span>
          <span>R — clear rally</span>
          <span>Drag — pan camera</span>
          <span>H — heavy/basic mode</span>
          <span>A — advance to outpost</span>
          <span>B — rush enemy base</span>
          <span>C — center on base</span>
          <span>D — defend base</span>
          <span>Minimap — click to rally</span>
        </div>
      </div>
    )
  }

  if (phase === 'victory' || phase === 'defeat') {
    const won = winnerId === 'player'
    const accentColor = won ? '#4af7c4' : '#ff4f7b'

    const totalSec = Math.floor(elapsedMs / 1000)
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    const timeStr = `${mm}:${ss}`

    const difficultyColors: Record<string, string> = { easy: '#44ff88', medium: '#ffcc44', hard: '#ff4f7b', 'very-hard': '#cc00ff' }
    const diffLabel = difficulty === 'very-hard' ? 'Brutal' : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
    const diffColor = difficultyColors[difficulty]
    const playerBaseHp = hud?.players?.player?.buildingHp?.['building-player-base'] ?? 0
    const baseHpFrac = playerBaseHp / 100
    const stars = won
      ? baseHpFrac > 0.75 ? 3 : baseHpFrac > 0.5 ? 2 : 1
      : 0

    const nextDifficulty: Partial<Record<string, { key: Difficulty; label: string; color: string }>> = {
      easy:   { key: 'medium',    label: 'Medium', color: '#ffcc44' },
      medium: { key: 'hard',      label: 'Hard',   color: '#ff4f7b' },
      hard:   { key: 'very-hard', label: 'Brutal', color: '#cc00ff' },
    }
    const nextDiff = won ? nextDifficulty[difficulty] : null

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const shareText = won
      ? `I defeated the AI in Speck Wars (${diffLabel}) in ${timeStr} — killed ${kills} specks! 🎮 Daily map ${today} — can you beat my time?`
      : `The AI beat me in Speck Wars (${diffLabel}) in ${timeStr} — killed ${kills} specks. 🎮 Daily map ${today} — think you can do better?`

    const handleShare = async () => {
      const url = typeof window !== 'undefined' ? window.location.href : ''
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: 'Speck Wars', text: shareText, url })
        } catch {
          // user cancelled — no action needed
        }
      } else {
        await navigator.clipboard.writeText(`${shareText} ${url}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 20,
        fontFamily: 'monospace',
      }}>
        <h1 style={{ color: accentColor, fontSize: 64, margin: 0, letterSpacing: 4 }}>
          {won ? 'VICTORY' : 'DEFEATED'}
        </h1>
        {victoryType && (
          <div style={{
            fontSize: 12, letterSpacing: 3, opacity: 0.6,
            color: victoryType === 'domination' ? '#ffd700' : accentColor,
            textTransform: 'uppercase',
          }}>
            {victoryType === 'domination' ? '⬡ by Domination' : '💥 by Destruction'}
          </div>
        )}
        {won && (
          <div style={{ fontSize: 28, letterSpacing: 4, color: '#ffd700', textShadow: stars === 3 ? '0 0 20px #ffd700' : 'none' }}>
            {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </div>
        )}
        {won && isNewBest && (
          <div style={{ color: '#ffd700', fontSize: 14, letterSpacing: 3, fontWeight: 'bold', textShadow: '0 0 16px #ffd700' }}>
            NEW BEST TIME
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>
          <span>⏱ {timeStr}</span>
          <span style={{ color: diffColor, fontWeight: 'bold', border: `1px solid ${diffColor}`, padding: '2px 10px', borderRadius: 4 }}>
            {diffLabel}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 28, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          <span style={{ color: '#4af7c4' }}>↑ {kills} killed</span>
          <span style={{ color: '#ff4f7b' }}>↓ {losses} lost</span>
          {kills + losses > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              {Math.round((kills / (kills + losses)) * 100)}% efficiency
            </span>
          )}
        </div>

        {/* Recent run history for this difficulty */}
        {(() => {
          const history = getRecentResults(difficulty)
          if (history.length < 2) return null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.3)' }}>
                RECENT ({difficulty.toUpperCase()})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {history.map((r, i) => {
                  const mm = String(Math.floor(Math.floor(r.timeMs / 1000) / 60)).padStart(2, '0')
                  const ss = String(Math.floor(r.timeMs / 1000) % 60).padStart(2, '0')
                  return (
                    <div key={i} title={`${r.won ? 'Win' : 'Loss'} — ${mm}:${ss} — ${r.kills} kills`} style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: r.won ? '#4af7c4' : '#ff4f7b',
                      opacity: i === 0 ? 1 : 0.4 + (history.length - i) / history.length * 0.4,
                    }} />
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={resetGame}
            style={{
              padding: '12px 28px', fontSize: 16, cursor: 'pointer',
              background: accentColor, border: 'none', borderRadius: 8,
              fontWeight: 'bold', color: '#000',
            }}
          >
            Play Again
          </button>
          <button
            onClick={handleShare}
            style={{
              padding: '12px 28px', fontSize: 16, cursor: 'pointer',
              background: 'transparent', border: `2px solid ${accentColor}`,
              borderRadius: 8, color: accentColor,
            }}
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
          <a
            href="/"
            style={{
              padding: '12px 28px', fontSize: 16, cursor: 'pointer',
              background: 'transparent', border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: 8, color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
              display: 'flex', alignItems: 'center',
            }}
          >
            ← Cave
          </a>
        </div>
        {nextDiff && (
          <button
            onClick={() => { setDifficulty(nextDiff.key); resetGame(); setPhase('playing') }}
            style={{
              padding: '8px 24px', fontSize: 13, cursor: 'pointer',
              background: 'transparent',
              border: `1px solid ${nextDiff.color}`,
              borderRadius: 6, color: nextDiff.color, opacity: 0.8,
              letterSpacing: 1,
            }}
          >
            Try {nextDiff.label} →
          </button>
        )}
      </div>
    )
  }

  // 'playing' — render game + HUD overlay
  return <>{children}</>
}

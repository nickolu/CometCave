'use client'
import { useState, useEffect } from 'react'
import { useSpeckWarsStore } from '../store'
import { getBestTime, getWinStreak, getRecentResults, hasWonToday } from '../lib/personal-best'
import type { Difficulty } from '../store'

export function PhaseRouter({ children }: { children: React.ReactNode }) {
  const { phase, winnerId, setPhase, difficulty, setDifficulty, elapsedMs, resetGame, kills, losses, isNewBest, victoryType, hud, peakArmySize, outpostsCaptured } = useSpeckWarsStore()
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

  useEffect(() => {
    if (phase !== 'victory' && phase !== 'defeat') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        resetGame()
        setPhase('playing')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, resetGame, setPhase])

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
          {difficulties.map(d => {
            const wonToday = hasWonToday(d.key)
            return (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                style={{
                  padding: '8px 20px',
                  fontSize: 14,
                  cursor: 'pointer',
                  border: `2px solid ${difficulty === d.key ? d.color : wonToday ? `${d.color}66` : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: 6,
                  background: difficulty === d.key ? `${d.color}22` : 'transparent',
                  color: difficulty === d.key ? d.color : wonToday ? `${d.color}99` : 'rgba(255,255,255,0.5)',
                  fontWeight: difficulty === d.key ? 'bold' : 'normal',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {d.label}
                {wonToday && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    fontSize: 10, background: d.color, color: '#000',
                    borderRadius: '50%', width: 14, height: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold',
                  }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
        {/* Best times + win rates per difficulty */}
        <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
          {difficulties.map(d => {
            const best = bestTimes[d.key]
            const history = getRecentResults(d.key)
            const wins = history.filter(r => r.won).length
            if (!best && history.length === 0) return null
            const mm = best ? String(Math.floor(Math.floor(best / 1000) / 60)).padStart(2, '0') : null
            const ss = best ? String(Math.floor(best / 1000) % 60).padStart(2, '0') : null
            return (
              <span key={d.key} style={{ color: d.color, opacity: 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {mm && <span>{d.label}: {mm}:{ss}</span>}
                {history.length > 0 && (
                  <span style={{ opacity: 0.7, fontSize: 10, letterSpacing: 1 }}>
                    {wins}/{history.length} W
                  </span>
                )}
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
          maxWidth: 320,
        }}>
          <span>🖱 Click — rally specks</span>
          <span>Space — pause / ? — help</span>
          <span>Shift+drag — box select</span>
          <span>1/2/3 — spawn basic/heavy/scout</span>
          <span>Q — surge (2× spawn 8s)</span>
          <span>V — snap to battle</span>
          <span>A — advance · B — rush · D — defend</span>
          <span>X — game speed · E — select all</span>
          <span>Minimap — click to rally</span>
          <span>C — center camera</span>
        </div>
        {/* Daily tip */}
        {(() => {
          const tips = [
            'Hold all 3 outposts for 60s to win by Domination.',
            'Scouts (3) auto-target outposts — fast but fragile.',
            'Veterans deal +20% damage after 3 kills. Protect them!',
            'Fortify outposts by holding them 30s for a combat bonus.',
            'Surge (Q) doubles production for 8s — use it before big pushes.',
            'Box-select (Shift+drag) specks and right-click to send them anywhere.',
            'Rally Cry: base below 25% HP activates 1.5× spawn automatically.',
            'Heavy specks deal 2× damage but produce 2× slower.',
            'V key snaps the camera to where fighting is happening.',
            'Press ? in-game to see all hotkeys.',
          ]
          const tip = tips[Math.floor(Date.now() / 86400000) % tips.length]
          return (
            <div style={{
              marginTop: 8, maxWidth: 320,
              fontSize: 11, letterSpacing: 0.3,
              color: 'rgba(255,215,0,0.45)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}>
              💡 {tip}
            </div>
          )
        })()}
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
    const starStr = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '✗✗✗'
    const modifier = hud?.dailyModifier && hud.dailyModifier !== 'standard' ? ` [${hud.dailyModifier.toUpperCase()}]` : ''
    const effPct = kills + losses > 0 ? Math.round((kills / (kills + losses)) * 100) : 0
    const statsLine = `⚔ ${kills} kills · ${losses} lost · ${effPct}% eff${peakArmySize > 0 ? ` · peak ${peakArmySize}` : ''}`
    const shareText = won
      ? `${starStr} Speck Wars ${today}${modifier}\nVICTORY in ${timeStr} (${diffLabel})\n${statsLine}\nCan you do better? `
      : `${starStr} Speck Wars ${today}${modifier}\nDEFEATED in ${timeStr} (${diffLabel})\n${statsLine}\nThink you can win? `

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              fontSize: 12, letterSpacing: 3, opacity: 0.6,
              color: victoryType === 'domination' ? '#ffd700' : accentColor,
              textTransform: 'uppercase',
            }}>
              {victoryType === 'domination' ? '⬡ by Domination'
                : victoryType === 'surrender' ? '🏳 Surrendered'
                : '💥 by Destruction'}
            </div>
            <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.35, color: '#fff' }}>
              {won
                ? victoryType === 'domination'
                  ? 'held all 3 outposts for 60 seconds'
                  : 'destroyed the enemy base'
                : victoryType === 'surrender'
                  ? 'you chose to give up'
                  : victoryType === 'domination'
                    ? 'enemy held all 3 outposts for 60 seconds'
                    : 'your base was destroyed'
              }
            </div>
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
        {won && winStreak >= 2 && (
          <div style={{ color: '#ffd700', fontSize: 13, letterSpacing: 2 }}>
            🔥 {winStreak}-WIN STREAK
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>⏱ {timeStr}</span>
          <span style={{ color: diffColor, fontWeight: 'bold', border: `1px solid ${diffColor}`, padding: '2px 10px', borderRadius: 4 }}>
            {diffLabel}
          </span>
          {hud?.dailyModifier && hud.dailyModifier !== 'standard' && (
            <span style={{
              fontSize: 11, letterSpacing: 1.5,
              color: hud.dailyModifier === 'bulwark' ? '#44aaff'
                : hud.dailyModifier === 'blitz' ? '#ffd700'
                : '#ff8844',
              border: `1px solid ${hud.dailyModifier === 'bulwark' ? '#44aaff44' : hud.dailyModifier === 'blitz' ? '#ffd70044' : '#ff884444'}`,
              padding: '2px 8px', borderRadius: 4,
            }}>
              {hud.dailyModifier.toUpperCase()}
            </span>
          )}
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

        {(peakArmySize > 0 || outpostsCaptured > 0) && (
          <div style={{ display: 'flex', gap: 28, color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: 0.5 }}>
            {peakArmySize > 0 && (
              <span>⚔ peak {peakArmySize} specks</span>
            )}
            {outpostsCaptured > 0 && (
              <span>⬡ {outpostsCaptured} outpost{outpostsCaptured !== 1 ? 's' : ''} captured</span>
            )}
          </div>
        )}

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

        {/* Contextual tactical tip */}
        {(() => {
          const eff = kills + losses > 0 ? kills / (kills + losses) : 0
          const modifier = hud?.dailyModifier ?? 'standard'
          let tip: string | null = null

          if (won && elapsedMs < 180000) {
            tip = difficulty === 'very-hard' ? '⚡ Incredible! That was master-level play.' : 'That was fast! Try a harder difficulty for more of a challenge.'
          } else if (won && difficulty !== 'very-hard' && stars === 3) {
            tip = `Perfect stars on ${diffLabel}! Ready to try ${nextDiff?.label ?? 'the next level'}?`
          } else if (!won && kills < 30) {
            tip = 'Tip: Scouts are fast and great for outpost rushes — press 3 to switch spawn type.'
          } else if (!won && eff < 0.4) {
            tip = 'Tip: Heavy specks deal 2× damage — switch with key 2 during big fights.'
          } else if (!won && elapsedMs > 300000) {
            tip = 'Tip: Press Q for Surge — doubles production for 8s. Use it when you\'re behind!'
          } else if (!won) {
            tip = 'Tip: Press F to sacrifice 10 specks and repair your base when HP is critical.'
          } else if (won && modifier === 'siege') {
            tip = '⬡ Siege modifier won — outposts were twice as hard to capture. Nice patience!'
          }

          if (!tip) return null
          return (
            <div style={{
              maxWidth: 340, textAlign: 'center',
              fontSize: 11, letterSpacing: 0.5,
              color: 'rgba(255,255,255,0.5)',
              fontStyle: 'italic',
              padding: '8px 16px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
            }}>
              {tip}
            </div>
          )
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
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
          <span style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.25)' }}>
            Enter / Space — play again
          </span>
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

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSpeckWarsStore } from '../store'
import { getBestTime, getWinStreak, getRecentResults, hasWonToday, getLifetimeStats } from '../lib/personal-best'
import { getDailyInfo } from '../lib/daily-modifier'
import type { Difficulty } from '../store'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { LEVELS, saveLevelStars } from '../campaign/levels'

export function PhaseRouter({ children }: { children: React.ReactNode }) {
  const { phase, winnerId, setPhase, difficulty, setDifficulty, elapsedMs, resetGame, kills, losses, isNewBest, hud, fogEnabled, setFogEnabled, mapPreset, setMapPreset, campaignLevel, setCampaignLevel } = useSpeckWarsStore()
  const [copied, setCopied] = useState(false)
  const [bestTimes, setBestTimes] = useState<Partial<Record<Difficulty, number>>>({})
  const [winStreak, setWinStreak] = useState(0)
  const [lifetimeStats, setLifetimeStats] = useState({ gamesPlayed: 0, totalKills: 0, bestStreak: 0 })
  const { user } = useAuth()
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
  const router = useRouter()

  // Auto-start when launched from campaign
  useEffect(() => {
    if (phase === 'menu' && campaignLevel !== null) {
      setPhase('playing')
    }
  }, [phase, campaignLevel, setPhase])

  useEffect(() => {
    if (phase === 'menu') {
      setBestTimes({
        easy: getBestTime('easy') ?? undefined,
        medium: getBestTime('medium') ?? undefined,
        hard: getBestTime('hard') ?? undefined,
      })
      setWinStreak(getWinStreak())
      setLifetimeStats(getLifetimeStats())
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

  useEffect(() => {
    if (phase === 'victory') {
      navigator.vibrate?.([40, 80, 40, 80, 120])  // ascending triple-pulse: celebration
    } else if (phase === 'defeat') {
      navigator.vibrate?.([200, 60, 80])  // heavy thud then short pulse: loss
    }
  }, [phase])

  // Save campaign stars when victory/defeat reached
  useEffect(() => {
    if ((phase !== 'victory' && phase !== 'defeat') || campaignLevel === null) return
    const won = winnerId === 'player'
    const playerBaseHp = hud?.players?.player?.buildingHp?.['building-player-base'] ?? 0
    const baseHpFrac = playerBaseHp / 100
    const levelCfg = LEVELS.find(l => l.id === campaignLevel)
    if (!levelCfg) return
    const starsEarned = won
      ? (baseHpFrac >= levelCfg.starThresholds.three ? 3
        : baseHpFrac >= levelCfg.starThresholds.two ? 2 : 1)
      : 0
    saveLevelStars(campaignLevel, starsEarned)
  }, [phase, campaignLevel, winnerId, hud])

  const difficulties: Array<{ key: 'easy' | 'medium' | 'hard' | 'very-hard'; label: string; color: string; desc: string }> = [
    { key: 'easy', label: 'Easy', color: '#44ff88', desc: 'slow AI · player spawn bonus' },
    { key: 'medium', label: 'Medium', color: '#ffcc44', desc: 'standard challenge' },
    { key: 'hard', label: 'Hard', color: '#ff4f7b', desc: 'fast AI · waves enabled' },
    { key: 'very-hard', label: 'Brutal', color: '#cc00ff', desc: 'relentless flood · waves' },
  ]

  if (phase === 'menu') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, overflowY: 'auto', padding: '16px 0' }}>
        <h1 style={{ color: '#fff', fontSize: 48, margin: 0 }}>Speck Wars</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Destroy the enemy base — or hold all 3 outposts for 60 seconds.</p>
        {winStreak >= 2 && (
          <div style={{ color: '#ffd700', fontSize: 14, letterSpacing: 2, fontWeight: 'bold' }}>
            🔥 {winStreak} WIN STREAK
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {difficulties.map(d => {
            const wonToday = hasWonToday(d.key)
            return (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                style={{
                  padding: isTouchDevice ? '8px 20px' : '6px 16px',
                  fontSize: 14,
                  cursor: 'pointer',
                  border: `2px solid ${difficulty === d.key ? d.color : wonToday ? `${d.color}66` : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: 6,
                  background: difficulty === d.key ? `${d.color}22` : 'transparent',
                  color: difficulty === d.key ? d.color : wonToday ? `${d.color}99` : 'rgba(255,255,255,0.5)',
                  fontWeight: difficulty === d.key ? 'bold' : 'normal',
                  transition: 'all 0.15s',
                  position: 'relative',
                  minHeight: 44,
                  flex: isTouchDevice ? '1 1 calc(50% - 8px)' : undefined,
                  maxWidth: isTouchDevice ? 160 : undefined,
                }}
              >
                {d.label}
                <span style={{
                  display: 'block',
                  fontSize: isTouchDevice ? 11 : 9,
                  fontWeight: 'normal',
                  opacity: difficulty === d.key ? 0.7 : 0.4,
                  letterSpacing: 0.3,
                  marginTop: 2,
                }}>
                  {d.desc}
                </span>
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
        {/* Daily info row — map layout */}
        {(() => {
          const { layoutName } = getDailyInfo(difficulty)
          return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
              <div style={{
                fontSize: 10, letterSpacing: 1,
                color: 'rgba(255,255,255,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '3px 8px', borderRadius: 4,
              }}>
                ⬡ {layoutName}
              </div>
            </div>
          )
        })()}
        {/* Layout strategy tip */}
        {(() => {
          const { layoutName } = getDailyInfo(difficulty)
          const layoutTips: Record<string, string> = {
            Triangle: 'Triangle: the top outpost commands the map — contest it early for reach to both flanks.',
            Corridor: 'Corridor: fight hard for the middle outpost, it splits the lane and cuts off retreats.',
            Wings: 'Wings: forces split attention — consider scouting both flanks before committing.',
          }
          const tip = layoutTips[layoutName]
          if (!tip) return null
          return (
            <div style={{
              fontSize: 10, letterSpacing: 0.3,
              color: 'rgba(255,255,255,0.28)',
              textAlign: 'center',
              fontStyle: 'italic',
              maxWidth: 280,
            }}>
              {tip}
            </div>
          )
        })()}
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
        {lifetimeStats.gamesPlayed > 0 && (
          <div style={{
            display: 'flex', gap: 20, fontSize: 10, letterSpacing: 1,
            color: 'rgba(255,255,255,0.3)',
          }}>
            <span>{lifetimeStats.gamesPlayed} games</span>
            <span>{lifetimeStats.totalKills.toLocaleString()} kills</span>
            {lifetimeStats.bestStreak >= 2 && (
              <span>best {lifetimeStats.bestStreak}-win streak</span>
            )}
          </div>
        )}
        {/* Fog of war toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <button
            onClick={() => setFogEnabled(!fogEnabled)}
            title="Fog of War: hides enemy specks and buildings outside your vision (specks 150px · base 300px · outposts 180px)"
            style={{
              padding: '4px 14px',
              fontSize: 12,
              cursor: 'pointer',
              border: `1px solid ${fogEnabled ? '#44aaff' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 4,
              background: fogEnabled ? 'rgba(68,170,255,0.12)' : 'transparent',
              color: fogEnabled ? '#44aaff' : 'rgba(255,255,255,0.4)',
              letterSpacing: 0.5,
              minHeight: 44,
            }}
          >
            {fogEnabled ? '🌫 Fog of War: ON' : '🌫 Fog of War: OFF'}
          </button>
        </div>
        {/* Map preset selector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1 }}>MAP</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {([
              { key: 'random', label: '🎲 Daily', desc: 'procedural' },
              { key: 'open',   label: '□ Open',  desc: 'no walls' },
              { key: 'canyon', label: '═ Canyon', desc: 'twin walls' },
              { key: 'river',  label: '| River',  desc: 'center gap' },
              { key: 'pillars',label: '⊞ Pillars',desc: '5 columns' },
              { key: 'walls',  label: '⌐ Walls',  desc: 'zigzag' },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                title={desc}
                onClick={() => setMapPreset(key)}
                style={{
                  padding: isTouchDevice ? '8px 12px' : '4px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  border: `1px solid ${mapPreset === key ? '#ffcc44' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 4,
                  background: mapPreset === key ? 'rgba(255,204,68,0.12)' : 'transparent',
                  color: mapPreset === key ? '#ffcc44' : 'rgba(255,255,255,0.4)',
                  letterSpacing: 0.3,
                  minHeight: isTouchDevice ? 44 : 36,
                  transition: 'all 0.15s',
                  lineHeight: 1.3,
                }}
              >
                <div>{label}</div>
                {isTouchDevice && <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: 0.5 }}>{desc}</div>}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setPhase('playing')}
          style={{
            padding: isTouchDevice ? '16px 48px' : '12px 32px',
            fontSize: isTouchDevice ? 20 : 18,
            cursor: 'pointer', background: '#4af7c4', border: 'none',
            borderRadius: 8, fontWeight: 'bold',
            minHeight: 56, minWidth: isTouchDevice ? 200 : undefined,
          }}
        >
          Play
        </button>
        {/* Controls hint */}
        {!isTouchDevice && (
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
            <span>🖱 Click building → click map — set its rally</span>
            <span>Space — pause / ? — help</span>
            <span>Drag — box select specks</span>
            <span>1/2/3 — spawn basic/heavy/dart</span>
            <span style={{ gridColumn: 'span 2', color: 'rgba(255,255,255,0.2)' }}>↳ heavy beats basic · dart beats heavy · basic beats dart</span>
            <span>Q — surge (2× spawn 8s · 45s CD)</span>
            <span>V — snap to recent kills</span>
            <span>A(+click) — attack-move · N — advance · B — rush · D — defend</span>
            <span>X — speed · E — all · Esc — clear</span>
            <span>Ctrl+4-9 save group · 4-9 recall</span>
            <span>Minimap — left-click to rally</span>
            <span>Scroll — zoom · Shift+scroll — pan</span>
            <span>Arrow keys / W S — pan</span>
          </div>
        )}
        {isTouchDevice && (
          <div style={{
            marginTop: 16,
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '4px 24px',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 11, letterSpacing: 0.5,
            textAlign: 'left', maxWidth: 320,
          }}>
            <span>👆 Tap building → tap map — set its rally</span>
            <span>⏸ Pause button — pause game</span>
            <span>👆 Long-press canvas — attack-move</span>
            <span>⬡ ALL button — select all specks</span>
            <span>👌 Pinch — zoom · Drag — pan</span>
            <span>⌂ HOME · ⚔ FIGHT — snap camera</span>
            <span>🗺 Tap minimap — navigate camera</span>
            <span>? button — touch controls help</span>
          </div>
        )}
        {/* Daily tip */}
        {(() => {
          const tips = isTouchDevice ? [
            'Capture outposts to boost your production.',
            'Your specks gather at the building that made them — tap a building, then tap the map to send them somewhere.',
            'Types counter each other: heavy beats basic, dart beats heavy, basic beats dart.',
            'Veterans deal +20% damage after 3 kills. Protect them!',
            'Fortify outposts by holding them 30s — nearby specks deal +25% damage within 200px.',
            'Tap ★ SURGE for 2× production 8s — use it before big pushes.',
            'Select specks, then tap the map to move them · long-press to attack-move (fight en route).',
            'Heavy specks deal 2× damage but produce 2× slower. Mix types wisely.',
            'Tap ⚔ FIGHT to snap the camera to where the fighting is happening.',
            'Tap ? in-game to see all touch controls.',
            'Tap ⬡ ALL to select all your specks, then tap canvas to rally them together.',
            'Long-press canvas then lift — specks fight enemies on the way (attack-move).',
            'Tap Hold in the unit panel to make selected specks defend a position.',
            'Elite specks (6+ kills): +35% damage and deal AoE splash nearby. Legend (12+): +50% and larger splash.',
            'Friendly outposts give a +35% speed boost to nearby specks — holding them accelerates your attacks.',
            'A ◇ Hero auto-spawns from your base — 4× HP and 1.5× damage. Keep it alive; it gets stronger with kills.',
            'Outposts regen 2 HP/s when not under attack — fall back, let them heal, then re-contest.',
          ] : [
            'Capture outposts to boost your production.',
            'Your specks gather at the building that made them — click a building, then click the map to set its rally point.',
            'Types counter each other: heavy beats basic, dart beats heavy, basic beats dart.',
            'Veterans deal +20% damage after 3 kills. Protect them!',
            'Fortify outposts by holding them 30s — nearby specks deal +25% damage within 200px.',
            'Surge (Q) doubles production for 8s — use it before big pushes.',
            'Drag to box-select specks, then click anywhere to rally only your selection.',
            'Heavy specks deal 2× damage but produce 2× slower. Mix types wisely.',
            'V key snaps the camera to recent kill positions — find the heat of battle.',
            'Press ? in-game to see all hotkeys.',
            'Control groups: box-select specks, Ctrl+4 to save, press 4 to recall.',
            'Hold A then left-click to issue an attack-move — specks fight enemies en route.',
            'H key makes selected specks hold position — great for defending a chokepoint.',
            'Elite specks (6+ kills): +35% damage and deal AoE splash nearby. Legend (12+): +50% and larger splash.',
            'Friendly outposts give a +35% speed boost to nearby specks — holding them accelerates your attacks.',
            'A ◇ Hero auto-spawns from your base — 4× HP and 1.5× damage. Keep it alive; it gets stronger with kills.',
            'Outposts regen 2 HP/s when not under attack — fall back, let them heal, then re-contest.',
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

    // Campaign mode: level config and star tracking
    const levelConfig = campaignLevel ? LEVELS.find(l => l.id === campaignLevel) ?? null : null
    const campaignStarsEarned = won && levelConfig
      ? (baseHpFrac >= levelConfig.starThresholds.three ? 3
        : baseHpFrac >= levelConfig.starThresholds.two ? 2 : 1)
      : 0
    const displayStars = levelConfig ? campaignStarsEarned : stars
    const nextCampaignLevel = campaignLevel !== null ? LEVELS.find(l => l.id === campaignLevel + 1) ?? null : null

    const { layoutName } = getDailyInfo(difficulty)
    const effPct = kills + losses > 0 ? Math.round((kills / (kills + losses)) * 100) : 0
    const starStr = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '✗✗✗'
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const statsLine = `⚔ ${kills} kills · ${losses} lost · ${effPct}% eff`
    const shareText = won
      ? `${starStr} Speck Wars ${today} [${layoutName}]\nVICTORY in ${timeStr} (${diffLabel})\n${statsLine}\nCan you do better? `
      : `${starStr} Speck Wars ${today} [${layoutName}]\nDEFEATED in ${timeStr} (${diffLabel})\n${statsLine}\nThink you can win? `

    const handleShare = async () => {
      const url = typeof window !== 'undefined' ? window.location.href : ''
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          navigator.vibrate?.(8)
          await navigator.share({ title: 'Speck Wars', text: shareText, url })
        } catch {
          // user cancelled — no action needed
        }
      } else {
        await navigator.clipboard.writeText(`${shareText} ${url}`)
        navigator.vibrate?.(12)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 20,
        fontFamily: 'monospace', overflowY: 'auto', padding: '24px 16px',
      }}>

        {/* Tier 1: Outcome → Stars */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <h1 style={{ color: accentColor, fontSize: isTouchDevice ? 52 : 72, margin: 0, letterSpacing: 4, lineHeight: 1 }}>
            {won ? 'VICTORY' : 'DEFEATED'}
          </h1>
          {levelConfig && (
            <div style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.35)' }}>
              LEVEL {campaignLevel} · {levelConfig.name.toUpperCase()}
            </div>
          )}
          {!won && levelConfig && (
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.8 }}>
              <div>next time: win at...</div>
              <div>★ any hp &nbsp;·&nbsp; ★★ {Math.round(levelConfig.starThresholds.two * 100)}%+ &nbsp;·&nbsp; ★★★ {Math.round(levelConfig.starThresholds.three * 100)}%+</div>
            </div>
          )}
          {won && (
            <div style={{ fontSize: 44, letterSpacing: 6, color: '#ffd700', textShadow: displayStars === 3 ? '0 0 28px #ffd700' : 'none', marginTop: 4 }}>
              {'★'.repeat(displayStars)}{'☆'.repeat(3 - displayStars)}
            </div>
          )}
          {won && levelConfig && displayStars < 3 && (
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginTop: 2, textAlign: 'center' }}>
              {displayStars === 2
                ? `for ★★★: survive at ${Math.round(levelConfig.starThresholds.three * 100)}%+ hp`
                : `for ★★: ${Math.round(levelConfig.starThresholds.two * 100)}%+ hp · for ★★★: ${Math.round(levelConfig.starThresholds.three * 100)}%+ hp`
              }
            </div>
          )}
        </div>

        {/* Achievement chips */}
        {won && (isNewBest || winStreak >= 2) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {isNewBest && (
              <span style={{ fontSize: 10, letterSpacing: 2, color: '#ffd700', border: '1px solid rgba(255,215,0,0.5)', padding: '3px 10px', borderRadius: 20 }}>
                NEW BEST TIME
              </span>
            )}
            {winStreak >= 2 && (
              <span style={{ fontSize: 10, letterSpacing: 2, color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)', padding: '3px 10px', borderRadius: 20 }}>
                🔥 {winStreak}-WIN STREAK
              </span>
            )}
          </div>
        )}

        {/* Tier 2: Time · Difficulty · Map / Kills · Lost · Eff */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>⏱ {timeStr}</span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: diffColor }}>{diffLabel}</span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{layoutName}</span>
          </div>
          <div style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ color: '#4af7c4' }}>⚔ {kills}</span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: '#ff4f7b' }}>↓ {losses}</span>
            {kills + losses > 0 && (
              <>
                <span style={{ opacity: 0.3 }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{effPct}%</span>
              </>
            )}
            {won && levelConfig && (
              <>
                <span style={{ opacity: 0.3 }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>🏠 {Math.round(baseHpFrac * 100)}% hp</span>
              </>
            )}
          </div>
        </div>

        {/* Tier 3: Primary actions */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          ...(isTouchDevice ? {
            position: 'sticky', bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            padding: '10px 16px 14px',
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          } : {}),
        }}>
          {/* Primary row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => { const lvl = campaignLevel; resetGame(); if (lvl !== null) setCampaignLevel(lvl) }}
              style={{
                padding: '12px 28px', fontSize: 16, cursor: 'pointer',
                background: accentColor, border: 'none', borderRadius: 8,
                fontWeight: 'bold', color: '#000', minHeight: 52,
              }}
            >
              Play Again
            </button>
            {won && nextCampaignLevel && (
              <button
                onClick={() => {
                  resetGame()
                  setCampaignLevel(nextCampaignLevel.id)
                  setPhase('playing')
                }}
                style={{
                  padding: '12px 28px', fontSize: 16, cursor: 'pointer',
                  background: accentColor, border: `2px solid ${accentColor}`,
                  borderRadius: 8, color: '#000', fontWeight: 'bold', minHeight: 52,
                }}
              >
                Level {nextCampaignLevel.id} →
              </button>
            )}
          </div>
          {/* Secondary row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {campaignLevel !== null && (
              <button
                onClick={() => { resetGame(); setCampaignLevel(null); router.push('/speck-wars') }}
                style={{
                  padding: '8px 18px', fontSize: 13, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6, color: 'rgba(255,255,255,0.55)', minHeight: 44,
                }}
              >
                Campaign
              </button>
            )}
            <button
              onClick={handleShare}
              style={{
                padding: '8px 18px', fontSize: 13, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6, color: 'rgba(255,255,255,0.55)', minHeight: 44,
              }}
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
            <a
              href="/"
              style={{
                padding: '8px 18px', fontSize: 13,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, color: 'rgba(255,255,255,0.35)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', minHeight: 44,
              }}
            >
              ← Cave
            </a>
          </div>
          {!isTouchDevice && (
            <span style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.2)' }}>
              Enter / Space — play again
            </span>
          )}
        </div>

        {/* Sign-up CTA — earned value, shown last */}
        {!user && (
          <div style={{
            maxWidth: 280, textAlign: 'center',
            padding: '8px 16px',
            border: '1px solid rgba(74,247,196,0.12)',
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(74,247,196,0.65)', marginBottom: 5 }}>
              {won && winStreak >= 2
                ? `Your ${winStreak}-win streak deserves a record.`
                : won ? 'Track your wins and best times.'
                : 'Log your battles. Climb the ranks.'}
            </div>
            <Link
              href="/auth?redirect=/speck-wars"
              style={{ display: 'inline-block', fontSize: 10, letterSpacing: 2, color: '#4af7c4', textTransform: 'uppercase', textDecoration: 'none', opacity: 0.8 }}
            >
              Create account →
            </Link>
          </div>
        )}
      </div>
    )
  }

  // 'playing' — render game + HUD overlay
  return <>{children}</>
}

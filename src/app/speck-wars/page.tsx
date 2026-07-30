'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSpeckWarsStore } from './store'
import { LEVELS, getLevelStars, getLevelBestTime, isLevelUnlocked } from './campaign/levels'

const TOTAL_SLOTS = LEVELS.length
const MAX_STARS = LEVELS.length * 3
const DIFF_COLORS: Record<string, string> = { easy: '#44ff88', medium: '#ffcc44', hard: '#ff4f7b', 'very-hard': '#cc00ff' }
const DIFF_LABELS: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', 'very-hard': 'Brutal' }

export default function SpeckWarsCampaignPage() {
  const router = useRouter()
  const { setCampaignLevel, resetGame } = useSpeckWarsStore()
  const [stars, setStars] = useState<Record<number, number>>(() => {
    if (typeof localStorage === 'undefined') return {}
    const s: Record<number, number> = {}
    for (const l of LEVELS) s[l.id] = getLevelStars(l.id)
    return s
  })
  const [copied, setCopied] = useState(false)
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null)

  const handlePlay = (levelId: number) => {
    resetGame()
    setCampaignLevel(levelId)
    router.push('/speck-wars/play')
  }

  const totalStars = Object.values(stars).reduce((sum, s) => sum + s, 0)
  const allLevelsBeaten = LEVELS.length > 0 && LEVELS.every(l => (stars[l.id] ?? 0) >= 1)
  const nextLevel = !allLevelsBeaten && Object.keys(stars).length > 0
    ? LEVELS.find(l => {
        const isUnlocked = l.id === 1 || (stars[l.id - 1] ?? 0) >= 1
        return isUnlocked && (stars[l.id] ?? 0) === 0
      }) ?? null
    : null

  const handleShare = async () => {
    const text = `I beat all 10 Speck Wars campaign levels — ${totalStars}/${MAX_STARS} stars. Can you conquer the campaign?`
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Speck Wars', text, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: 2 }}>SPECK WARS</h1>
        <div style={{ fontSize: 14, letterSpacing: 4, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>CAMPAIGN</div>
        {totalStars > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div aria-label={`${totalStars} of ${MAX_STARS} stars`} style={{ fontSize: 13, color: '#ffd700', letterSpacing: 1 }}>
              <span aria-hidden="true">&#9733; {totalStars} <span style={{ color: 'rgba(255,215,0,0.4)' }}>/ {MAX_STARS}</span></span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={totalStars}
              aria-valuemin={0}
              aria-valuemax={MAX_STARS}
              aria-label={`Star progress: ${totalStars} of ${MAX_STARS}`}
              style={{ width: 180, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}
            >
              <div style={{
                height: '100%',
                width: `${(totalStars / MAX_STARS) * 100}%`,
                background: totalStars === MAX_STARS ? '#ffd700' : 'rgba(255,215,0,0.6)',
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {nextLevel !== null && totalStars > 0 && (
        <button
          onClick={() => handlePlay(nextLevel.id)}
          style={{
            padding: '14px 36px', fontSize: 15, fontWeight: 700, letterSpacing: 2,
            cursor: 'pointer', background: '#00ffc2', border: 'none', borderRadius: 10,
            color: '#050510', textTransform: 'uppercase',
          }}
        >
          Continue → {String(nextLevel.id).padStart(2, '0')} · {nextLevel.name}
        </button>
      )}

      {allLevelsBeaten && (
        <div style={{
          textAlign: 'center',
          padding: '20px 32px',
          border: '1px solid rgba(255,215,0,0.25)',
          borderRadius: 16,
          background: 'rgba(255,215,0,0.04)',
          maxWidth: 340,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: 'rgba(255,215,0,0.5)' }}>✦ CAMPAIGN COMPLETE ✦</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            You carved through all ten worlds.
          </div>
          <div aria-label={`${totalStars} of ${MAX_STARS} stars`} style={{ fontSize: 18, color: '#ffd700', letterSpacing: 1, textShadow: totalStars === MAX_STARS ? '0 0 20px #ffd700' : 'none' }}>
            <span aria-hidden="true">&#9733; {totalStars} <span style={{ color: 'rgba(255,215,0,0.35)', fontSize: 14 }}>/ {MAX_STARS}</span></span>
          </div>
          {totalStars < MAX_STARS && (
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,215,0,0.3)' }}>
              {totalStars}/{MAX_STARS} stars — replay levels to collect them all
            </div>
          )}
          {totalStars === MAX_STARS && (
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,215,0,0.6)' }}>
              ALL STARS COLLECTED
            </div>
          )}
          <button
            onClick={handleShare}
            style={{
              marginTop: 4, padding: '8px 20px', fontSize: 11, letterSpacing: 2,
              cursor: 'pointer', background: 'transparent',
              border: '1px solid rgba(255,215,0,0.35)', borderRadius: 6,
              color: 'rgba(255,215,0,0.7)', textTransform: 'uppercase',
            }}
          >
            {copied ? 'Copied!' : 'Share →'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 600 }}>
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const levelNum = i + 1
          const level = LEVELS.find(l => l.id === levelNum)
          const levelStars = stars[levelNum] ?? 0
          const unlocked = !!level && isLevelUnlocked(levelNum)
          const isHovered = hoveredLevel === levelNum
          const isNext = levelNum === nextLevel?.id

          return (
            <button
              key={levelNum}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && handlePlay(levelNum)}
              onMouseEnter={() => setHoveredLevel(levelNum)}
              onMouseLeave={() => setHoveredLevel(null)}
              title={level && unlocked ? `${level.name} — ${level.flavor}` : undefined}
              aria-label={level ? (unlocked ? `Play level ${levelNum}: ${level.name}` : `Level ${levelNum} locked — beat level ${levelNum - 1} first`) : `Level ${levelNum}`}
              style={{
                width: 120, height: 140,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: isNext ? 'rgba(0,255,194,0.12)' : isHovered && unlocked ? 'rgba(0,255,194,0.09)' : unlocked ? 'rgba(0,255,194,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isNext ? 'rgba(0,255,194,0.8)' : isHovered && unlocked ? 'rgba(0,255,194,0.55)' : unlocked ? 'rgba(0,255,194,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12,
                cursor: unlocked ? 'pointer' : 'default',
                padding: 12,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: 2, color: unlocked ? '#00ffc2' : 'rgba(255,255,255,0.2)' }}>
                {String(levelNum).padStart(2, '0')}
              </div>
              {unlocked && level ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{level.name}</div>
                  {level.outpostCount > 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>⬡ {level.outpostCount}</div>}
                  <div style={{
                    fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
                    color: DIFF_COLORS[level.difficulty],
                    border: `1px solid ${DIFF_COLORS[level.difficulty]}55`,
                    padding: '1px 6px', borderRadius: 3,
                  }}>
                    {DIFF_LABELS[level.difficulty]}
                  </div>
                  <div style={{ fontSize: 14, letterSpacing: 2 }}>
                    {Array.from({ length: 3 }, (_, s) => (
                      <span key={s} style={{ color: s < levelStars ? '#ffd700' : 'rgba(255,255,255,0.15)' }}>&#9733;</span>
                    ))}
                  </div>
                  {isHovered && levelStars > 0 && (() => {
                    const bestMs = getLevelBestTime(levelNum)
                    if (!bestMs) return null
                    const bSec = Math.floor(bestMs / 1000)
                    const bMM = String(Math.floor(bSec / 60)).padStart(2, '0')
                    const bSS = String(bSec % 60).padStart(2, '0')
                    return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>⏱ {bMM}:{bSS}</div>
                  })()}
                  {isNext && <div style={{ fontSize: 8, letterSpacing: 2, color: '#00ffc2', opacity: 0.7 }}>▶ NEXT</div>}
                </>
              ) : level ? (
                <>
                  <div style={{ fontSize: 20, opacity: 0.2 }}>&#128274;</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.3 }}>{level.name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)', letterSpacing: 0.5 }}>beat {levelNum - 1} first</div>
                </>
              ) : (
                <div style={{ fontSize: 20, opacity: 0.2 }}>&#128274;</div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 16 }}>
        <a href="/" style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: 1, textDecoration: 'none' }}>
          &larr; Cave
        </a>
        <a href="/speck-wars/skirmish" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 1, textDecoration: 'none' }}>
          Sandbox &rarr;
        </a>
      </div>
    </div>
  )
}

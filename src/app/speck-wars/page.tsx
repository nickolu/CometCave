'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSpeckWarsStore } from './store'
import { LEVELS, getLevelStars, isLevelUnlocked } from './campaign/levels'

// Show as many slots as there are defined levels
const TOTAL_SLOTS = LEVELS.length

export default function SpeckWarsCampaignPage() {
  const router = useRouter()
  const { setCampaignLevel, resetGame } = useSpeckWarsStore()
  const [stars, setStars] = useState<Record<number, number>>({})

  useEffect(() => {
    const s: Record<number, number> = {}
    for (const l of LEVELS) s[l.id] = getLevelStars(l.id)
    setStars(s)
  }, [])

  const handlePlay = (levelId: number) => {
    resetGame()
    setCampaignLevel(levelId)
    router.push('/speck-wars/play')
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: 2 }}>SPECK WARS</h1>
        <div style={{ fontSize: 14, letterSpacing: 4, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>CAMPAIGN</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 600 }}>
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const levelNum = i + 1
          const level = LEVELS.find(l => l.id === levelNum)
          const levelStars = stars[levelNum] ?? 0
          const unlocked = !!level && isLevelUnlocked(levelNum)

          return (
            <button
              key={levelNum}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && handlePlay(levelNum)}
              style={{
                width: 120, height: 140,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: unlocked ? 'rgba(0,255,194,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${unlocked ? 'rgba(0,255,194,0.3)' : 'rgba(255,255,255,0.06)'}`,
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
                  <div style={{ fontSize: 14, letterSpacing: 2, marginTop: 4 }}>
                    {Array.from({ length: 3 }, (_, s) => (
                      <span key={s} style={{ color: s < levelStars ? '#ffd700' : 'rgba(255,255,255,0.15)' }}>&#9733;</span>
                    ))}
                  </div>
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

      <a href="/speck-wars/skirmish" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 1, textDecoration: 'none', marginTop: 16 }}>
        Sandbox &rarr;
      </a>
    </div>
  )
}

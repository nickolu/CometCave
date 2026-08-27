'use client'
import { useState, useEffect } from 'react'
import { useBlitzStore } from '../store'
import { SignUpCTA } from './SignUpCTA'
import { DailyLeaderboard } from './DailyLeaderboard'
import { GAUNTLET_SCHEDULE } from '../domain/gauntlet/schedule'
import { localBadgeRunBackend } from '../backend'
import { runDateKey, runDocId } from '../domain/run-record'

const BOSS_NAMES: Record<string, string> = {
  brock:    'Brock', misty: 'Misty', surge: 'Lt. Surge', erika: 'Erika',
  koga:     'Koga', sabrina: 'Sabrina', blaine: 'Blaine', giovanni: 'Giovanni',
  lorelei:  'Lorelei', bruno: 'Bruno', agatha: 'Agatha', lance: 'Lance',
  champion: 'Champion',
}

/** Gym leader boss IDs in order (the 8 Kanto badges). */
const GYM_LEADERS = ['brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'] as const

/** Count gym badges earned: gym rounds cleared = round num < player's final round (or == if won). */
function countBadges(round: number, won: boolean): number {
  const gymRounds = GAUNTLET_SCHEDULE
    .filter(r => r.isBoss && GYM_LEADERS.includes(r.bossId as any))
    .map(r => r.round)

  return gymRounds.filter(r => won ? r <= round : r < round).length
}

/** Build the placement string for the share text. */
function placementText(round: number, won: boolean, eliminated: boolean): string {
  if (won && round >= 29) return 'Champion!'
  if (won) return `Round ${round} cleared`

  // Fell at a boss round
  const roundInfo = GAUNTLET_SCHEDULE.find(r => r.round === round)
  if (roundInfo?.isBoss && roundInfo.bossId) {
    return `fell to ${BOSS_NAMES[roundInfo.bossId] ?? roundInfo.bossId}`
  }
  return `fell round ${round}`
}

/** Build the spoiler-free share string. */
function buildShareText(round: number, won: boolean, eliminated: boolean, badges: number): string {
  const date = new Date().toISOString().slice(0, 10)
  const placement = placementText(round, won, eliminated)
  return `Badge Run ${badges}/8 badges — ${placement} | ${date}`
}

export function SummaryScreen() {
  const { run, startDailyRun } = useBlitzStore()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!run || run.phase !== 'summary') return
    const date = runDateKey(new Date())
    const uid = 'anon'
    const record = {
      id: runDocId(date, uid),
      uid,
      date,
      seed: run.seed,
      outcome: (run.won ? 'won' : run.eliminated ? 'eliminated' : 'lost') as 'won' | 'lost' | 'eliminated',
      badgesEarned: countBadges(run.round, run.won),
      finalRound: run.round,
      teamDexIds: run.team.map(u => u.dexId),
      boardLevels: Object.fromEntries(
        Object.entries(run.boardLevels ?? {}).map(([k, v]) => [String(k), v])
      ),
      draftSequence: run.draftSequence ?? [],
      timestamp: Date.now(),
    }
    localBadgeRunBackend.saveRun(record).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.phase])

  if (!run || run.phase !== 'summary') return null

  const badges = countBadges(run.round, run.won)
  const shareText = buildShareText(run.round, run.won, run.eliminated ?? false, badges)
  const placement = placementText(run.round, run.won, run.eliminated ?? false)

  function copyShare() {
    navigator.clipboard.writeText(shareText).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 24, maxWidth: 640, margin: '0 auto', width: '100%' }}>

      {/* Outcome */}
      <div>
        <p style={{ color: run.won ? '#4ade80' : '#f87171', fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: '0 0 4px', textTransform: 'uppercase' }}>
          {run.won ? 'Victory' : 'Eliminated'}
        </p>
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
          {placement}
        </h2>
        {(run.playerHp !== undefined) && (
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0 }}>
            {run.playerHp} HP remaining
          </p>
        )}
      </div>

      {/* Badges */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 10px', textTransform: 'uppercase' }}>
          Badges ({badges}/8)
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GYM_LEADERS.map((bossId, i) => {
            const earned = i < badges
            return (
              <div
                key={bossId}
                aria-label={`${BOSS_NAMES[bossId]} badge${earned ? ' — earned' : ' — not earned'}`}
                style={{
                  width: 36, height: 36,
                  borderRadius: '50%',
                  background: earned ? 'rgba(124,106,255,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${earned ? '#7c6aff' : 'rgba(255,255,255,0.10)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: earned ? '#7c6aff' : 'rgba(255,255,255,0.25)',
                  fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                {BOSS_NAMES[bossId]?.slice(0, 2)}
              </div>
            )
          })}
        </div>
      </div>

      {/* Final board */}
      {run.team.length > 0 && (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 10px', textTransform: 'uppercase' }}>
            Final team
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {run.team.map((u) => (
              <div key={u.dexId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{u.name}</span>
                  {(run.boardLevels?.[u.dexId] ?? 0) > 0 && (
                    <span style={{ color: '#7c6aff', fontSize: 11, marginLeft: 8 }}>
                      Lv.{run.boardLevels[u.dexId]}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {u.types.map(t => (
                    <span key={t} style={{ fontSize: 10, color: 'rgba(255,255,255,0.70)', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>
                      {t}
                    </span>
                  ))}
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)' }}>{u.tier}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 1, margin: '0 0 8px', textTransform: 'uppercase' }}>
          Share
        </p>
        <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: 13, fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: 8, margin: '0 0 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {shareText}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="br-btn"
            onClick={copyShare}
            aria-label="Copy share text"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 600,
            }}
          >
            <span aria-live="polite">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            className="br-btn"
            onClick={startDailyRun}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', color: 'rgba(255,255,255,0.70)', fontSize: 14,
            }}
          >
            Run again
          </button>
        </div>
      </div>

      <DailyLeaderboard />

      <SignUpCTA outcome={run.won ? 'won' : run.eliminated ? 'eliminated' : 'lost'} badgesEarned={badges} />
    </div>
  )
}

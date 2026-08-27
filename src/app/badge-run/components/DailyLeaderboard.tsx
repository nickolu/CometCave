'use client'
import { useState, useEffect, type CSSProperties } from 'react'
import { runDateKey, type LeaderboardDocument, type LeaderboardEntry } from '../domain/run-record'

const OUTCOME_LABEL: Record<LeaderboardEntry['outcome'], string> = {
  won: 'won',
  lost: 'lost',
  eliminated: 'eliminated',
}

export function DailyLeaderboard() {
  const [data, setData] = useState<LeaderboardDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const date = runDateKey(new Date())
    fetch(`/api/v1/badge-run/leaderboard?date=${date}`)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json() as Promise<LeaderboardDocument>
      })
      .then(doc => { setData(doc); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const sectionHeader: CSSProperties = {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    letterSpacing: 1,
    margin: '0 0 10px',
    textTransform: 'uppercase',
  }

  if (loading) {
    return (
      <div>
        <p style={sectionHeader}>Today's leaderboard</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
          the cave is consulting the records…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <p style={sectionHeader}>Today's leaderboard</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
          the leaderboard shimmers and fades
        </p>
      </div>
    )
  }

  const entries = data?.entries ?? []

  if (entries.length === 0) {
    return (
      <div>
        <p style={sectionHeader}>Today's leaderboard</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
          no adventurers have crossed the threshold yet
        </p>
      </div>
    )
  }

  return (
    <div>
      <p style={sectionHeader}>Today's leaderboard</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.slice(0, 10).map((entry, i) => (
          <div
            key={`${entry.uid}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 12px',
              background: i === 0 ? 'rgba(124,106,255,0.10)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${i === 0 ? 'rgba(124,106,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8,
            }}
          >
            <span
              aria-label={`rank ${i + 1}`}
              style={{
                color: i === 0 ? '#7c6aff' : 'rgba(255,255,255,0.35)',
                fontSize: 11,
                fontWeight: 700,
                minWidth: 18,
                textAlign: 'right',
              }}
            >
              {i + 1}
            </span>
            <span style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: i === 0 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.displayName}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
              {entry.badgesEarned}/8
            </span>
            <span style={{ color: entry.outcome === 'won' ? '#4ade80' : 'rgba(255,255,255,0.35)', fontSize: 11, minWidth: 60, textAlign: 'right' }}>
              {OUTCOME_LABEL[entry.outcome]}
            </span>
          </div>
        ))}
      </div>
      {entries.length > 10 && (
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>
          +{entries.length - 10} more trainers today
        </p>
      )}
    </div>
  )
}

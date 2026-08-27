'use client'
import { useState } from 'react'
import { useBlitzStore, getDailySeed } from '../store'
import { SignUpCTA } from './SignUpCTA'

function buildShareString(run: { round: number; won: boolean; lost: boolean }): string {
  const today = new Date()
  const date = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
  const roundsCompleted = run.won ? 8 : run.round - 1
  const result = run.won ? 'cleared' : `fell round ${run.round}`
  return `Badge Run ${roundsCompleted}/8 — ${result} | ${date}`
}

export function SummaryScreen() {
  const { run, reset } = useBlitzStore()
  const [copied, setCopied] = useState(false)

  if (!run) return null

  const shareText = buildShareString(run)

  function copyShare() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Clipboard not available — just show the text
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '32px 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: 1 }}>
          {run.won ? 'Champion' : 'Defeated'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
          {run.won
            ? 'All 8 arenas conquered.'
            : `Fell in round ${run.round} of 8.`}
        </p>
      </div>

      {run.team.length > 0 && (
        <div style={{ width: '100%' }}>
          <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>
            Your team
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {run.team.map((unit, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{unit.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{unit.tier} · {unit.types.join('/')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 4px' }}>Share</p>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'monospace', margin: 0 }}>{shareText}</p>
      </div>

      <SignUpCTA />

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="br-btn"
          aria-label="Copy share text"
          onClick={copyShare}
          style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          <span aria-live="polite">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
        <button
          className="br-btn"
          onClick={reset}
          style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}
        >
          Run again
        </button>
      </div>
    </div>
  )
}

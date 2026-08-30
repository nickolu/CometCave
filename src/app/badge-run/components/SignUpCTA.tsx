'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

interface SignUpCTAProps {
  outcome?: 'won' | 'lost' | 'eliminated'
  badgesEarned?: number
}

const KEY = 'badge-run:signup-dismissed-until'
const SUPPRESS_DAYS = 14

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return true
    const until = Number(raw)
    return Date.now() > until
  } catch {
    return true
  }
}

function dismiss(): void {
  try {
    const until = Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000
    window.localStorage.setItem(KEY, String(until))
  } catch {}
}

export function SignUpCTA({ outcome, badgesEarned = 0 }: SignUpCTAProps = {}) {
  const [visible, setVisible] = useState(shouldShow)
  const { user } = useAuth()
  if (!visible) return null
  if (user && !user.isAnonymous) return null

  function handleDismiss() {
    dismiss()
    setVisible(false)
  }

  return (
    <div style={{
      width: '100%',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    }}>
      <div>
        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>
          {outcome === 'won'
            ? 'You won!'
            : badgesEarned >= 4
              ? `${badgesEarned} badges earned.`
              : 'save your run history'}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: 0 }}>
          {outcome === 'won'
            ? 'sign in to keep your champion record and climb the leaderboard.'
            : badgesEarned >= 4
              ? 'sign in to track your best runs across devices.'
              : 'your runs are anonymous. sign in to save them across devices.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Link
          href="/auth/sign-in"
          style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 5, color: '#fff', fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Sign in
        </Link>
        <button
          className="br-btn"
          onClick={handleDismiss}
          style={{ padding: '8px 10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.60)', cursor: 'pointer', fontSize: 12 }}
          aria-label="Dismiss"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

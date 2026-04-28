'use client'

import { useEffect, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { Pill } from '@/components/ui/pill'

const SEEN_KEY = 'trivia:resetNoticeSeen'

function hasSeenNotice(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

function markSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // ignore
  }
}

export function ResetNoticeButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasSeenNotice()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    markSeen()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Why is this reset?"
        title="Why is this reset?"
        className="inline-flex items-center"
      >
        <Pill tone="neutral" size="xs" icon="info">
          info
        </Pill>
      </button>
      {open && <ResetDialog onClose={handleClose} />}
    </>
  )
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      className="fixed inset-0 bg-surface-dim/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-ds-lg border border-outline-variant bg-surface-container p-6 shadow-hero"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reset-dialog-title" className="text-lg font-bold text-ds-tertiary mb-3">
          About this reset
        </h2>
        <div className="text-on-surface/80 text-sm space-y-2 mb-4">
          <p>
            We just rebuilt the trivia database to fix nickname collisions and make
            leaderboards scale properly.
          </p>
          <p>
            Stats, streaks, and leaderboard entries are reset for everyone — including
            yours. Future games will count toward fresh totals.
          </p>
        </div>
        <ChunkyButton variant="primary" onClick={onClose} className="w-full">
          Got it
        </ChunkyButton>
      </div>
    </div>
  )
}

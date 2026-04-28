'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

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
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-cream-white/40 hover:text-cream-white/80 hover:bg-space-purple/20 transition-colors text-xs font-semibold"
      >
        i
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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-space-grey bg-space-dark p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reset-dialog-title" className="text-lg font-bold text-space-gold mb-3">
          About this reset
        </h2>
        <div className="text-cream-white/80 text-sm space-y-2 mb-4">
          <p>
            We just rebuilt the trivia database to fix nickname collisions and make
            leaderboards scale properly.
          </p>
          <p>
            Stats, streaks, and leaderboard entries are reset for everyone — including
            yours. Future games will count toward fresh totals.
          </p>
        </div>
        <Button variant="space" onClick={onClose} className="w-full">
          Got it
        </Button>
      </div>
    </div>
  )
}

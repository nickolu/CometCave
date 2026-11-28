'use client'

import Link from 'next/link'
import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

/** The way out (interaction model 2). Mid-game it asks first, because the chain is only in memory. */
export function CaveExit({ inProgress }: { inProgress: boolean }) {
  const [asking, setAsking] = useState(false)

  const icon = (
    <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden>
      arrow_back
    </span>
  )

  if (!inProgress) {
    return (
      <Link href="/" aria-label="Return to the cave" title="Return to the cave" className="pt-exit">
        {icon}
        <span>Cave</span>
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label="Return to the cave"
        title="Return to the cave"
        aria-expanded={asking}
        className="pt-exit"
        onClick={() => setAsking(a => !a)}
      >
        {icon}
        <span>Cave</span>
      </button>
      {asking && (
        <div role="alertdialog" aria-label="Leave this game?" className="pt-leave pt-leave-floating">
          <p className="mb-3">Leave this game? Your pictures and sentences will be lost.</p>
          <div className="flex flex-wrap gap-3">
            <ChunkyButton asChild variant="exit" size="md">
              <Link href="/">Leave</Link>
            </ChunkyButton>
            <ChunkyButton variant="secondary" size="md" autoFocus onClick={() => setAsking(false)}>
              Keep playing
            </ChunkyButton>
          </div>
        </div>
      )}
    </>
  )
}

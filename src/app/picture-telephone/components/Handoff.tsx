'use client'

import { useEffect, useRef } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

/** Shows a name and nothing else. Whatever the last player wrote or saw stays off screen. */
export function Handoff({ name, onReady }: { name: string; onReady: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className="pt-center" aria-labelledby="pt-handoff-heading">
      <div className="pt-avatar" aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <h2 id="pt-handoff-heading" ref={headingRef} tabIndex={-1} className="pt-heading">
        Pass to {name}
      </h2>
      <p className="pt-sub">Everyone else, look away. {name}, tap Ready when you have the device.</p>
      <div className="pt-actions pt-actions-sticky w-full justify-center">
        <ChunkyButton size="hero" onClick={onReady}>
          Ready
        </ChunkyButton>
      </div>
    </section>
  )
}

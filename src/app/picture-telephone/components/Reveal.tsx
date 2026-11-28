'use client'

import { useEffect, useRef, useState } from 'react'

import type { CSSProperties } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { ImageCard } from './ImageCard'
import { ShareButton } from './ShareButton'

import { stepLabel } from '@/lib/picture-telephone/share/layout'

import type { Entry, Seat } from '@/lib/picture-telephone/types'

interface RevealProps {
  entries: Entry[]
  seats: Seat[]
  onPlayAgain: () => void
  onNewSetup: () => void
}

export function Reveal({ entries, seats, onPlayAgain, onNewSetup }: RevealProps) {
  const [shown, setShown] = useState(1)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const endRef = useRef<HTMLLIElement>(null)
  const firstRender = useRef(true)
  // Entries added by the latest tap fade in one after another; earlier ones stay put.
  const batchStart = useRef(0)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    batchStart.current = shown
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' })
  }, [shown])

  const done = shown >= entries.length
  const nameOf = (id: string) => seats.find(s => s.id === id)?.name ?? 'Someone'

  return (
    <section className="flex flex-1 flex-col gap-5" aria-labelledby="pt-reveal-heading">
      <div>
        <h2 id="pt-reveal-heading" ref={headingRef} tabIndex={-1} className="pt-heading">
          {done ? 'Here is how it drifted' : 'Watch it drift'}
        </h2>
        <p className="pt-sub">
          {done ? `${entries.length} steps from the first sentence to the last.` : 'Tap Next to see each step.'}
        </p>
      </div>

      {entries.length === 0 && (
        <p className="pt-notice" role="status">
          There is nothing to show yet. Start a new game to make a chain.
        </p>
      )}

      <ol className="pt-chain" aria-label="The chain, in order">
        {entries.slice(0, shown).map((entry, i) => (
          <li
            key={i}
            ref={i === shown - 1 ? endRef : undefined}
            style={{ '--pt-i': Math.min(6, Math.max(0, i - batchStart.current)) } as CSSProperties}
          >
            {entry.kind === 'image' ? (
              <ImageCard src={entry.src} alt={`Picture ${Math.ceil((i + 1) / 2)} of the chain`} />
            ) : (
              <div className="pt-note">
                <p className="pt-note-meta">
                  <span>
                    {stepLabel(entries, i)} · {nameOf(entry.seatId)}
                  </span>
                  {entry.viaAi && <span className="pt-badge">AI</span>}
                </p>
                <p>{entry.text}</p>
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="pt-actions pt-actions-sticky">
        {done ? (
          <>
            <ChunkyButton size="hero" onClick={onPlayAgain}>
              Play again
            </ChunkyButton>
            <ChunkyButton variant="secondary" size="lg" onClick={onNewSetup}>
              New setup
            </ChunkyButton>
            <ShareButton entries={entries} seats={seats} />
          </>
        ) : (
          <>
            <ChunkyButton size="hero" onClick={() => setShown(n => Math.min(entries.length, n + 1))}>
              Next
            </ChunkyButton>
            <ChunkyButton variant="secondary" size="lg" onClick={() => setShown(entries.length)}>
              Show all
            </ChunkyButton>
          </>
        )}
      </div>
    </section>
  )
}

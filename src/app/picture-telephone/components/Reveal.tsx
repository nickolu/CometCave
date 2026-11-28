'use client'

import { useEffect, useRef, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { ImageCard } from './ImageCard'

import type { Entry, Seat } from '@/lib/picture-telephone/types'

interface RevealProps {
  entries: Entry[]
  seats: Seat[]
  onPlayAgain: () => void
  onNewSetup: () => void
}

function labelFor(entries: Entry[], index: number): string {
  const textIndexes = entries.map((e, i) => (e.kind === 'text' ? i : -1)).filter(i => i >= 0)
  if (index === textIndexes[0]) return 'Opening sentence'
  if (index === textIndexes[textIndexes.length - 1]) return 'Final guess'
  return 'Said'
}

export function Reveal({ entries, seats, onPlayAgain, onNewSetup }: RevealProps) {
  const [shown, setShown] = useState(1)
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const endRef = useRef<HTMLLIElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' })
  }, [shown])

  const done = shown >= entries.length
  const nameOf = (id: string) => seats.find(s => s.id === id)?.name ?? 'Someone'

  // PR3 replaces this with a picture of the whole chain.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/picture-telephone`)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

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

      <ol className="pt-chain" aria-label="The chain, in order">
        {entries.slice(0, shown).map((entry, i) => (
          <li key={i} ref={i === shown - 1 ? endRef : undefined}>
            {entry.kind === 'image' ? (
              <ImageCard src={entry.src} alt={`Picture ${Math.ceil((i + 1) / 2)} of the chain`} />
            ) : (
              <div className="pt-note">
                <p className="pt-note-meta">
                  <span>
                    {labelFor(entries, i)} · {nameOf(entry.seatId)}
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
            <ChunkyButton variant="utility" size="lg" onClick={copyLink}>
              Copy game link
            </ChunkyButton>
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
      <p role="status" className="pt-sub">
        {copied === 'done' && 'Link copied.'}
        {copied === 'failed' && 'Could not copy. The game lives at /picture-telephone.'}
      </p>
    </section>
  )
}

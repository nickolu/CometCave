'use client'

/**
 * The story so far.
 *
 * Four kinds of entry share one column, and the visual job is to make it
 * obvious which voice is speaking without turning the page into a chat app —
 * the DM's narration is the text, and everything else is furniture around it.
 * So narration gets the widest measure and the warmest colour, the player's
 * own lines are indented and quieted, and the die cards interrupt.
 *
 * Autoscroll follows new entries only when the player is already near the
 * bottom. Someone scrolled up re-reading what happened two scenes ago is doing
 * that on purpose, and yanking them back down is the single rudest thing a
 * transcript can do.
 */
import { useEffect, useRef } from 'react'

import { DieCard } from '@/app/dicebound/components/die-card'
import { SKILLS } from '@/app/dicebound/domain/attributes'
import type { TranscriptEntry } from '@/app/dicebound/domain/campaign'

const NEAR_BOTTOM_PX = 160

export function Transcript({
  entries,
  pending,
  freshFrom,
}: {
  entries: TranscriptEntry[]
  pending: boolean
  /** Index at and after which entries arrived this session and may animate. */
  freshFrom: number
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onScroll = () => {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      stick.current = distance < NEAR_BOTTOM_PX
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length, pending])

  return (
    <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {entries.map((entry, index) => (
          <Entry key={index} entry={entry} fresh={index >= freshFrom} />
        ))}
        {pending && <Thinking />}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function Entry({ entry, fresh }: { entry: TranscriptEntry; fresh: boolean }) {
  switch (entry.kind) {
    case 'narration':
      return (
        <div className="flex flex-col gap-3 text-body-lg leading-relaxed text-on-surface">
          {entry.text.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )

    case 'player':
      return (
        <p className="border-l-2 border-ds-secondary/50 pl-4 text-body-md italic text-on-surface-variant">
          {entry.text}
        </p>
      )

    case 'check':
      return <DieCard entry={entry} fresh={fresh} />

    case 'earned':
      return (
        <p
          className="flex items-center gap-2 text-sm font-semibold text-ds-tertiary"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            trending_up
          </span>
          {SKILLS[entry.skill].name} is now +{entry.rank}
        </p>
      )
  }
}

/**
 * The waiting state.
 *
 * In the narrator's voice rather than a spinner, because this is the longest
 * recurring pause in the game and a bare spinner would make every turn feel
 * like a page load (interaction model 9, and CLAUDE.md principle 7 — the
 * boring screens deserve intention).
 */
function Thinking() {
  return (
    <p className="flex items-center gap-2 text-body-md italic text-on-surface-variant">
      <span
        className="inline-block h-2 w-2 animate-pulse rounded-full bg-ds-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      The dungeon master considers…
    </p>
  )
}

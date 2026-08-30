'use client'

import { useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'

import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'

/**
 * How long a spent pack stays on screen before the view moves on.
 *
 * There is a reason for a pause at all: a Tarot or Spectral pick changes cards
 * the player is looking at, and closing instantly hides the thing they just
 * paid for. But it used to be 1200ms during which the pack looked exactly as it
 * had a moment earlier, so the wait read as "I can still pick" followed by the
 * view yanking itself away.
 */
export const PACK_CLOSE_DELAY_MS = 450

export interface PackCompletion {
  /** Every pick is spent. The pack is on screen but is no longer a choice. */
  isSpent: boolean
  /** Props for the grid of cards, so a spent pack reads and behaves as spent. */
  spentProps: {
    style: { pointerEvents: 'none' | 'auto'; opacity: number; transition: string }
    'aria-disabled': boolean
  }
}

/**
 * Shared behaviour for the five pack-opening views: close once the picks are
 * spent, and make "spent" visible the instant it happens.
 *
 * The dimming is the point. Blocking clicks was already handled, but a pack
 * that still looked pickable and simply ignored the click was indistinguishable
 * from a lagging one.
 */
export function usePackCompletion(remainingCardsToSelect: number | undefined): PackCompletion {
  const reducedMotion = useReducedMotion()
  const isSpent = remainingCardsToSelect === 0

  useEffect(() => {
    if (!isSpent) return
    const timer = setTimeout(
      () => eventEmitter.emit({ type: 'SHOP_CLOSE_PACK' }),
      reducedMotion ? 0 : PACK_CLOSE_DELAY_MS
    )
    return () => clearTimeout(timer)
  }, [isSpent, reducedMotion])

  return {
    isSpent,
    spentProps: {
      style: {
        pointerEvents: isSpent ? 'none' : 'auto',
        opacity: isSpent ? 0.4 : 1,
        transition: reducedMotion ? 'none' : 'opacity 150ms ease-out',
      },
      'aria-disabled': isSpent,
    },
  }
}

/** Heading for a pack, which stops asking for picks once there are none left. */
export function packPrompt(verb: string, remaining: number | undefined, noun: string): string {
  if (remaining === undefined) return ''
  if (remaining === 0) return 'Nothing left to take'
  return `${verb} ${remaining} ${noun}${remaining > 1 ? 's' : ''}`
}

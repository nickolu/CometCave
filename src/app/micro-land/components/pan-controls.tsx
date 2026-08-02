'use client'

import { useCallback, useEffect, useRef } from 'react'

import { useMicroLand } from '@/app/micro-land/store'

/** A press shorter than this was a click, not a hold. */
const TAP_MS = 200

/**
 * The two arrows that walk you along the world.
 *
 * The world is three screens wide, and every other way of moving it is a gesture
 * you have to already know: two fingers, a trackpad swipe, an arrow key, a tap
 * on the map. These are the one control that is simply *visible*, which makes
 * them the ones that matter on a phone and the ones a screen reader can find.
 *
 * Press and hold to keep going; a quick press steps once. Both are wired,
 * because a small child holds the button down and an adult clicks it.
 */
export function PanControls({
  onHold,
  onNudge,
}: {
  onHold: (direction: -1 | 0 | 1) => void
  onNudge: (direction: -1 | 1) => void
}) {
  const canPan = useMicroLand(s => s.canPan)
  const pressedAt = useRef(0)

  const stop = useCallback(() => {
    pressedAt.current = 0
    onHold(0)
  }, [onHold])

  // A pointer released outside the button never sends pointerup *to* the
  // button, and a camera that scrolls forever after is the worst bug this could
  // have. The window always hears about it.
  useEffect(() => {
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [stop])

  if (!canPan) return null

  const button = (direction: -1 | 1) => (
    <button
      type="button"
      aria-label={direction === -1 ? 'Look further west' : 'Look further east'}
      className="pointer-events-auto flex h-11 w-9 items-center justify-center rounded-lg backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100"
      style={{
        color: 'var(--cc-text-default)',
        background: 'rgba(2, 8, 10, 0.6)',
        border: '1px solid var(--cc-mint-line)',
        opacity: 0.62,
        touchAction: 'none',
      }}
      onPointerDown={e => {
        e.preventDefault()
        pressedAt.current = e.timeStamp
        onHold(direction)
      }}
      onPointerUp={e => {
        // Let go quickly and the hold barely moved anything; give it one clean
        // step so a tap always does something you can see.
        if (pressedAt.current > 0 && e.timeStamp - pressedAt.current < TAP_MS) {
          onNudge(direction)
        }
        stop()
      }}
      onPointerLeave={stop}
      // Enter and Space fire a click with no pointer event behind it, and that
      // is the only case this needs to catch — `detail` is 0 for exactly those.
      onClick={e => {
        if (e.detail === 0) onNudge(direction)
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === -1 ? (
          <polyline points="9,2 3,7 9,12" />
        ) : (
          <polyline points="5,2 11,7 5,12" />
        )}
      </svg>
    </button>
  )

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
      {button(-1)}
      {button(1)}
    </div>
  )
}

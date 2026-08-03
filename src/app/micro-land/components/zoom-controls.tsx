'use client'

import { useMicroLand } from '@/app/micro-land/store'

/**
 * The two buttons that change how close you are standing.
 *
 * Every other way of zooming is a gesture you have to already know — a pinch, a
 * ctrl-wheel, a key — and the terrarium is for people who have never used any of
 * them. These are the version a small child can find and a screen reader can
 * announce, which is the only reason they are on screen at all.
 *
 * A tap each, no hold: unlike panning, where you often want to travel a long way
 * and holding is the natural thing, there are only five or six steps from end to
 * end of the range and a held button would blow through all of them.
 *
 * They live at the bottom-right rather than beside the pan arrows, which sit at
 * the vertical middle of each edge: stacking four controls down one side turns
 * the edge of the world into a toolbar, and the pan arrows are the ones that
 * have to stay in the same place they have always been.
 */
export function ZoomControls({ onZoom }: { onZoom: (direction: 1 | -1) => void }) {
  const canZoomIn = useMicroLand(s => s.canZoomIn)
  const canZoomOut = useMicroLand(s => s.canZoomOut)

  const button = (direction: 1 | -1, enabled: boolean) => (
    <button
      type="button"
      // In the cave's voice rather than "zoom in" — the chrome narrates, it
      // doesn't label a control panel.
      aria-label={direction === 1 ? 'Look closer' : 'Look further out'}
      disabled={!enabled}
      className="pointer-events-auto flex h-11 w-9 items-center justify-center rounded-lg backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:cursor-default disabled:hover:opacity-25"
      style={{
        color: 'var(--cc-text-default)',
        background: 'rgba(2, 8, 10, 0.6)',
        border: '1px solid var(--cc-mint-line)',
        // Faded rather than hidden at the end of the range: a button that
        // vanishes takes the other one with it on the way past your thumb.
        opacity: enabled ? 0.62 : 0.25,
        touchAction: 'none',
      }}
      onPointerDown={e => e.preventDefault()}
      onClick={() => onZoom(direction)}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="2" y1="7" x2="12" y2="7" />
        {direction === 1 && <line x1="7" y1="2" x2="7" y2="12" />}
      </svg>
    </button>
  )

  return (
    <div className="pointer-events-none absolute bottom-2 right-2 flex flex-col gap-1.5">
      {button(1, canZoomIn)}
      {button(-1, canZoomOut)}
    </div>
  )
}

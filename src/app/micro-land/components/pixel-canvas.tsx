'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The drawing surface.
 *
 * Canvas rather than a grid of elements: 28x24 across four frames is 672 nodes
 * per redraw, and dragging across a div grid means `elementFromPoint` on every
 * pointer move. One canvas draws in a few hundred fill calls and the geometry
 * is arithmetic.
 *
 * The backing store is sized to the *displayed* box rather than being scaled up
 * with `image-rendering: pixelated`. Pixelated upscaling is only crisp at whole
 * multiples, and the canvas here is fluid — at 17.3 display pixels per cell the
 * grid lines would shimmer and some cells would come out a pixel wider than
 * their neighbours.
 */

/**
 * Canvas 2D takes colour strings, not CSS variables, so the tokens have to be
 * resolved by hand. Read once per mount and cached: `getComputedStyle` forces
 * style resolution, and this runs on every cell of every drag.
 */
interface Tokens {
  checkerA: string
  checkerB: string
  grid: string
  cursorInner: string
  cursorOuter: string
}

function readTokens(el: Element): Tokens {
  const style = getComputedStyle(el)
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  // The fallbacks only matter if this ever renders outside the cosmic shell.
  // An empty string is a silent no-op on `fillStyle`, which would leave the
  // checkerboard invisible rather than wrong — worth four strings to avoid.
  return {
    checkerA: token('--cc-checker-a', 'rgb(23 26 34)'),
    checkerB: token('--cc-checker-b', 'rgb(30 34 44)'),
    grid: token('--cc-checker-grid', 'rgb(255 255 255 / 7%)'),
    cursorInner: token('--cc-mint', 'rgb(94 234 212)'),
    cursorOuter: token('--cc-bg-deep', 'rgb(2 8 10)'),
  }
}

interface Props {
  w: number
  h: number
  cells: (string | null)[]
  /** The neighbouring frame, drawn faintly underneath. Null to hide it. */
  ghost: (string | null)[] | null
  /**
   * One cell of a stroke. `first` marks the pointer-down (or key press) that
   * began it — the parent uses it to snapshot undo state exactly once.
   */
  onPaint: (index: number, first: boolean) => void
  /** Read back so the keyboard cursor can announce what it is sitting on. */
  describe: (index: number) => string
  label: string
}

export function PixelCanvas({ w, h, cells, ghost, onPaint, describe, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  /**
   * Where the keyboard is pointing. Null until the canvas is focused.
   *
   * Clamped on read rather than corrected in an effect, because shrinking the
   * canvas can strand it past the end of the grid and a render that briefly
   * draws the marker out of bounds is worse than a derived value.
   */
  const [rawCursor, setCursor] = useState<number | null>(null)
  const cursor = rawCursor === null ? null : Math.min(rawCursor, w * h - 1)

  const tokensRef = useRef<Tokens | null>(null)
  const drawing = useRef(false)
  const last = useRef<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect
      setBox({ w: rect.width, h: rect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || box.w === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!tokensRef.current) tokensRef.current = readTokens(canvas)
    const tokens = tokensRef.current

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pxW = Math.round(box.w * dpr)
    const pxH = Math.round(box.h * dpr)
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW
      canvas.height = pxH
    }

    const cw = pxW / w
    const ch = pxH / h
    // Snap every edge to a whole device pixel, sharing the rounding error out
    // across the grid instead of letting it pile up as a seam on the last cell.
    const left = (x: number) => Math.round(x * cw)
    const top = (y: number) => Math.round(y * ch)

    ctx.clearRect(0, 0, pxW, pxH)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? tokens.checkerA : tokens.checkerB
        ctx.fillRect(left(x), top(y), left(x + 1) - left(x), top(y + 1) - top(y))
      }
    }

    if (ghost) {
      ctx.globalAlpha = 0.22
      for (let i = 0; i < ghost.length; i++) {
        const hex = ghost[i]
        if (!hex) continue
        const x = i % w
        const y = (i / w) | 0
        ctx.fillStyle = hex
        ctx.fillRect(left(x), top(y), left(x + 1) - left(x), top(y + 1) - top(y))
      }
      ctx.globalAlpha = 1
    }

    for (let i = 0; i < cells.length; i++) {
      const hex = cells[i]
      if (!hex) continue
      const x = i % w
      const y = (i / w) | 0
      ctx.fillStyle = hex
      ctx.fillRect(left(x), top(y), left(x + 1) - left(x), top(y + 1) - top(y))
    }

    ctx.strokeStyle = tokens.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 1; x < w; x++) {
      ctx.moveTo(left(x) + 0.5, 0)
      ctx.lineTo(left(x) + 0.5, pxH)
    }
    for (let y = 1; y < h; y++) {
      ctx.moveTo(0, top(y) + 0.5)
      ctx.lineTo(pxW, top(y) + 0.5)
    }
    ctx.stroke()

    if (cursor !== null) {
      const x = cursor % w
      const y = (cursor / w) | 0
      // Two rings so the marker survives landing on a light pixel or a dark one.
      ctx.lineWidth = Math.max(2, dpr * 1.5)
      ctx.strokeStyle = tokens.cursorOuter
      ctx.strokeRect(left(x) + 1, top(y) + 1, left(x + 1) - left(x) - 2, top(y + 1) - top(y) - 2)
      ctx.strokeStyle = tokens.cursorInner
      ctx.strokeRect(
        left(x) + 2.5,
        top(y) + 2.5,
        left(x + 1) - left(x) - 5,
        top(y + 1) - top(y) - 5
      )
    }
  }, [box, w, h, cells, ghost, cursor])

  const cellAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((clientX - rect.left) / rect.width) * w)
      const y = Math.floor(((clientY - rect.top) / rect.height) * h)
      if (x < 0 || y < 0 || x >= w || y >= h) return null
      return y * w + x
    },
    [w, h]
  )

  /**
   * Fill the gap between two cells.
   *
   * A fast drag reports a handful of positions several cells apart, and without
   * this a quick diagonal stroke comes out as dots.
   */
  const paintLine = useCallback(
    (from: number, to: number) => {
      let x0 = from % w
      let y0 = (from / w) | 0
      const x1 = to % w
      const y1 = (to / w) | 0
      const dx = Math.abs(x1 - x0)
      const dy = -Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx + dy

      for (;;) {
        if (x0 === x1 && y0 === y1) break
        const e2 = 2 * err
        if (e2 >= dy) {
          err += dy
          x0 += sx
        }
        if (e2 <= dx) {
          err += dx
          y0 += sy
        }
        onPaint(y0 * w + x0, false)
      }
    },
    [w, onPaint]
  )

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        // Cap the zoom so an 8x8 canvas doesn't balloon into a chessboard.
        maxWidth: Math.min(w * 30, 560),
        aspectRatio: `${w} / ${h}`,
        margin: '0 auto',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--cc-mint-line)',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label={`${label} Use the arrow keys to move around the drawing and Enter to colour in a square.`}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
          outline: 'none',
        }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          e.currentTarget.focus()
          drawing.current = true
          const index = cellAt(e.clientX, e.clientY)
          if (index === null) return
          setCursor(index)
          onPaint(index, true)
          last.current = index
        }}
        onPointerMove={e => {
          if (!drawing.current) return
          const index = cellAt(e.clientX, e.clientY)
          if (index === null || index === last.current) return
          if (last.current === null) onPaint(index, false)
          else paintLine(last.current, index)
          last.current = index
          setCursor(index)
        }}
        onPointerUp={() => {
          drawing.current = false
          last.current = null
        }}
        onPointerCancel={() => {
          drawing.current = false
          last.current = null
        }}
        onFocus={() => {
          if (cursor === null) setCursor(Math.floor(h / 2) * w + Math.floor(w / 2))
        }}
        onKeyDown={e => {
          const step =
            e.key === 'ArrowLeft'
              ? -1
              : e.key === 'ArrowRight'
                ? 1
                : e.key === 'ArrowUp'
                  ? -w
                  : e.key === 'ArrowDown'
                    ? w
                    : 0

          if (step !== 0) {
            e.preventDefault()
            const from = cursor ?? 0
            // Left and right must not wrap onto the row above or below.
            if (Math.abs(step) === 1 && ((from % w) + step < 0 || (from % w) + step >= w)) {
              return
            }
            const next = from + step
            if (next >= 0 && next < w * h) setCursor(next)
            return
          }

          if ((e.key === 'Enter' || e.key === ' ') && cursor !== null) {
            e.preventDefault()
            onPaint(cursor, true)
          }
        }}
      />
      <span
        aria-live="polite"
        className="sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {cursor === null ? '' : describe(cursor)}
      </span>
    </div>
  )
}

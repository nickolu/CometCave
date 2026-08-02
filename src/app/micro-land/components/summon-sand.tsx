'use client'

import { useEffect, useRef } from 'react'

import { SUMMON_SAND_COLORS } from '@/app/micro-land/domain/config/loader-shapes'

/**
 * The wait for one creature, shrunk to fit a slot in the creature strip.
 *
 * Asking for a single creature doesn't hold the game hostage any more, so the
 * wait can't be a modal — it's an empty slot with sand pouring into it. The
 * grains fall and pile by the same rules as the big loader and the world
 * itself, then wash out and start over, which reads as "still coming" without
 * ever pretending to be a finished creature.
 *
 * Deliberately not a copy of `SummonLoader`: at this size the assembly phase
 * would be a smudge, and this has to be cheap enough to run several at once
 * behind a game that is already simulating at 60fps.
 */

const GRID = 16
/** One powder pass. Slower than the big loader — fewer grains to watch. */
const SAND_STEP_MS = 52
/** Half-width of the mouth the sand pours from, in cells. */
const POUR_SPREAD = 3
/** Grains in a full pile: enough to mound up, not enough to fill the slot. */
const CAPACITY = 52
const FADE_MS = 620

const COLORS = SUMMON_SAND_COLORS

interface Grain {
  x: number
  y: number
  color: string
}

function cellIndex(x: number, y: number): number {
  return y * GRID + x
}

export function SummonSand({ size = 34 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const center = Math.floor(GRID / 2)
    const occupied = new Int32Array(GRID * GRID)
    let grains: Grain[] = []
    let alpha = 1
    let fading = false
    let sandAcc = 0
    let pass = 0

    const draw = () => {
      ctx.clearRect(0, 0, GRID, GRID)

      // A dotted floor, so the pile lands on something rather than stopping at
      // the edge of nothing — the same footing the big loader gives it.
      ctx.globalAlpha = 0.5 * alpha
      ctx.fillStyle = 'rgba(94, 234, 212, 0.35)'
      for (let x = 0; x < GRID; x += 2) ctx.fillRect(x, GRID - 1, 1, 1)

      ctx.globalAlpha = alpha
      for (const grain of grains) {
        ctx.fillStyle = grain.color
        ctx.fillRect(grain.x, grain.y, 1, 1)
      }
      ctx.globalAlpha = 1
    }

    // Under reduced motion the wait is one settled pile, held still.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < CAPACITY; i++) {
        const x = center + Math.round((i % 7) - 3)
        const y = GRID - 1 - Math.floor(i / 7)
        grains.push({ x, y, color: COLORS[i % COLORS.length] })
      }
      draw()
      return
    }

    function pour() {
      if (grains.length >= CAPACITY) return
      for (let attempt = 0; attempt < 5; attempt++) {
        const x = center + Math.round((Math.random() * 2 - 1) * POUR_SPREAD)
        if (occupied[cellIndex(x, 0)] !== 0) continue
        grains.push({ x, y: 0, color: COLORS[grains.length % COLORS.length] })
        occupied[cellIndex(x, 0)] = grains.length
        return
      }
    }

    /** One powder pass: everything falls, piles and slides down slopes. */
    function stepSand(): number {
      pass++
      const leftToRight = (pass & 1) === 0

      // Bottom-up, so a grain that just fell isn't carried along by the same
      // pass that moved it.
      const order = grains.map((_, i) => i).sort((a, b) => grains[b].y - grains[a].y)

      let moves = 0
      for (const i of order) {
        const grain = grains[i]
        if (grain.y + 1 >= GRID) continue

        const from = cellIndex(grain.x, grain.y)
        const below = cellIndex(grain.x, grain.y + 1)
        if (occupied[below] === 0) {
          occupied[from] = 0
          occupied[below] = i + 1
          grain.y++
          moves++
          continue
        }

        const first = leftToRight ? -1 : 1
        for (const dir of [first, -first]) {
          const nx = grain.x + dir
          if (nx < 0 || nx >= GRID) continue
          const diagonal = cellIndex(nx, grain.y + 1)
          if (occupied[diagonal] !== 0) continue
          occupied[from] = 0
          occupied[diagonal] = i + 1
          grain.x = nx
          grain.y++
          moves++
          break
        }
      }
      return moves
    }

    function reset() {
      occupied.fill(0)
      grains = []
      alpha = 1
      fading = false
      sandAcc = 0
    }

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      // Cap the step so a backgrounded tab doesn't come back to a pile that
      // fell through the floor in one enormous delta.
      const dt = Math.min(now - last, 50)
      last = now

      if (fading) {
        alpha -= dt / FADE_MS
        if (alpha <= 0) reset()
      } else {
        sandAcc += dt
        while (sandAcc >= SAND_STEP_MS) {
          sandAcc -= SAND_STEP_MS
          pour()
          const moves = stepSand()
          if (moves === 0 && grains.length >= CAPACITY) fading = true
        }
      }

      draw()
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={GRID}
      height={GRID}
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        imageRendering: 'pixelated',
      }}
    />
  )
}

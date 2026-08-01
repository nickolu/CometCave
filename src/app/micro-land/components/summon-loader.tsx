'use client'

import { useEffect, useRef, useState } from 'react'

import {
  LOADER_CREATURE_SHAPES,
  LOADER_TERRAIN_SHAPES,
  type LoaderShape,
} from '@/app/micro-land/domain/config/loader-shapes'

/**
 * The wait, as a piece of the world.
 *
 * A summon can take the better part of a minute. A greyed-out form for that
 * long reads as a broken game — especially to a player who just described a
 * lava cat and is waiting to meet it. So the wait shows the work: sand pours
 * into the panel and piles up under the same falling-powder rules the world
 * runs on, then lifts off the floor and assembles into a creature, which
 * breathes for a moment before collapsing back into sand and starting over.
 *
 * The physics here is a small self-contained copy rather than `tickTiles`:
 * the real world is still simulating behind the modal and tickTiles keeps a
 * module-level scratch buffer, and the assembly phase needs free-floating
 * grains at fractional positions, which a tile grid can't express.
 *
 * Drawn one canvas pixel per grain and blown up by CSS, the same way the world
 * renderer works — so the loader sits on the same pixel grid as the game.
 */

const GRID_W = 64
const GRID_H = 36

/** One powder pass. Slow enough that you can watch grains land. */
const SAND_STEP_MS = 28
const GRAINS_PER_STEP = 2
/** Half-width of the mouth the sand pours from, in cells. */
const POUR_SPREAD = 8

const RAIN_MAX_MS = 4600
const GATHER_MS = 1000
const HOLD_MS = 2400
const SCATTER_MS = 900

type Phase = 'rain' | 'gather' | 'hold' | 'scatter'

interface Grain {
  x: number
  y: number
  vx: number
  vy: number
  /** Where this grain belongs once the body comes together. */
  tx: number
  ty: number
  color: string
  eye: boolean
  alpha: number
  /** Fixed per grain, so the shimmer in the hold phase isn't in lockstep. */
  seed: number
}

const CREATURE_LINES = [
  'Finding its shape…',
  'Choosing its colors…',
  'Giving it a body…',
  'Working out how it moves…',
  'Deciding what it eats…',
  'Waking it up…',
]

const SCENE_LINES = [
  'Picking a place…',
  'Piling up the ground…',
  'Pouring in the water…',
  'Growing something for everyone to eat…',
  'Working out who eats who…',
  'Letting them all in…',
]

const TERRAIN_LINES = [
  'Picking a place…',
  'Piling up the ground…',
  'Digging out the caves…',
  'Pouring in the water…',
  'Planting things on top…',
  'Letting it settle…',
]

const LINE_MS = 3200

function cellIndex(x: number, y: number): number {
  return y * GRID_W + x
}

function buildGrains(shape: LoaderShape): Grain[] {
  const h = shape.rows.length
  const w = shape.rows[0].length
  const ox = Math.floor((GRID_W - w) / 2)
  const oy = Math.floor(GRID_H * 0.42 - h / 2)

  const grains: Grain[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = shape.rows[y][x]
      const color = ch === '.' ? undefined : shape.palette[ch]
      if (!color) continue
      grains.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        tx: ox + x,
        ty: oy + y,
        color,
        eye: ch === 'e',
        alpha: 1,
        seed: Math.random() * Math.PI * 2,
      })
    }
  }

  // Rain them in mixed up, so the pile is speckled rather than sorted by color.
  for (let i = grains.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[grains[i], grains[j]] = [grains[j], grains[i]]
  }
  return grains
}

/**
 * Hand every grain the target nearest its own column, within its own color.
 * Grains are built one-per-pixel so the counts always match exactly; matching
 * on x keeps the assembly from crossing itself into a knot.
 */
function assignTargets(grains: Grain[]): void {
  const groups = new Map<string, number[]>()
  grains.forEach((grain, i) => {
    const group = groups.get(grain.color)
    if (group) group.push(i)
    else groups.set(grain.color, [i])
  })

  for (const indices of groups.values()) {
    const targets = indices.map(i => ({ tx: grains[i].tx, ty: grains[i].ty }))
    indices.sort((a, b) => grains[a].x - grains[b].x || grains[a].y - grains[b].y)
    targets.sort((a, b) => a.tx - b.tx || a.ty - b.ty)
    indices.forEach((grainIndex, slot) => {
      grains[grainIndex].tx = targets[slot].tx
      grains[grainIndex].ty = targets[slot].ty
    })
  }
}

export function SummonLoader({
  mode,
  prompt,
  onCancel,
}: {
  mode: 'creature' | 'scene' | 'terrain'
  prompt: string
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [lineIndex, setLineIndex] = useState(0)

  const lines = mode === 'scene' ? SCENE_LINES : mode === 'terrain' ? TERRAIN_LINES : CREATURE_LINES

  // Walk the lines once and stay on the last one. Looping back to "finding its
  // shape" after a minute would read as the summon having restarted.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIndex(i => Math.min(i + 1, lines.length - 1))
    }, LINE_MS)
    return () => window.clearInterval(id)
  }, [lines.length])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = Math.floor(GRID_W / 2)
    const occupied = new Int32Array(GRID_W * GRID_H)

    // Asking for land shows land being built; asking for creatures shows
    // creatures. The wait should look like the thing being waited on.
    const shapes = mode === 'terrain' ? LOADER_TERRAIN_SHAPES : LOADER_CREATURE_SHAPES

    let shapeIndex = Math.floor(Math.random() * shapes.length)
    let grains = buildGrains(shapes[shapeIndex])
    let blinkColor = shapes[shapeIndex].blink
    let live = 0
    let phase: Phase = 'rain'
    let phaseMs = 0
    let sandAcc = 0
    let pass = 0

    // An arrow rather than a declaration: a hoisted function would lose the
    // narrowing from the null check above and need an assertion on every call.
    const draw = (now: number) => {
      ctx.clearRect(0, 0, GRID_W, GRID_H)

      // A dotted floor, so the pile has something to land on rather than
      // stopping at the edge of nothing.
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(94, 234, 212, 0.14)'
      for (let x = 0; x < GRID_W; x += 2) ctx.fillRect(x, GRID_H - 1, 1, 1)

      const holding = phase === 'hold'
      const bob = holding ? Math.round(Math.sin(now * 0.0024) * 0.9) : 0
      const blinking = holding && (now * 0.001) % 2.4 < 0.13

      for (let i = 0; i < live; i++) {
        const grain = grains[i]
        let x = grain.x
        let y = grain.y
        if (holding) {
          // A sparse one-pixel shimmer on top of the whole-body bob — the two
          // together read as breathing rather than as a static sprite.
          x += Math.sin(now * 0.004 + grain.seed) * 0.45
          y += bob + Math.cos(now * 0.003 + grain.seed * 1.7) * 0.35
        }
        ctx.globalAlpha = grain.alpha
        ctx.fillStyle = blinking && grain.eye ? blinkColor : grain.color
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
      }
      ctx.globalAlpha = 1
    }

    // Under reduced motion the wait is a single assembled creature, held still.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const grain of grains) {
        grain.x = grain.tx
        grain.y = grain.ty
      }
      live = grains.length
      phase = 'gather'
      draw(0)
      return
    }

    /** One powder pass: everything falls, piles and slides down slopes. */
    function stepSand(): number {
      pass++
      const leftToRight = (pass & 1) === 0

      for (let n = 0; n < GRAINS_PER_STEP && live < grains.length; n++) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const x = centerX + Math.floor((Math.random() * 2 - 1) * POUR_SPREAD)
          if (occupied[cellIndex(x, 0)] !== 0) continue
          const grain = grains[live]
          grain.x = x
          grain.y = 0
          occupied[cellIndex(x, 0)] = live + 1
          live++
          break
        }
      }

      // Bottom-up, so a grain that just fell isn't carried along by the pass
      // that moved it — same reason the world's tile step scans upward.
      const order: number[] = []
      for (let i = 0; i < live; i++) order.push(i)
      order.sort((a, b) => grains[b].y - grains[a].y)

      let moves = 0
      for (const i of order) {
        const grain = grains[i]
        if (grain.y + 1 >= GRID_H) continue

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
          if (nx < 0 || nx >= GRID_W) continue
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

    function enterGather() {
      // Anything still queued when the pile settles joins from the top, so the
      // body is never assembled out of a partial set of grains.
      while (live < grains.length) {
        const grain = grains[live]
        grain.x = centerX + Math.floor((Math.random() * 2 - 1) * POUR_SPREAD)
        grain.y = -Math.floor(Math.random() * 6)
        live++
      }
      assignTargets(grains)
      for (const grain of grains) {
        grain.vx = 0
        grain.vy = 0
      }
      phase = 'gather'
      phaseMs = 0
    }

    function enterScatter() {
      for (const grain of grains) {
        grain.vx = (grain.x - centerX) * 1.1 + (Math.random() * 6 - 3)
        grain.vy = -(3 + Math.random() * 7)
      }
      phase = 'scatter'
      phaseMs = 0
    }

    function nextShape() {
      shapeIndex = (shapeIndex + 1) % shapes.length
      grains = buildGrains(shapes[shapeIndex])
      blinkColor = shapes[shapeIndex].blink
      occupied.fill(0)
      live = 0
      phase = 'rain'
      phaseMs = 0
      sandAcc = 0
    }

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      // Cap the step so a backgrounded tab doesn't come back to grains
      // launched out of the canvas by one enormous delta.
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      phaseMs += dt * 1000

      if (phase === 'rain') {
        sandAcc += dt * 1000
        let settled = false
        while (sandAcc >= SAND_STEP_MS) {
          sandAcc -= SAND_STEP_MS
          if (stepSand() === 0 && live === grains.length) settled = true
        }
        if (settled || phaseMs > RAIN_MAX_MS) enterGather()
      } else if (phase === 'gather') {
        // Underdamped spring: the grains overshoot their slot by a hair and
        // snap back, which is what makes it look like they were pulled.
        for (const grain of grains) {
          grain.vx += (grain.tx - grain.x) * 90 * dt - grain.vx * 12 * dt
          grain.vy += (grain.ty - grain.y) * 90 * dt - grain.vy * 12 * dt
          grain.x += grain.vx * dt
          grain.y += grain.vy * dt
        }
        if (phaseMs >= GATHER_MS) {
          for (const grain of grains) {
            grain.x = grain.tx
            grain.y = grain.ty
          }
          phase = 'hold'
          phaseMs = 0
        }
      } else if (phase === 'hold') {
        if (phaseMs >= HOLD_MS) enterScatter()
      } else {
        for (const grain of grains) {
          grain.vy += 34 * dt
          grain.x += grain.vx * dt
          grain.y += grain.vy * dt
          grain.alpha = Math.max(0, 1 - phaseMs / SCATTER_MS)
        }
        if (phaseMs >= SCATTER_MS) nextShape()
      }

      draw(now)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [mode])

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div
        className="w-full overflow-hidden rounded-lg"
        style={{
          background: 'linear-gradient(180deg, rgba(2,8,10,0.9), rgba(10,31,28,0.55))',
          border: '1px solid var(--cc-mint-line)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={GRID_W}
          height={GRID_H}
          aria-hidden="true"
          style={{ display: 'block', width: '100%', imageRendering: 'pixelated' }}
        />
      </div>

      <p
        aria-hidden="true"
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 11,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: 'var(--cc-mint)',
          textAlign: 'center',
          minHeight: 16,
        }}
      >
        {lines[lineIndex]}
      </p>

      <p
        style={{
          fontSize: 13,
          color: 'var(--cc-text-muted)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        “{prompt}”
      </p>

      <span className="sr-only" role="status">
        Summoning. This can take a minute.
      </span>

      <button
        type="button"
        className="cc-btn"
        onClick={onCancel}
        style={{
          fontSize: 12,
          padding: '8px 16px',
          minHeight: 36,
          borderRadius: 999,
          border: '1px solid var(--cc-mint-line)',
          color: 'var(--cc-text-muted)',
        }}
      >
        Never mind
      </button>
    </div>
  )
}

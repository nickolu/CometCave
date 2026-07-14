import { useCallback, useEffect, useRef } from 'react'

/* ---------------------------------------------------------------------------
   Starmatch — stardust burst
   A ceremonial flourish for a correct spot / a win. Purely decorative, fully
   suppressed under prefers-reduced-motion. Colors come from the design-system
   CSS variables (resolved to concrete values here, since a 2D canvas can't
   consume `var(...)` directly).
   -------------------------------------------------------------------------- */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  g: number
  life: number
  s: number
  rot: number
  vr: number
  c: string
}

const STARDUST_VARS = ['--sm-c0', '--sm-c1', '--sm-c2', '--sm-c3']
const FALLBACK = 'white'

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function readVar(name: string): string {
  if (typeof window === 'undefined') return FALLBACK
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || FALLBACK
}

/** Resolve either a raw color or a `var(--x)` reference to a concrete string. */
function resolveColor(color?: string): string | null {
  if (!color) return null
  const m = color.match(/^var\((--[\w-]+)\)$/)
  return m ? readVar(m[1]) : color
}

export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const partsRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const reduceRef = useRef(false)
  const stardustRef = useRef<string[]>([FALLBACK])
  // The animation loop lives on a ref so `burst` can stay identity-stable and
  // re-schedule itself; it's assigned in the effect (never during render).
  const stepRef = useRef<() => void>(() => {})

  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    stardustRef.current = [...STARDUST_VARS.map(readVar), FALLBACK]

    const step = () => {
      const canvas = canvasRef.current
      const cx = canvas?.getContext('2d')
      if (!canvas || !cx) {
        rafRef.current = null
        return
      }
      cx.clearRect(0, 0, canvas.width, canvas.height)
      const parts = partsRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.vy += p.g
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life--
        if (p.life <= 0 || p.y > canvas.height + 40) {
          parts.splice(i, 1)
          continue
        }
        cx.save()
        cx.translate(p.x, p.y)
        cx.rotate(p.rot)
        cx.fillStyle = p.c
        cx.globalAlpha = Math.max(0, Math.min(1, p.life / 30))
        cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6)
        cx.restore()
      }
      if (parts.length) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        cx.clearRect(0, 0, canvas.width, canvas.height)
        rafRef.current = null
      }
    }
    stepRef.current = step

    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      partsRef.current = []
    }
  }, [])

  const burst = useCallback((x: number, y: number, color?: string) => {
    if (reduceRef.current) return
    const lead = resolveColor(color)
    const colors = lead ? [lead, ...stardustRef.current] : stardustRef.current
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2)
      const sp = rand(4, 13)
      partsRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 4,
        g: rand(0.22, 0.4),
        life: rand(45, 85),
        s: rand(5, 11),
        rot: rand(0, 6.28),
        vr: rand(-0.3, 0.3),
        c: colors[(Math.random() * colors.length) | 0],
      })
    }
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(stepRef.current)
  }, [])

  return { canvasRef, burst }
}

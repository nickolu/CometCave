'use client'

import { useEffect, useRef } from 'react'

import { VOICE_PEAK } from '@/app/hum/lib/audio'

/* The scope: the big round screen (docs/hum-design.md §2.1).

   CLOSE draws the last 20 ms of the actual signal. The window is a fixed
   length of time on purpose — if it stretched to fit the pitch, raising the
   pitch wouldn't visibly squeeze the waves, and lesson 2 would have nothing
   to show. Each frame starts where the wave crosses zero going up (a
   "trigger"), so a steady tone stands still instead of sliding.

   WIDE draws how loud the sound was over the last second, so a note's
   outline — its envelope — is visible. */

export type ScopeView = 'close' | 'wide'

const CLOSE_SECONDS = 0.02
const WIDE_SECONDS = 1
/** One voice at full volume reaches this fraction of the radius. */
const FULL = 0.6

/** The scope's colours live in hum.css as custom properties; the canvas
 *  reads them once per mount. */
function palette(el: HTMLElement) {
  const css = getComputedStyle(el)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    trace: v('--hum-trace'),
    bezel: [v('--hum-bezel-1'), v('--hum-bezel-2'), v('--hum-bezel-3')],
    glass: [v('--hum-glass-1'), v('--hum-glass-2'), v('--hum-glass-3')],
  }
}

type Palette = ReturnType<typeof palette>

export function Scope({
  analyser,
  view,
  reducedMotion,
  label,
}: {
  analyser: AnalyserNode | null
  view: ScopeView
  reducedMotion: boolean
  label: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const history = useRef<{ t: number; peak: number }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return

    const colors = palette(canvas)
    let raf = 0
    let buf: Float32Array<ArrayBuffer> | null = null
    const trails: Float32Array[] = []

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const size = canvas.clientWidth
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr)
        canvas.height = Math.round(size * dpr)
      }
      const w = canvas.width
      const c = w / 2
      const r = c * 0.94
      const amp = (r * FULL) / VOICE_PEAK

      drawGlass(g, w, c, r, colors)

      g.save()
      g.beginPath()
      g.arc(c, c, r, 0, Math.PI * 2)
      g.clip()
      g.lineJoin = 'round'
      g.lineCap = 'round'
      g.strokeStyle = colors.trace
      g.lineWidth = 2.2 * dpr
      g.shadowColor = colors.trace
      g.shadowBlur = 10 * dpr

      if (!analyser) {
        flat(g, c, r)
      } else {
        if (!buf || buf.length !== analyser.fftSize) buf = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(buf)
        const rate = analyser.context.sampleRate

        if (view === 'close') {
          const n = Math.min(buf.length >> 1, Math.round(rate * CLOSE_SECONDS))
          const start = trigger(buf, buf.length - n)
          const slice = buf.slice(start, start + n)
          if (!reducedMotion) {
            // Afterimages: the last two frames, dimmer, like phosphor fading.
            trails.forEach((t, i) => {
              g.globalAlpha = 0.12 * (i + 1)
              line(g, t, c, r, amp)
            })
            trails.push(slice)
            if (trails.length > 2) trails.shift()
            g.globalAlpha = 1
          }
          line(g, slice, c, r, amp)
        } else {
          const now = performance.now() / 1000
          const recent = Math.round(rate / 60)
          let peak = 0
          for (let i = buf.length - recent; i < buf.length; i++)
            peak = Math.max(peak, Math.abs(buf[i]))
          const h = history.current
          h.push({ t: now, peak })
          while (h.length && h[0].t < now - WIDE_SECONDS) h.shift()
          envelope(g, h, now, c, r, amp)
        }
      }
      g.restore()
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [analyser, view, reducedMotion])

  return <canvas ref={canvasRef} className="hum-scope" role="img" aria-label={label} />
}

function drawGlass(g: CanvasRenderingContext2D, w: number, c: number, r: number, colors: Palette) {
  g.clearRect(0, 0, w, w)

  // Bezel
  const bezel = g.createLinearGradient(0, 0, w, w)
  colors.bezel.forEach((col, i) => bezel.addColorStop(i / 2, col))
  g.fillStyle = bezel
  g.beginPath()
  g.arc(c, c, c, 0, Math.PI * 2)
  g.fill()

  // Glass
  const glass = g.createRadialGradient(c, c * 0.85, r * 0.1, c, c, r)
  colors.glass.forEach((col, i) => glass.addColorStop([0, 0.7, 1][i], col))
  g.fillStyle = glass
  g.beginPath()
  g.arc(c, c, r, 0, Math.PI * 2)
  g.fill()

  // Graticule: a ruled grid, faint, and a brighter centre line (silence).
  g.save()
  g.beginPath()
  g.arc(c, c, r, 0, Math.PI * 2)
  g.clip()
  g.strokeStyle = 'rgba(125, 252, 224, 0.07)'
  g.lineWidth = 1
  const cell = r / 4
  for (let i = -4; i <= 4; i++) {
    g.beginPath()
    g.moveTo(c + i * cell, c - r)
    g.lineTo(c + i * cell, c + r)
    g.moveTo(c - r, c + i * cell)
    g.lineTo(c + r, c + i * cell)
    g.stroke()
  }
  g.strokeStyle = 'rgba(125, 252, 224, 0.16)'
  for (let i = -16; i <= 16; i++) {
    const x = c + (i * r) / 16
    g.beginPath()
    g.moveTo(x, c - 4)
    g.lineTo(x, c + 4)
    g.stroke()
  }
  g.restore()

  // Inner rim and a soft highlight across the top of the glass.
  g.strokeStyle = 'rgba(125, 252, 224, 0.25)'
  g.lineWidth = 1.5
  g.beginPath()
  g.arc(c, c, r, 0, Math.PI * 2)
  g.stroke()
  const shine = g.createLinearGradient(0, c - r, 0, c)
  shine.addColorStop(0, 'rgba(255,255,255,0.06)')
  shine.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = shine
  g.beginPath()
  g.ellipse(c, c - r * 0.45, r * 0.8, r * 0.45, 0, 0, Math.PI * 2)
  g.fill()
}

function flat(g: CanvasRenderingContext2D, c: number, r: number) {
  g.beginPath()
  g.moveTo(c - r, c)
  g.lineTo(c + r, c)
  g.stroke()
}

/** First upward zero crossing in the first part of the buffer, so the drawn
 *  window always starts at the same point in the wave. */
function trigger(buf: Float32Array, limit: number): number {
  for (let i = 1; i < limit; i++) {
    if (buf[i - 1] < 0 && buf[i] >= 0) return i
  }
  return limit
}

function line(g: CanvasRenderingContext2D, data: Float32Array, c: number, r: number, amp: number) {
  g.beginPath()
  const n = data.length
  for (let i = 0; i < n; i++) {
    const x = c - r + (i / (n - 1)) * 2 * r
    const y = c - data[i] * amp
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
}

function envelope(
  g: CanvasRenderingContext2D,
  h: { t: number; peak: number }[],
  now: number,
  c: number,
  r: number,
  amp: number
) {
  if (h.length < 2) return flat(g, c, r)
  const x = (t: number) => c + r - ((now - t) / WIDE_SECONDS) * 2 * r
  g.beginPath()
  g.moveTo(x(h[0].t), c - h[0].peak * amp)
  for (const p of h) g.lineTo(x(p.t), c - p.peak * amp)
  for (let i = h.length - 1; i >= 0; i--) g.lineTo(x(h[i].t), c + h[i].peak * amp)
  g.closePath()
  g.fillStyle = 'rgba(125, 252, 224, 0.18)'
  g.fill()
  g.stroke()
  // The flat line still runs through the quiet stretches.
  g.beginPath()
  g.moveTo(c - r, c)
  g.lineTo(x(h[0].t), c)
  g.stroke()
}

'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  a: number
  tw: number
  twS: number
  hue: number
}

export function AmbientBG() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let stars: Star[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.floor((w * h) / 8000)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random() * 0.7 + 0.2,
        tw: Math.random() * Math.PI * 2,
        twS: Math.random() * 0.015 + 0.003,
        hue: Math.random() < 0.7 ? 165 : Math.random() < 0.5 ? 200 : 50,
      }))
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const tick = () => {
      ctx.clearRect(0, 0, w, h)

      const g1 = ctx.createRadialGradient(
        w * 0.15,
        h * 0.15,
        0,
        w * 0.15,
        h * 0.15,
        Math.max(w, h) * 0.5
      )
      g1.addColorStop(0, 'rgba(94, 234, 212, 0.12)')
      g1.addColorStop(0.5, 'rgba(94, 234, 212, 0.04)')
      g1.addColorStop(1, 'transparent')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, w, h)

      const g2 = ctx.createRadialGradient(
        w * 0.85,
        h * 0.8,
        0,
        w * 0.85,
        h * 0.8,
        Math.max(w, h) * 0.5
      )
      g2.addColorStop(0, 'rgba(45, 212, 191, 0.10)')
      g2.addColorStop(0.5, 'rgba(45, 212, 191, 0.03)')
      g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, w, h)

      const g3 = ctx.createRadialGradient(
        w * 0.55,
        h * 0.55,
        0,
        w * 0.55,
        h * 0.55,
        Math.max(w, h) * 0.4
      )
      g3.addColorStop(0, 'rgba(255, 209, 102, 0.04)')
      g3.addColorStop(1, 'transparent')
      ctx.fillStyle = g3
      ctx.fillRect(0, 0, w, h)

      stars.forEach(s => {
        s.tw += s.twS
        const tw = (Math.sin(s.tw) + 1) / 2
        ctx.globalAlpha = s.a * (0.3 + 0.7 * tw)
        ctx.fillStyle = `hsl(${s.hue}, 70%, ${75 + tw * 15}%)`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

export function TickingNumber({
  value,
  duration = 200,
  format,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
}) {
  const reducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  const raf = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = prev.current
    const to = value
    prev.current = value

    if (from === to || reducedMotion) {
      setDisplay(to)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) * (1 - t) // ease-out quad
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value, duration, reducedMotion])

  return <>{format ? format(display) : display.toLocaleString()}</>
}

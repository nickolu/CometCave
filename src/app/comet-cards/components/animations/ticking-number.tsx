'use client'

import { useEffect, useRef, useState } from 'react'

export function TickingNumber({
  value,
  duration = 300,
}: {
  value: number
  duration?: number
}) {
  const [displayed, setDisplayed] = useState(value)
  const startRef = useRef(value)
  const endRef = useRef(value)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === endRef.current) return

    startRef.current = displayed
    endRef.current = value
    startTimeRef.current = null

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    function tick(now: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = now
      }
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const current = Math.round(startRef.current + (endRef.current - startRef.current) * progress)
      setDisplayed(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <>{displayed}</>
}

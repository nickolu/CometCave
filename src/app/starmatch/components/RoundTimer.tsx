'use client'

import { useEffect, useState } from 'react'

/* Isolated so the whole arena doesn't re-render on every tick. Freezes at the
   last value when `running` is false (i.e. while a spot resolves). */
export function RoundTimer({ roundStart, running }: { roundStart: number; running: boolean }) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!running) return
    const tick = () => setSecs((performance.now() - roundStart) / 1000)
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [roundStart, running])

  return <span>{secs.toFixed(1)}</span>
}

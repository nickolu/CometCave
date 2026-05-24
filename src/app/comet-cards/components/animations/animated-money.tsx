'use client'

import { useEffect, useRef, useState } from 'react'
import { TickingNumber } from './ticking-number'

export function AnimatedMoney({ value }: { value: number }) {
  const prev = useRef(value)
  const [flash, setFlash] = useState<'gain' | 'loss' | null>(null)

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? 'gain' : 'loss')
      prev.current = value
      const timer = setTimeout(() => setFlash(null), 600)
      return () => clearTimeout(timer)
    }
  }, [value])

  const color = flash === 'gain'
    ? 'var(--cc-mint)'
    : flash === 'loss'
    ? 'var(--cc-pink)'
    : 'var(--cc-gold)'

  return (
    <span
      style={{
        color,
        transition: 'color 0.3s',
      }}
    >
      $<TickingNumber value={value} duration={300} />
    </span>
  )
}

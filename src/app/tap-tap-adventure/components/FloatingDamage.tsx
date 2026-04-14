'use client'

import { useEffect, useState } from 'react'

export interface DamageEvent {
  id: string
  amount: number
  isCritical: boolean
  target: 'player' | 'enemy'
  isDot: boolean        // true for poison/burn tick damage
  dotType?: 'poison' | 'burn'  // which status effect
  effectiveness?: 'super' | 'resisted' | null  // elemental matchup
}

interface FloatingDamageProps {
  events: DamageEvent[]
}

export function FloatingDamage({ events }: FloatingDamageProps) {
  return (
    <>
      {events.map(event => (
        <FloatingNumber key={event.id} event={event} />
      ))}
    </>
  )
}

function FloatingNumber({ event }: { event: DamageEvent }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const isPlayer = event.target === 'player'
  // Color by damage type
  const color = event.isCritical
    ? 'text-yellow-300'
    : event.isDot && event.dotType === 'poison'
      ? 'text-green-400'
      : event.isDot && event.dotType === 'burn'
        ? 'text-orange-400'
        : isPlayer
          ? 'text-red-400'
          : 'text-green-400'

  const size = event.isCritical
    ? 'text-lg font-black'
    : event.isDot
      ? 'text-xs font-semibold italic'
      : 'text-sm font-bold'
  // Stagger horizontal position slightly based on id hash
  const offset = ((event.id.charCodeAt(0) ?? 0) % 5) * 10 - 20

  return (
    <span
      className={`absolute animate-float-up pointer-events-none ${color} ${size} drop-shadow-lg`}
      style={{
        left: `calc(50% + ${offset}px)`,
        top: '0',
      }}
    >
      {event.isCritical && '★ '}
      {event.isDot ? `${event.amount} ${event.dotType}` : `-${event.amount}`}
      {event.isCritical && ' ★'}
    </span>
  )
}

'use client'

import { useEffect, useState } from 'react'

export interface ResourceEvent {
  id: string
  type: 'gold' | 'reputation' | 'item'
  value: number    // positive = gain, negative = loss
  label?: string   // item name for type 'item'
}

interface FloatingResourcesProps {
  events: ResourceEvent[]
}

export function FloatingResources({ events }: FloatingResourcesProps) {
  return (
    <>
      {events.map((event, i) => (
        <FloatingResource key={event.id} event={event} index={i} />
      ))}
    </>
  )
}

function FloatingResource({ event, index }: { event: ResourceEvent; index: number }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const isPositive = event.value > 0
  const color = isPositive ? 'text-green-400' : 'text-red-400'
  const icon = event.type === 'gold' ? '💰' : event.type === 'reputation' ? '⭐' : '🎁'
  const label = event.type === 'item' ? event.label : event.type === 'gold' ? 'Gold' : 'Rep'
  const sign = isPositive ? '+' : ''
  // Stagger vertically so multiple rewards don't overlap
  const topOffset = index * 24

  return (
    <span
      className={`absolute animate-float-up pointer-events-none ${color} text-sm font-bold drop-shadow-lg whitespace-nowrap`}
      style={{
        left: '50%',
        top: `${topOffset}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {icon} {sign}{event.value} {label}
    </span>
  )
}

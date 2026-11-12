'use client'

import { useEffect, useState } from 'react'

import { ResourceGlyph } from '@/app/tap-tap-adventure/stage/glyphs'
import { Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

export interface ResourceEvent {
  id: string
  type: 'gold' | 'reputation' | 'item'
  value: number    // positive = gain, negative = loss
  label?: string   // item name for type 'item'
  rarity?: string  // item rarity for color coding
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
  const tone: StampTone =
    event.type === 'item'
      ? event.rarity === 'legendary' ? 'gold' : event.rarity === 'epic' || event.rarity === 'rare' ? 'violet' : 'ink'
      : isPositive ? 'green' : 'red'
  const label = event.type === 'item' ? event.label : event.type === 'gold' ? 'gold' : 'repute'
  const sign = isPositive ? '+' : ''
  // Stagger vertically so multiple rewards don't overlap
  const topOffset = index * 26

  return (
    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-float-up whitespace-nowrap" style={{ top: `${topOffset}px` }}>
      <Stamp tone={tone} animate className="bg-ps-playbill text-xs">
        <ResourceGlyph kind={event.type} size={12} /> {event.type === 'item' ? label : `${sign}${event.value} ${label}`}
      </Stamp>
    </span>
  )
}

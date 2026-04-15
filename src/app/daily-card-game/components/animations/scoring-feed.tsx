'use client'

import { useEffect, useRef, useState } from 'react'

import { isCustomScoringEvent } from '@/app/daily-card-game/domain/game/types'
import type { ScoringEvent } from '@/app/daily-card-game/domain/game/types'
import { useDailyCardGameStore } from '@/app/daily-card-game/store'

interface ActiveEvent {
  id: string
  event: ScoringEvent
}

export function ScoringFeed() {
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([])
  const scoringEvents = useDailyCardGameStore(state => state.game.gamePlayState.scoringEvents)
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const newEvents: ActiveEvent[] = []
    for (const event of scoringEvents) {
      if (isCustomScoringEvent(event)) continue
      if (seenIdsRef.current.has(event.id)) continue
      seenIdsRef.current.add(event.id)
      newEvents.push({ id: event.id, event })
    }
    if (newEvents.length > 0) {
      setActiveEvents(prev => [...prev, ...newEvents])
    }
  }, [scoringEvents])

  // Clean up seenIds when scoringEvents is cleared
  useEffect(() => {
    if (scoringEvents.length === 0) {
      seenIdsRef.current.clear()
    }
  }, [scoringEvents.length])

  const removeEvent = (id: string) => {
    setActiveEvents(prev => prev.filter(e => e.id !== id))
  }

  if (activeEvents.length === 0) return null

  return (
    <div className="pointer-events-none flex flex-col gap-1 pl-2">
      {activeEvents.map(({ id, event }) => {
        const isMultiplicative = event.type === 'mult' && event.operator === 'x'
        const isChips = event.type === 'chips'

        let colorClass: string
        let label: string

        if (isChips) {
          colorClass = 'text-blue-300'
          label = `+${event.value}`
        } else if (isMultiplicative) {
          colorClass = 'text-yellow-300 font-bold'
          label = `×${event.value}`
        } else {
          colorClass = 'text-orange-400'
          label = `+${event.value}`
        }

        return (
          <div
            key={id}
            className={`animate-float-up text-sm font-semibold ${colorClass}`}
            onAnimationEnd={() => removeEvent(id)}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import { jokers as jokerDefinitions } from '@/app/comet-cards/domain/joker/jokers'
import { isCustomScoringEvent } from '@/app/comet-cards/domain/game/types'
import type { ScoringEvent } from '@/app/comet-cards/domain/game/types'
import { useCometCardsStore } from '@/app/comet-cards/store'

export interface JokerActivationState {
  /** Which joker name is currently mid-animation (null when idle) */
  activeJokerName: string | null
  /** The contribution label to show for the active joker, e.g. "+4 mult" or "x2 mult" */
  activeJokerLabel: string | null
  /** Set of all joker names that have fired (for dimming non-active jokers) */
  firedJokerNames: Set<string>
  /** Increments each time ANY joker activates (forces React key remount for CSS re-trigger) */
  activationKey: number
}

interface QueueEntry {
  name: string
  label: string
}

const STAGGER_MS = 120

/**
 * Formats a group of scoring events for one joker into a human-readable label.
 * Groups chips and mult contributions together.
 */
function buildLabel(events: ScoringEvent[]): string {
  let chipsTotal = 0
  let multTotal = 0
  let xMultTotal = 0

  for (const evt of events) {
    if (evt.type === 'chips') {
      chipsTotal += evt.value
    } else if (evt.type === 'mult') {
      if (evt.operator === 'x') {
        xMultTotal += evt.value
      } else {
        multTotal += evt.value
      }
    }
  }

  const parts: string[] = []
  if (chipsTotal > 0) parts.push(`+${chipsTotal} chips`)
  if (multTotal > 0) parts.push(`+${multTotal} mult`)
  if (xMultTotal > 0) parts.push(`x${xMultTotal} mult`)

  return parts.join('  ') || '+?'
}

export function useJokerActivationSequence(): JokerActivationState {
  const scoringEvents = useCometCardsStore(state => state.game.gamePlayState.scoringEvents)
  const jokers = useCometCardsStore(state => state.game.jokers)

  const [activeJokerName, setActiveJokerName] = useState<string | null>(null)
  const [activeJokerLabel, setActiveJokerLabel] = useState<string | null>(null)
  const [firedJokerNames, setFiredJokerNames] = useState<Set<string>>(new Set())
  const [activationKey, setActivationKey] = useState(0)

  // Ref to track which event IDs we've already processed
  const seenEventIdsRef = useRef<Set<string>>(new Set())
  // Ref for the pending queue (not state, so no re-renders on enqueue)
  const pendingQueueRef = useRef<QueueEntry[]>([])
  // Ref to track if the drain timer is running
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to know if we're currently draining
  const isDrainingRef = useRef(false)

  // Build a set of known joker names from the current jokers list (for filtering)
  const jokerNameToPositionRef = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    const map = new Map<string, number>()
    jokers.forEach((joker, idx) => {
      const def = jokerDefinitions[joker.jokerId]
      if (def) map.set(def.name, idx)
    })
    jokerNameToPositionRef.current = map
  }, [jokers])

  // Drain function: pop one entry from the queue, set active joker, schedule next
  const drainQueue = () => {
    const queue = pendingQueueRef.current
    if (queue.length === 0) {
      isDrainingRef.current = false
      setActiveJokerName(null)
      setActiveJokerLabel(null)
      return
    }

    const entry = queue.shift()!
    isDrainingRef.current = true

    setFiredJokerNames(prev => {
      const next = new Set(prev)
      next.add(entry.name)
      return next
    })
    setActiveJokerName(entry.name)
    setActiveJokerLabel(entry.label)
    setActivationKey(prev => prev + 1)

    drainTimerRef.current = setTimeout(() => {
      drainQueue()
    }, STAGGER_MS)
  }

  // When scoringEvents resets to empty, clear all state
  useEffect(() => {
    if (scoringEvents.length === 0) {
      seenEventIdsRef.current.clear()
      pendingQueueRef.current = []
      isDrainingRef.current = false
      if (drainTimerRef.current !== null) {
        clearTimeout(drainTimerRef.current)
        drainTimerRef.current = null
      }
      setActiveJokerName(null)
      setActiveJokerLabel(null)
      setFiredJokerNames(new Set())
      // Don't reset activationKey — keep it incrementing across hands
    }
  }, [scoringEvents.length])

  // When new scoring events arrive, detect new joker-sourced ones and enqueue
  useEffect(() => {
    if (scoringEvents.length === 0) return

    const jokerNameToPosition = jokerNameToPositionRef.current

    // Group new events by joker name
    const newByJoker = new Map<string, ScoringEvent[]>()

    for (const evt of scoringEvents) {
      if (isCustomScoringEvent(evt)) continue
      if (seenEventIdsRef.current.has(evt.id)) continue
      seenEventIdsRef.current.add(evt.id)

      // Only process if source matches a known joker name
      if (!jokerNameToPosition.has(evt.source)) continue

      const group = newByJoker.get(evt.source)
      if (group) {
        group.push(evt)
      } else {
        newByJoker.set(evt.source, [evt])
      }
    }

    if (newByJoker.size === 0) return

    // Sort by joker position (left-to-right)
    const sorted = Array.from(newByJoker.entries()).sort(([nameA], [nameB]) => {
      const posA = jokerNameToPosition.get(nameA) ?? 999
      const posB = jokerNameToPosition.get(nameB) ?? 999
      return posA - posB
    })

    // Enqueue
    for (const [name, events] of sorted) {
      pendingQueueRef.current.push({ name, label: buildLabel(events) })
    }

    // Start draining if not already
    if (!isDrainingRef.current) {
      drainQueue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoringEvents])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (drainTimerRef.current !== null) {
        clearTimeout(drainTimerRef.current)
      }
    }
  }, [])

  return { activeJokerName, activeJokerLabel, firedJokerNames, activationKey }
}

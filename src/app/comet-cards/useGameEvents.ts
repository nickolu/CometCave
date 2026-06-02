'use client'

import { useEffect } from 'react'

import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useRunHistory } from '@/app/comet-cards/hooks/useRunHistory'
import { useGameState } from '@/app/comet-cards/useGameState'
import { consumePendingStaleSession } from '@/app/comet-cards/store'

const STORAGE_KEY = 'comet-cards-run-history'
const TOTAL_ROUNDS = 8

export const useGameEvents = () => {
  const { dispatch } = useGameState()
  const { addRun } = useRunHistory()

  // Record score from a stale session that was expired on load
  useEffect(() => {
    const stale = consumePendingStaleSession()
    if (!stale) return

    // Check if there's already a recorded run for this seed (= practice run)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const history = JSON.parse(raw) as { runs: Array<{ seed: string }> }
        if (history.runs.some(r => r.seed === stale.gameSeed)) return
      }
    } catch {
      // If we can't read history, record the run to be safe
    }

    const roundsCompleted = Math.max(0, Math.min(TOTAL_ROUNDS, stale.roundIndex - 1))
    addRun({
      seed: stale.gameSeed,
      date: stale.gameSeed, // The seed IS the PST date string
      totalScore: stale.totalScore.toString(),
      handsPlayed: stale.handsPlayed,
      roundsCompleted,
      totalRounds: TOTAL_ROUNDS,
      won: roundsCompleted >= TOTAL_ROUNDS,
    })
  }, [addRun])

  useEffect(() => {
    return eventEmitter.onAny(event => dispatch(event))
  }, [dispatch])
}

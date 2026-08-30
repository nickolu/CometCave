'use client'

import { useEffect } from 'react'

import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useRunHistory } from '@/app/comet-cards/hooks/useRunHistory'
import { useGameState } from '@/app/comet-cards/useGameState'
import { consumePendingStaleSession } from '@/app/comet-cards/store'

const STORAGE_KEY = 'comet-cards-run-history'
const TOTAL_ROUNDS: Record<string, number> = { endless: 8, lastAnte: 1 }

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

    const totalRounds = TOTAL_ROUNDS[stale.mode] ?? TOTAL_ROUNDS.endless
    // An abandoned run never finished a round, so it is recorded as a loss.
    const roundsCompleted =
      stale.mode === 'lastAnte' ? 0 : Math.max(0, Math.min(totalRounds, stale.roundIndex - 1))
    addRun({
      mode: stale.mode,
      seed: stale.gameSeed,
      // The seed carries the PST date it was built from.
      date: stale.gameSeed.slice(0, 10),
      totalScore: stale.totalScore.toString(),
      handsPlayed: stale.handsPlayed,
      roundsCompleted,
      totalRounds,
      won: roundsCompleted >= totalRounds,
    })
  }, [addRun])

  useEffect(() => {
    return eventEmitter.onAny(event => dispatch(event))
  }, [dispatch])
}

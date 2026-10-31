'use client'

import { useCallback, useEffect, useState } from 'react'

import { parseProgress, readProgressRaw } from '@/app/meteor-coins/lib/progress'
import {
  type MyScores,
  type ScoreResult,
  fetchMyScores,
  postResults,
  unsentResults,
} from '@/app/meteor-coins/lib/scoreboard'
import { useAuth } from '@/hooks/useAuth'
import { saveNickname } from '@/lib/users/nickname'

export type ScoresStatus = 'off' | 'loading' | 'ready' | 'failed'

/**
 * The player's scores on the server, kept in step with this browser.
 *
 * On load it fetches the player's standing, then sends any local bests the
 * server lacks (scores made before scores were kept, or saved on a day the
 * network was down) and refreshes a stale name. `send` saves a run's result
 * and returns the new standing. 'off' means there is no account to score
 * under (auth isn't configured), so nothing is shown.
 */
export function useScores() {
  const { user, loading, configured } = useAuth()
  const [status, setStatus] = useState<ScoresStatus>('loading')
  const [scores, setScores] = useState<MyScores | null>(null)

  const send = useCallback(
    async (results: ScoreResult[]): Promise<MyScores | null> => {
      if (!user) return null
      const token = await user.getIdToken().catch(() => null)
      const next = token ? await postResults(token, results) : null
      setStatus(next ? 'ready' : 'failed')
      if (next) setScores(next)
      return next
    },
    [user]
  )

  const setNickname = useCallback(
    async (name: string) => {
      if (!user) throw new Error('Not signed in.')
      await saveNickname(user, name)
      await send([])
    },
    [user, send]
  )

  useEffect(() => {
    if (!configured || loading || !user) return
    let cancelled = false
    ;(async () => {
      const token = await user.getIdToken().catch(() => null)
      const mine = token ? await fetchMyScores(token) : null
      if (cancelled) return
      if (!mine || !token) {
        setStatus('failed')
        return
      }
      const unsent = unsentResults(parseProgress(readProgressRaw()), mine.stages)
      const after = unsent.length > 0 || mine.nameStale ? await postResults(token, unsent) : null
      if (cancelled) return
      // A failed top-up is tried again next visit; the standing read still counts.
      setScores(after ?? mine)
      setStatus('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [configured, loading, user])

  const effective: ScoresStatus = !configured ? 'off' : !loading && !user ? 'failed' : status
  const signedUp = scores?.signedUp ?? (user ? !user.isAnonymous : false)

  return { user, status: effective, scores, signedUp, send, setNickname }
}

import { Timestamp } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'

export const WINDOW_MS = 60 * 60 * 1000 // 1 hour
export const MAX_GENERATIONS_PER_WINDOW = 100

/**
 * Atomically check whether the given uid has exceeded the on-demand generation
 * rate limit for the current window. Increments the counter on success.
 *
 * Returns `true` if the request should be rate-limited (i.e. caller must reject).
 *
 * Stored at `users/{uid}/triviaInfiniteMeta/generationLimit` to keep limit
 * state out of the user-visible run/stats subtrees.
 */
export async function checkAndIncrementGenerationLimit(uid: string): Promise<{
  limited: boolean
  remaining: number
}> {
  const db = getFirestoreDb()
  const ref = db.doc(`users/${uid}/triviaInfiniteMeta/generationLimit`)
  const now = Date.now()

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data()
    const prevWindowStart: number = data?.windowStart?.toMillis?.() ?? 0
    let count: number = data?.count ?? 0
    let windowStart = prevWindowStart

    if (now - prevWindowStart > WINDOW_MS) {
      windowStart = now
      count = 0
    }

    if (count >= MAX_GENERATIONS_PER_WINDOW) {
      return { limited: true, remaining: 0 }
    }

    const nextCount = count + 1
    tx.set(ref, {
      count: nextCount,
      windowStart: Timestamp.fromMillis(windowStart),
    })
    return {
      limited: false,
      remaining: MAX_GENERATIONS_PER_WINDOW - nextCount,
    }
  })
}

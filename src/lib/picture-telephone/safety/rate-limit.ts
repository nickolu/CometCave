import { Timestamp } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'

import { MODERATE_RATE_MAX, MODERATE_RATE_WINDOW_MS } from './config'

export interface RateState {
  windowStart: number
  count: number
}

export interface RateDecision {
  limited: boolean
  remaining: number
  next: RateState
}

/** Pure fixed-window limiter, the same shape as the trivia generation limit. */
export function decideRateLimit(
  prev: RateState | null,
  now: number,
  max = MODERATE_RATE_MAX,
  windowMs = MODERATE_RATE_WINDOW_MS
): RateDecision {
  let windowStart = prev?.windowStart ?? 0
  let count = prev?.count ?? 0
  if (!prev || now - windowStart > windowMs) {
    windowStart = now
    count = 0
  }
  if (count >= max) return { limited: true, remaining: 0, next: { windowStart, count } }
  return { limited: false, remaining: max - (count + 1), next: { windowStart, count: count + 1 } }
}

/** Counts one `moderate` call for the uid. Throws if Firestore fails (the route then fails closed). */
export async function checkAndIncrementModerateLimit(uid: string): Promise<{ limited: boolean; remaining: number }> {
  const db = getFirestoreDb()
  const ref = db.doc(`users/${uid}/pictureTelephoneMeta/moderateLimit`)
  return db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data()
    const prev: RateState | null = data
      ? { windowStart: data.windowStart?.toMillis?.() ?? 0, count: data.count ?? 0 }
      : null
    const d = decideRateLimit(prev, Date.now())
    if (!d.limited) {
      tx.set(ref, { count: d.next.count, windowStart: Timestamp.fromMillis(d.next.windowStart) })
    }
    return { limited: d.limited, remaining: d.remaining }
  })
}

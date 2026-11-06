/**
 * Daily AI credit metering, one document per player per day.
 *
 * Stored at `users/{uid}/aiUsage/{YYYY-MM-DD}` (Pacific date). The document
 * holds the credits spent so far and a per-feature breakdown, which is what
 * makes the owner's "where is the money going" question answerable from the
 * Firestore console without any other tooling.
 *
 * The check-and-spend is a transaction so two requests racing at the limit
 * cannot both get through. If Firestore itself fails, the caller treats it as
 * "not allowed" — a short outage for players beats an unmetered hour.
 */
import { FieldValue } from 'firebase-admin/firestore'

import { type AiFeature, DAILY_CREDITS, costOf } from '@/lib/ai/limits'
import { getTodayPST } from '@/lib/dates'
import { getFirestoreDb } from '@/lib/firebase/server'

export interface SpendDecision {
  allowed: boolean
  /** Credits left after this call, or before it when refused. */
  remaining: number
  spent: number
}

/**
 * Pure decision: given credits already spent today, may a call costing `cost`
 * go through? Separated from Firestore so it can be tested on its own.
 */
export function decideSpend(spentSoFar: number, cost: number, budget = DAILY_CREDITS): SpendDecision {
  const spent = Math.max(0, spentSoFar)
  if (spent + cost > budget) {
    return { allowed: false, remaining: Math.max(0, budget - spent), spent }
  }
  const next = spent + cost
  return { allowed: true, remaining: budget - next, spent: next }
}

/** Midnight Pacific after the given Pacific date, as an ISO string. */
export function nextResetIso(todayPst: string = getTodayPST()): string {
  // Build "tomorrow at 00:00" in Pacific time. Offsets are -07:00 (PDT) or
  // -08:00 (PST); either is close enough for a "resets at" message and the
  // date rolls correctly for both.
  const [y, m, d] = todayPst.split('-').map(Number)
  const tomorrowUtcNoon = new Date(Date.UTC(y, m - 1, d + 1, 12))
  const tomorrow = tomorrowUtcNoon.toISOString().slice(0, 10)
  const offset = pacificOffsetFor(tomorrowUtcNoon)
  return new Date(`${tomorrow}T00:00:00${offset}`).toISOString()
}

function pacificOffsetFor(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-8'
  const match = name.match(/GMT([+-]\d+)/)
  const hours = match ? Number(match[1]) : -8
  const sign = hours < 0 ? '-' : '+'
  return `${sign}${String(Math.abs(hours)).padStart(2, '0')}:00`
}

export async function spendAiCredits(uid: string, feature: AiFeature): Promise<SpendDecision> {
  const db = getFirestoreDb()
  const day = getTodayPST()
  const ref = db.doc(`users/${uid}/aiUsage/${day}`)
  const cost = costOf(feature)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const spentSoFar = typeof snap.data()?.spent === 'number' ? (snap.data()!.spent as number) : 0
    const decision = decideSpend(spentSoFar, cost)
    if (!decision.allowed) return decision

    tx.set(
      ref,
      {
        day,
        spent: decision.spent,
        calls: FieldValue.increment(1),
        [`features.${feature}`]: FieldValue.increment(cost),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return decision
  })
}

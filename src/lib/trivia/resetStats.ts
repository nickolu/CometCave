import { getFirestoreDb } from '@/lib/firebase/server'

import type { CollectionReference, Firestore } from 'firebase-admin/firestore'

const BATCH_SIZE = 400

async function chunkedDeleteAll(
  db: Firestore,
  collectionRef: CollectionReference
): Promise<number> {
  let deleted = 0
  for (;;) {
    const snap = await collectionRef.limit(BATCH_SIZE).get()
    if (snap.empty) break
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
    deleted += snap.size
    if (snap.size < BATCH_SIZE) break
  }
  return deleted
}

export interface DailyResetResult {
  deletedDocs: number
  crownsRevoked: number
}

export interface InfiniteResetResult {
  deletedDocs: number
}

/**
 * Wipes a user's daily-trivia stats: profile aggregate, per-day game records,
 * leaderboard entries, and any weekly crowns they currently hold. The next
 * call to `ensureCrownsAwarded` will reassign revoked crowns to the next-best
 * remaining player automatically.
 */
export async function resetDailyStats(uid: string): Promise<DailyResetResult> {
  const db = getFirestoreDb()
  let deletedDocs = 0

  const profileRef = db.doc(`users/${uid}/triviaProfile/current`)
  const profileSnap = await profileRef.get()
  if (profileSnap.exists) {
    await profileRef.delete()
    deletedDocs += 1
  }

  deletedDocs += await chunkedDeleteAll(db, db.collection(`users/${uid}/triviaGames`))
  deletedDocs += await chunkedDeleteAll(db, db.collection(`users/${uid}/triviaDaily`))

  const weeklyCol = db.collection(`users/${uid}/triviaWeekly`)
  const weeklySnap = await weeklyCol.get()
  const weekKeys = new Set<string>()
  for (const doc of weeklySnap.docs) {
    const data = doc.data() as { weekKey?: string }
    if (typeof data.weekKey === 'string' && data.weekKey.length > 0) {
      weekKeys.add(data.weekKey)
    } else {
      weekKeys.add(doc.id)
    }
  }
  if (!weeklySnap.empty) {
    for (let i = 0; i < weeklySnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      for (const doc of weeklySnap.docs.slice(i, i + BATCH_SIZE)) batch.delete(doc.ref)
      await batch.commit()
    }
    deletedDocs += weeklySnap.size
  }

  let crownsRevoked = 0
  for (const weekKey of weekKeys) {
    const crownRef = db.doc(`weeklyCrowns/${weekKey}`)
    const crownSnap = await crownRef.get()
    if (!crownSnap.exists) continue
    const data = crownSnap.data() as { winnerUid?: string }
    if (data.winnerUid === uid) {
      await crownRef.delete()
      crownsRevoked += 1
      deletedDocs += 1
    }
  }

  return { deletedDocs, crownsRevoked }
}

/**
 * Wipes a user's infinite-trivia stats: lifetime aggregate, all run docs
 * (including any in-progress run), and per-category medal counters. Leaves
 * `seenQuestions` intact so the no-repeat filter still works, and leaves the
 * `aiQuestions/{qid}/answeredBy` analytics breadcrumb alone.
 */
export async function resetInfiniteStats(uid: string): Promise<InfiniteResetResult> {
  const db = getFirestoreDb()
  let deletedDocs = 0

  const aggregateRef = db.doc(`users/${uid}/triviaStats/aggregate`)
  const aggregateSnap = await aggregateRef.get()
  if (aggregateSnap.exists) {
    await aggregateRef.delete()
    deletedDocs += 1
  }

  deletedDocs += await chunkedDeleteAll(db, db.collection(`users/${uid}/triviaInfinite`))
  deletedDocs += await chunkedDeleteAll(db, db.collection(`users/${uid}/triviaCategoryStats`))

  return { deletedDocs }
}

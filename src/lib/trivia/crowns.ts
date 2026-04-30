import { getFirestoreDb } from '@/lib/firebase/server'
import { getWeekKey, getTodayPST } from '@/lib/dates'

interface CrownDoc {
  weekKey: string
  winnerUid: string
  winnerScore: number
}

/**
 * Ensures all past completed weeks have crown winners computed.
 * Returns all crown docs (one per week).
 *
 * Lazy: only queries triviaWeekly for un-awarded weeks.
 * Once a crown is written, it's never recomputed.
 */
export async function ensureCrownsAwarded(): Promise<CrownDoc[]> {
  const db = getFirestoreDb()

  // 1. Get all existing crown docs
  const crownsSnap = await db.collection('weeklyCrowns').get()
  const existing = new Map<string, CrownDoc>()
  for (const doc of crownsSnap.docs) {
    existing.set(doc.id, doc.data() as CrownDoc)
  }

  // 2. Current weekKey (exclude — week is not yet complete)
  const currentWeek = getWeekKey(getTodayPST())

  // 3. Get all triviaWeekly docs to find un-awarded weeks
  const weeklySnap = await db.collectionGroup('triviaWeekly').get()

  // 4. Group by weekKey, track the top scorer for each un-awarded past week
  const weekWinners = new Map<string, { uid: string; totalScore: number }>()
  for (const doc of weeklySnap.docs) {
    const data = doc.data()
    const weekKey = data.weekKey as string
    if (weekKey === currentWeek) continue
    if (existing.has(weekKey)) continue

    const uid = data.uid as string
    const totalScore = data.totalScore as number
    const current = weekWinners.get(weekKey)
    if (!current || totalScore > current.totalScore) {
      weekWinners.set(weekKey, { uid, totalScore })
    }
  }

  // 5. Write new crown docs (batch write for efficiency)
  if (weekWinners.size > 0) {
    const batch = db.batch()
    for (const [weekKey, winner] of weekWinners) {
      const crownDoc: CrownDoc = {
        weekKey,
        winnerUid: winner.uid,
        winnerScore: winner.totalScore,
      }
      batch.set(db.collection('weeklyCrowns').doc(weekKey), crownDoc)
      existing.set(weekKey, crownDoc)
    }
    await batch.commit()
  }

  return Array.from(existing.values())
}

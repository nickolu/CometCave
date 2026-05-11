import { getFirestoreDb } from '@/lib/firebase/server'
import { getWeekKey, getTodayPST } from '@/lib/dates'

export interface PodiumEntry {
  uid: string
  displayName: string
  score: number
  rank: 1 | 2 | 3
}

export interface CrownDoc {
  weekKey: string
  podium: PodiumEntry[]
  // Legacy fields preserved for backward compat
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

  // 4. Group by weekKey, track the top 3 scorers for each un-awarded past week
  const weekPlayers = new Map<string, Array<{ uid: string; totalScore: number; displayName: string }>>()
  for (const doc of weeklySnap.docs) {
    const data = doc.data()
    const weekKey = data.weekKey as string
    if (weekKey === currentWeek) continue
    if (existing.has(weekKey)) continue

    const uid = data.uid as string
    const totalScore = data.totalScore as number
    const displayName = (data.nicknameSnapshot as string) || ''
    const players = weekPlayers.get(weekKey) ?? []
    players.push({ uid, totalScore, displayName })
    weekPlayers.set(weekKey, players)
  }

  // 5. Write new crown docs (batch write for efficiency)
  if (weekPlayers.size > 0) {
    const batch = db.batch()
    for (const [weekKey, players] of weekPlayers) {
      const top3 = players
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3)

      const podium: PodiumEntry[] = top3.map((p, i) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: p.totalScore,
        rank: (i + 1) as 1 | 2 | 3,
      }))

      const crownDoc: CrownDoc = {
        weekKey,
        podium,
        winnerUid: top3[0].uid,
        winnerScore: top3[0].totalScore,
      }
      batch.set(db.collection('weeklyCrowns').doc(weekKey), crownDoc)
      existing.set(weekKey, crownDoc)
    }
    await batch.commit()
  }

  return Array.from(existing.values())
}

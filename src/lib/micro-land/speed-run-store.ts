import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getFirestoreDb } from '@/lib/firebase/server'

export interface GlobalSpeedRunRecord {
  uid: string
  displayName: string
  theme: string
  targetGen: number
  seconds: number
  completedAt: Timestamp | FieldValue
}

export interface LeaderboardEntry {
  displayName: string
  theme: string
  seconds: number
  completedAt: number  // ms epoch
}

function speedRunsRef() {
  return getFirestoreDb().collection('microLandSpeedRuns')
}

export async function saveGlobalSpeedRun(record: Omit<GlobalSpeedRunRecord, 'completedAt'>): Promise<void> {
  await speedRunsRef().add({
    ...record,
    completedAt: FieldValue.serverTimestamp(),
  })
}

export async function getLeaderboard(targetGen: number, limit = 10): Promise<LeaderboardEntry[]> {
  const snap = await speedRunsRef()
    .where('targetGen', '==', targetGen)
    .orderBy('seconds', 'asc')
    .limit(limit)
    .get()

  return snap.docs.map(doc => {
    const d = doc.data() as GlobalSpeedRunRecord
    return {
      displayName: d.displayName,
      theme: d.theme,
      seconds: d.seconds,
      completedAt: (d.completedAt as Timestamp)?.toMillis?.() ?? Date.now(),
    }
  })
}

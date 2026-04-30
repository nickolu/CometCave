import { getFirestoreDb } from '@/lib/firebase/server'
import { ensureCrownsAwarded } from '@/lib/trivia/crowns'

export interface TriviaLeaderboardEntry {
  uid: string
  displayName: string
  score: number
  correct?: number
  total?: number
  totalScore?: number
  gamesPlayed?: number
  totalCorrect?: number
  totalQuestions?: number
  crowns?: number
}

interface DailyDoc {
  uid: string
  date: string
  score: number
  correct: number
  total: number
  nicknameSnapshot: string
}

interface WeeklyDoc {
  uid: string
  weekKey: string
  totalScore: number
  gamesPlayed: number
  totalCorrect: number
  totalQuestions: number
  nicknameSnapshot: string
}

interface ProfileDoc {
  totalScore: number
  gamesPlayed: number
}

async function hydrateNicknames(uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map()
  const db = getFirestoreDb()
  const refs = uids.map((uid) => db.doc(`users/${uid}`))
  const snaps = await db.getAll(...refs)
  const map = new Map<string, string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data() as { nickname?: string }
    const nickname = data?.nickname ?? ''
    if (nickname) {
      map.set(snap.ref.id, nickname)
    }
  }
  return map
}

export async function getDailyTop(date: string, limit = 20): Promise<TriviaLeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collectionGroup('triviaDaily')
    .where('date', '==', date)
    .orderBy('score', 'desc')
    .limit(limit)
    .get()

  const docs = snap.docs.map((d) => d.data() as DailyDoc)
  const nicknames = await hydrateNicknames(docs.map((d) => d.uid))

  return docs.map((d) => ({
    uid: d.uid,
    displayName: nicknames.get(d.uid) || d.nicknameSnapshot,
    score: d.score,
    correct: d.correct,
    total: d.total,
  }))
}

export async function getWeeklyTop(
  weekKey: string,
  limit = 20
): Promise<TriviaLeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collectionGroup('triviaWeekly')
    .where('weekKey', '==', weekKey)
    .orderBy('totalScore', 'desc')
    .limit(limit)
    .get()

  const docs = snap.docs.map((d) => d.data() as WeeklyDoc)
  const nicknames = await hydrateNicknames(docs.map((d) => d.uid))

  return docs.map((d) => ({
    uid: d.uid,
    displayName: nicknames.get(d.uid) || d.nicknameSnapshot,
    score: d.totalScore,
    totalScore: d.totalScore,
    gamesPlayed: d.gamesPlayed,
    totalCorrect: d.totalCorrect,
    totalQuestions: d.totalQuestions,
  }))
}

export async function getAllTimeTop(limit = 20): Promise<TriviaLeaderboardEntry[]> {
  const crowns = await ensureCrownsAwarded()

  // Count crowns per user
  const crownCounts = new Map<string, number>()
  for (const crown of crowns) {
    crownCounts.set(crown.winnerUid, (crownCounts.get(crown.winnerUid) ?? 0) + 1)
  }

  // Sort by crown count desc, take top N
  const sorted = Array.from(crownCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (sorted.length === 0) {
    return []
  }

  const nicknames = await hydrateNicknames(sorted.map(([uid]) => uid))

  return sorted.map(([uid, count]) => ({
    uid,
    displayName: nicknames.get(uid) || 'Player',
    score: count,
    crowns: count,
  }))
}

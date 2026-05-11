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
  totalCorrect: number
  totalQuestions: number
  gamesPlayed: number
}

// Loads nicknames for the given uids, dropping any user whose Firebase
// auth is currently anonymous. The leaderboard surfaces are gated on
// signed-up status (CLAUDE.md "Anonymous-first, sign-up as reward"), so
// anonymous players never appear regardless of whether they happened to
// set a nickname on their anonymous user doc.
//
// Named users with an empty current nickname are kept in the map with an
// empty-string value so callers can fall back to the row's snapshot.
async function hydrateNicknames(uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map()
  const db = getFirestoreDb()
  const refs = uids.map((uid) => db.doc(`users/${uid}`))
  const snaps = await db.getAll(...refs)
  const map = new Map<string, string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data() as { nickname?: string; isAnonymous?: boolean }
    if (data?.isAnonymous) continue
    map.set(snap.ref.id, data?.nickname ?? '')
  }
  return map
}

// Returns the resolved display name for a leaderboard row, preferring the
// player's current nickname and falling back to the snapshot taken when
// the row was written. Returns null when the user is anonymous (absent
// from the map) or has no usable name in either place, so callers can
// drop the row.
function resolveDisplayName(
  uid: string,
  nicknames: Map<string, string>,
  snapshot: string | undefined | null
): string | null {
  if (!nicknames.has(uid)) return null
  return nicknames.get(uid) || snapshot || null
}

export async function getDailyTop(date: string, limit = 20): Promise<TriviaLeaderboardEntry[]> {
  const db = getFirestoreDb()
  // Overfetch so the post-hydration drop-anonymous filter still returns
  // up to `limit` named entries.
  const snap = await db
    .collectionGroup('triviaDaily')
    .where('date', '==', date)
    .orderBy('score', 'desc')
    .limit(limit * 2)
    .get()

  const docs = snap.docs.map((d) => d.data() as DailyDoc)
  const nicknames = await hydrateNicknames(docs.map((d) => d.uid))

  const result: TriviaLeaderboardEntry[] = []
  for (const d of docs) {
    const displayName = resolveDisplayName(d.uid, nicknames, d.nicknameSnapshot)
    if (!displayName) continue
    result.push({
      uid: d.uid,
      displayName,
      score: d.score,
      correct: d.correct,
      total: d.total,
    })
    if (result.length >= limit) break
  }
  return result
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
    .limit(limit * 2)
    .get()

  const docs = snap.docs.map((d) => d.data() as WeeklyDoc)
  const nicknames = await hydrateNicknames(docs.map((d) => d.uid))

  const result: TriviaLeaderboardEntry[] = []
  for (const d of docs) {
    const displayName = resolveDisplayName(d.uid, nicknames, d.nicknameSnapshot)
    if (!displayName) continue
    result.push({
      uid: d.uid,
      displayName,
      score: d.totalScore,
      totalScore: d.totalScore,
      gamesPlayed: d.gamesPlayed,
      totalCorrect: d.totalCorrect,
      totalQuestions: d.totalQuestions,
    })
    if (result.length >= limit) break
  }
  return result
}

export async function getAllTimeTop(limit = 20): Promise<TriviaLeaderboardEntry[]> {
  const crowns = await ensureCrownsAwarded()

  // Count crowns per user
  const crownCounts = new Map<string, number>()
  for (const crown of crowns) {
    crownCounts.set(crown.winnerUid, (crownCounts.get(crown.winnerUid) ?? 0) + 1)
  }

  // Sort by crown count desc, overfetch so the drop-anonymous filter
  // still returns up to `limit` named entries.
  const sorted = Array.from(crownCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2)

  if (sorted.length === 0) {
    return []
  }

  const nicknames = await hydrateNicknames(sorted.map(([uid]) => uid))

  return sorted
    .filter(([uid]) => !!nicknames.get(uid))
    .slice(0, limit)
    .map(([uid, count]) => ({
      uid,
      displayName: nicknames.get(uid) as string,
      score: count,
      crowns: count,
    }))
}

export async function getAllTimePoints(limit = 20): Promise<TriviaLeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collectionGroup('triviaProfile')
    .orderBy('totalScore', 'desc')
    .limit(limit * 2)
    .get()

  const docs: Array<{ uid: string; data: ProfileDoc }> = []
  for (const d of snap.docs) {
    // Path: users/{uid}/triviaProfile/current
    const uid = d.ref.parent.parent?.id
    if (!uid) continue
    docs.push({ uid, data: d.data() as ProfileDoc })
  }

  const nicknames = await hydrateNicknames(docs.map((d) => d.uid))

  const result: TriviaLeaderboardEntry[] = []
  for (const { uid, data } of docs) {
    const displayName = resolveDisplayName(uid, nicknames, null)
    if (!displayName) continue
    result.push({
      uid,
      displayName,
      score: data.totalScore,
      totalScore: data.totalScore,
      gamesPlayed: data.gamesPlayed,
      totalCorrect: data.totalCorrect,
      totalQuestions: data.totalQuestions,
    })
    if (result.length >= limit) break
  }
  return result
}

const ACCURACY_MIN_GAMES = 10

export async function getAllTimeAccuracy(limit = 20): Promise<TriviaLeaderboardEntry[]> {
  const db = getFirestoreDb()
  // Fetch all profiles with enough games, sorted by gamesPlayed desc to get active players
  const snap = await db
    .collectionGroup('triviaProfile')
    .where('gamesPlayed', '>=', ACCURACY_MIN_GAMES)
    .orderBy('gamesPlayed', 'desc')
    .limit(limit * 4)
    .get()

  const docs: Array<{ uid: string; data: ProfileDoc }> = []
  for (const d of snap.docs) {
    const uid = d.ref.parent.parent?.id
    if (!uid) continue
    docs.push({ uid, data: d.data() as ProfileDoc })
  }

  const nicknames = await hydrateNicknames(docs.map((d) => d.uid))

  // Calculate accuracy and sort
  const withAccuracy = docs
    .filter(({ uid }) => !!resolveDisplayName(uid, nicknames, null))
    .map(({ uid, data }) => ({
      uid,
      data,
      accuracy: data.totalQuestions > 0 ? data.totalCorrect / data.totalQuestions : 0,
    }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, limit)

  return withAccuracy.map(({ uid, data, accuracy }) => ({
    uid,
    displayName: resolveDisplayName(uid, nicknames, null) as string,
    score: Math.round(accuracy * 1000) / 10,
    totalScore: data.totalScore,
    gamesPlayed: data.gamesPlayed,
    totalCorrect: data.totalCorrect,
    totalQuestions: data.totalQuestions,
  }))
}

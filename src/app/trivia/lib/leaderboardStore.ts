import { getFirestoreDb } from '@/lib/firebase/server'

const COLLECTION = 'trivia-scores'

export interface LeaderboardEntry {
  displayName: string
  date: string // YYYY-MM-DD PST
  score: number
  correct: number
  total: number
  submittedAt: number // Date.now() ms
}

function docId(displayName: string, date: string): string {
  return `${displayName.toLowerCase().trim()}|${date}`
}

export async function submitScore(entry: LeaderboardEntry): Promise<{ stored: boolean; previous: LeaderboardEntry | null }> {
  const db = getFirestoreDb()
  const id = docId(entry.displayName, entry.date)
  const ref = db.collection(COLLECTION).doc(id)

  const snap = await ref.get()
  const existing = snap.exists ? (snap.data() as LeaderboardEntry) : null

  if (!existing || entry.score > existing.score) {
    await ref.set({
      displayName: entry.displayName,
      displayNameLower: entry.displayName.toLowerCase().trim(),
      date: entry.date,
      score: entry.score,
      correct: entry.correct,
      total: entry.total,
      submittedAt: entry.submittedAt,
    })
    return { stored: true, previous: existing }
  }

  return { stored: false, previous: existing }
}

export async function getDailyLeaderboard(date: string, limit = 20): Promise<LeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collection(COLLECTION)
    .where('date', '==', date)
    .orderBy('score', 'desc')
    .limit(limit)
    .get()

  return snap.docs.map(doc => doc.data() as LeaderboardEntry)
}

export async function getWeeklyLeaderboard(weekStart: string, weekEnd: string, limit = 20): Promise<Array<{
  displayName: string
  totalScore: number
  gamesPlayed: number
  totalCorrect: number
  totalQuestions: number
}>> {
  const db = getFirestoreDb()
  const snap = await db
    .collection(COLLECTION)
    .where('date', '>=', weekStart)
    .where('date', '<=', weekEnd)
    .get()

  const aggregated = new Map<string, {
    displayName: string
    totalScore: number
    gamesPlayed: number
    totalCorrect: number
    totalQuestions: number
  }>()

  for (const doc of snap.docs) {
    const entry = doc.data() as LeaderboardEntry
    const normKey = entry.displayName.toLowerCase().trim()
    const existing = aggregated.get(normKey)
    if (existing) {
      existing.totalScore += entry.score
      existing.gamesPlayed += 1
      existing.totalCorrect += entry.correct
      existing.totalQuestions += entry.total
    } else {
      aggregated.set(normKey, {
        displayName: entry.displayName,
        totalScore: entry.score,
        gamesPlayed: 1,
        totalCorrect: entry.correct,
        totalQuestions: entry.total,
      })
    }
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
}

export async function getAllTimeLeaderboard(limit = 20): Promise<Array<{
  displayName: string
  weeklyWins: number
  totalScore: number
}>> {
  const db = getFirestoreDb()
  const snap = await db.collection(COLLECTION).get()

  // Group entries by week
  const weekMap = new Map<string, LeaderboardEntry[]>()
  for (const doc of snap.docs) {
    const entry = doc.data() as LeaderboardEntry
    const weekKey = getWeekKeyForDate(entry.date)
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, [])
    weekMap.get(weekKey)!.push(entry)
  }

  const todayWeek = getWeekKeyForDate(getTodayPSTLocal())
  const winCounts = new Map<string, { displayName: string; weeklyWins: number; totalScore: number }>()

  for (const [weekKey, weekEntries] of weekMap) {
    if (weekKey === todayWeek) continue

    const weekScores = new Map<string, { displayName: string; total: number }>()
    for (const e of weekEntries) {
      const norm = e.displayName.toLowerCase().trim()
      const existing = weekScores.get(norm)
      if (existing) {
        existing.total += e.score
      } else {
        weekScores.set(norm, { displayName: e.displayName, total: e.score })
      }
    }

    let winner: { displayName: string; total: number } | null = null
    for (const ws of weekScores.values()) {
      if (!winner || ws.total > winner.total) winner = ws
    }

    if (winner) {
      const key = winner.displayName.toLowerCase().trim()
      const existing = winCounts.get(key)
      if (existing) {
        existing.weeklyWins += 1
        existing.totalScore += winner.total
      } else {
        winCounts.set(key, { displayName: winner.displayName, weeklyWins: 1, totalScore: winner.total })
      }
    }
  }

  return Array.from(winCounts.values())
    .sort((a, b) => b.weeklyWins - a.weeklyWins || b.totalScore - a.totalScore)
    .slice(0, limit)
}

function getWeekKeyForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00-08:00')
  const year = d.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  const week = Math.ceil((days + jan1.getUTCDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function getTodayPSTLocal(): string {
  const now = new Date()
  const pst = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const d = new Date(pst)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const pstStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const today = new Date(pstStr)

  const dayOfWeek = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek - 1))

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return { start: fmt(monday), end: fmt(sunday) }
}

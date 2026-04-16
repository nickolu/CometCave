// NOTE: This is an in-memory store. For production, swap with Vercel KV / Redis.
// All functions are sync to match the current Map pattern — convert to async if swapping.

export interface LeaderboardEntry {
  displayName: string
  date: string // YYYY-MM-DD PST
  score: number
  correct: number
  total: number
  submittedAt: number // Date.now() ms
}

// All entries, keyed by `${displayName}|${date}` to enforce one entry per user per day
const entries = new Map<string, LeaderboardEntry>()

function keyFor(displayName: string, date: string): string {
  return `${displayName.toLowerCase().trim()}|${date}`
}

// Returns the previous entry if one existed (useful for "updated" response)
export function submitScore(entry: LeaderboardEntry): { stored: boolean; previous: LeaderboardEntry | null } {
  const key = keyFor(entry.displayName, entry.date)
  const existing = entries.get(key)

  // Only store if new or higher score
  if (!existing || entry.score > existing.score) {
    entries.set(key, entry)
    return { stored: true, previous: existing ?? null }
  }
  return { stored: false, previous: existing }
}

export function getDailyLeaderboard(date: string, limit = 20): LeaderboardEntry[] {
  const dailyEntries: LeaderboardEntry[] = []
  for (const entry of entries.values()) {
    if (entry.date === date) dailyEntries.push(entry)
  }
  return dailyEntries.sort((a, b) => b.score - a.score).slice(0, limit)
}

// Get all entries from Monday-Sunday of a given week (week start YYYY-MM-DD)
export function getWeeklyLeaderboard(weekStart: string, weekEnd: string, limit = 20): Array<{
  displayName: string
  totalScore: number
  gamesPlayed: number
  totalCorrect: number
  totalQuestions: number
}> {
  // Aggregate by displayName (normalized lowercase)
  const aggregated = new Map<string, {
    displayName: string
    totalScore: number
    gamesPlayed: number
    totalCorrect: number
    totalQuestions: number
  }>()

  for (const entry of entries.values()) {
    if (entry.date >= weekStart && entry.date <= weekEnd) {
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
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
}

// All-time weekly wins: for each historical week, find the top scorer, count wins per user
export function getAllTimeLeaderboard(limit = 20): Array<{
  displayName: string
  weeklyWins: number
  totalScore: number
}> {
  // Group entries by week
  const weekMap = new Map<string, LeaderboardEntry[]>()

  for (const entry of entries.values()) {
    const weekKey = getWeekKeyForDate(entry.date)
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, [])
    weekMap.get(weekKey)!.push(entry)
  }

  // For each week, determine the winner (highest weekly aggregate score)
  const winCounts = new Map<string, { displayName: string; weeklyWins: number; totalScore: number }>()
  const todayWeek = getWeekKeyForDate(getTodayPSTLocal())

  for (const [weekKey, weekEntries] of weekMap) {
    // Only count completed weeks
    if (weekKey === todayWeek) continue

    // Aggregate this week's scores per user
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

    // Find winner
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

// Helper: get a week key (YYYY-Www) for grouping, using PST timezone
function getWeekKeyForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00-08:00')
  const year = d.getUTCFullYear()
  // Simple ISO week approximation
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

// Utility: get Monday-Sunday date range for current PST week
export function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const pstStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const today = new Date(pstStr)

  // Get Monday of this week (ISO: Mon=1, Sun=0→7)
  const dayOfWeek = today.getDay() || 7 // treat Sunday as 7
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

// For testing / clearing
export function _clearAll() {
  entries.clear()
}

// For debugging
export function _getAllEntries() {
  return Array.from(entries.values())
}

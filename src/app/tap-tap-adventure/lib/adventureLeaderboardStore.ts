import { getFirestoreDb } from '@/lib/firebase/server'

const COLLECTION = 'adventure-scores'

export interface AdventureScoreEntry {
  playerName: string
  characterName: string
  characterClass: string
  characterId: string
  distance: number
  level: number
  gold: number
  regionsConquered: number
  date: string // YYYY-MM-DD PST
  submittedAt: number // Date.now() ms
}

export type LeaderboardCategory = 'distance' | 'level' | 'gold' | 'regionsConquered'
export type LeaderboardPeriod = 'daily' | 'weekly' | 'alltime'

function docId(playerName: string, characterId: string): string {
  return `${playerName.toLowerCase().trim()}|${characterId}`
}

export async function submitAdventureScore(
  entry: AdventureScoreEntry
): Promise<{ stored: boolean }> {
  const db = getFirestoreDb()
  const id = docId(entry.playerName, entry.characterId)
  const ref = db.collection(COLLECTION).doc(id)

  await ref.set({
    playerName: entry.playerName,
    playerNameLower: entry.playerName.toLowerCase().trim(),
    characterName: entry.characterName,
    characterClass: entry.characterClass,
    characterId: entry.characterId,
    distance: entry.distance,
    level: entry.level,
    gold: entry.gold,
    regionsConquered: entry.regionsConquered,
    date: entry.date,
    submittedAt: entry.submittedAt,
  })

  return { stored: true }
}

export async function getLeaderboardByCategory(
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  limit = 20
): Promise<AdventureScoreEntry[]> {
  const db = getFirestoreDb()
  const collection = db.collection(COLLECTION)

  if (period === 'daily') {
    const today = getTodayPSTLocal()
    const snap = await collection
      .where('date', '==', today)
      .orderBy(category, 'desc')
      .limit(limit)
      .get()
    return snap.docs.map(doc => doc.data() as AdventureScoreEntry)
  }

  if (period === 'weekly') {
    const { start, end } = getCurrentWeekRange()
    const snap = await collection
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get()

    const entries = snap.docs.map(doc => doc.data() as AdventureScoreEntry)
    return entries
      .sort((a, b) => b[category] - a[category])
      .slice(0, limit)
  }

  // alltime — fetch all, sort in memory
  const snap = await collection.get()
  const entries = snap.docs.map(doc => doc.data() as AdventureScoreEntry)
  return entries
    .sort((a, b) => b[category] - a[category])
    .slice(0, limit)
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

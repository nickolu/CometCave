import { getFirestoreDb } from '@/lib/firebase/server'
import { CATEGORY_META } from '@/lib/trivia/categories'
import {
  type MedalTier,
  getMedalLabel,
  getMedalTier,
  getNextThreshold,
} from '@/lib/trivia/medals'

export interface CategoryMedalSummary {
  categoryId: number
  categoryName: string
  correctCount: number
  tier: MedalTier
  label: string | null
  nextThreshold: number | null
}

export interface CategoryLeaderboardEntry {
  uid: string
  displayName: string
  correctCount: number
  tier: MedalTier
  label: string | null
}

// Returns one summary entry per known category, including categories the
// user has never answered in (correctCount: 0, tier: 'none'). The selector
// uses this to paint either a colored badge or an empty silhouette on
// every tile in a single pass.
export async function getCategoryMedalsForUser(uid: string): Promise<CategoryMedalSummary[]> {
  const db = getFirestoreDb()
  const snap = await db.collection(`users/${uid}/triviaCategoryStats`).get()

  const counts = new Map<number, number>()
  for (const doc of snap.docs) {
    const data = doc.data()
    const id = typeof data.categoryId === 'number' ? data.categoryId : Number(doc.id)
    if (Number.isNaN(id)) continue
    counts.set(id, data.correctCount ?? 0)
  }

  const result: CategoryMedalSummary[] = []
  for (const [idStr, meta] of Object.entries(CATEGORY_META)) {
    const categoryId = Number(idStr)
    const correctCount = counts.get(categoryId) ?? 0
    const tier = getMedalTier(correctCount)
    result.push({
      categoryId,
      categoryName: meta.name,
      correctCount,
      tier,
      label: getMedalLabel(categoryId, tier),
      nextThreshold: getNextThreshold(tier),
    })
  }
  return result
}

export interface CategoryLeaderboardSection {
  categoryId: number
  categoryName: string
  icon: string
  entries: CategoryLeaderboardEntry[]
}

// Top players for one category, sorted by lifetime correctCount in that
// category. Hydrates nicknames from the parent users/{uid} doc so the
// leaderboard shows display names instead of raw uids.
export async function getInfiniteTopByCategory(
  categoryId: number,
  limit = 20
): Promise<CategoryLeaderboardEntry[]> {
  const db = getFirestoreDb()
  // Overfetch so the post-hydration "drop unnamed players" filter still
  // returns up to `limit` entries.
  const snap = await db
    .collectionGroup('triviaCategoryStats')
    .where('categoryId', '==', categoryId)
    .orderBy('correctCount', 'desc')
    .limit(limit * 2)
    .get()

  const rows = snap.docs.map((d) => {
    const data = d.data()
    const uid = d.ref.parent.parent?.id ?? ''
    return { uid, correctCount: (data.correctCount as number) ?? 0 }
  })

  if (rows.length === 0) return []

  const userRefs = rows.map((r) => db.doc(`users/${r.uid}`))
  const userSnaps = await db.getAll(...userRefs)
  const nicknameByUid = new Map<string, string>()
  for (const s of userSnaps) {
    if (!s.exists) continue
    const data = s.data() as { nickname?: string }
    if (data?.nickname) nicknameByUid.set(s.ref.id, data.nickname)
  }

  return rows
    .filter((r) => !!nicknameByUid.get(r.uid))
    .slice(0, limit)
    .map((r) => {
      const tier = getMedalTier(r.correctCount)
      return {
        uid: r.uid,
        displayName: nicknameByUid.get(r.uid) as string,
        correctCount: r.correctCount,
        tier,
        label: getMedalLabel(categoryId, tier),
      }
    })
}

// Returns one section per category that has at least one player, each
// with the top N players in that category. Categories with no players
// are omitted. Runs the per-category query in parallel; reuses the
// existing (categoryId asc, correctCount desc) collection-group index.
export async function getInfiniteLeaderboardAllCategories(
  limit = 5
): Promise<CategoryLeaderboardSection[]> {
  const categoryIds = Object.keys(CATEGORY_META).map(Number)
  const sections = await Promise.all(
    categoryIds.map(async (categoryId) => {
      const entries = await getInfiniteTopByCategory(categoryId, limit)
      const meta = CATEGORY_META[categoryId]
      return {
        categoryId,
        categoryName: meta.name,
        icon: meta.icon,
        entries,
      }
    })
  )
  return sections.filter((s) => s.entries.length > 0)
}

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

import { getFirestoreDb } from '@/lib/firebase/server'

export interface CategoryStat {
  category: string
  count: number
  avgAccuracy: number
}

export interface DifficultyStat {
  count: number
  avgAccuracy: number
}

export interface QuestionStats {
  totalQuestions: number
  totalAnswered: number
  avgAccuracyPct: number
  questionsAddedThisWeek: number
  byCategory: CategoryStat[]
  byDifficulty: {
    easy: DifficultyStat
    medium: DifficultyStat
    hard: DifficultyStat
  }
}

interface QuestionDoc {
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  timesShown: number
  timesCorrect: number
  createdAt: { toDate?: () => Date } | string | null | undefined
}

export async function computeQuestionStats(): Promise<QuestionStats> {
  const db = getFirestoreDb()

  const snap = await db
    .collection('aiQuestions')
    .where('status', '==', 'active')
    .where('type', '==', 'free-text')
    .select('category', 'difficulty', 'timesShown', 'timesCorrect', 'createdAt')
    .get()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  let totalAnswered = 0
  let totalCorrect = 0
  let questionsAddedThisWeek = 0

  const categoryMap = new Map<string, { count: number; shown: number; correct: number }>()
  const difficultyMap: Record<string, { count: number; shown: number; correct: number }> = {
    easy: { count: 0, shown: 0, correct: 0 },
    medium: { count: 0, shown: 0, correct: 0 },
    hard: { count: 0, shown: 0, correct: 0 },
  }

  for (const doc of snap.docs) {
    const data = doc.data() as QuestionDoc

    const timesShown = data.timesShown ?? 0
    const timesCorrect = data.timesCorrect ?? 0
    totalAnswered += timesShown
    totalCorrect += timesCorrect

    // questionsAddedThisWeek
    const createdAt = data.createdAt
    if (createdAt) {
      let createdDate: Date | null = null
      if (typeof createdAt === 'object' && typeof createdAt.toDate === 'function') {
        createdDate = createdAt.toDate()
      } else if (typeof createdAt === 'string') {
        createdDate = new Date(createdAt)
      }
      if (createdDate && createdDate >= sevenDaysAgo) {
        questionsAddedThisWeek++
      }
    }

    // byCategory
    const category = data.category ?? 'Unknown'
    const catEntry = categoryMap.get(category) ?? { count: 0, shown: 0, correct: 0 }
    catEntry.count++
    catEntry.shown += timesShown
    catEntry.correct += timesCorrect
    categoryMap.set(category, catEntry)

    // byDifficulty
    const difficulty = data.difficulty
    if (difficulty && difficulty in difficultyMap) {
      difficultyMap[difficulty].count++
      difficultyMap[difficulty].shown += timesShown
      difficultyMap[difficulty].correct += timesCorrect
    }
  }

  const totalQuestions = snap.docs.length
  const avgAccuracyPct =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 : 0

  const byCategory: CategoryStat[] = Array.from(categoryMap.entries())
    .map(([category, { count, shown, correct }]) => ({
      category,
      count,
      avgAccuracy: shown > 0 ? Math.round((correct / shown) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const toStat = (entry: { count: number; shown: number; correct: number }): DifficultyStat => ({
    count: entry.count,
    avgAccuracy: entry.shown > 0 ? Math.round((entry.correct / entry.shown) * 1000) / 10 : 0,
  })

  return {
    totalQuestions,
    totalAnswered,
    avgAccuracyPct,
    questionsAddedThisWeek,
    byCategory,
    byDifficulty: {
      easy: toStat(difficultyMap.easy),
      medium: toStat(difficultyMap.medium),
      hard: toStat(difficultyMap.hard),
    },
  }
}

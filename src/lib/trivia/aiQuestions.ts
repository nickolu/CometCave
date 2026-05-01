import { getFirestoreDb } from '@/lib/firebase/server'

export interface AIQuestion {
  id: string
  question: string
  correctAnswer: string
  explanation?: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  type: 'free-text'
  // New fields for infinite mode
  status: 'active' | 'flagged' | 'removed'
  timesShown: number
  timesCorrect: number
  avgTimeMs: number | null
  // Rating counters. Maintained transactionally by the rate route
  // alongside the per-user rating doc at aiQuestions/{id}/ratings/{uid}.
  // Source of truth is still the subcollection (one doc per voter); these
  // are denormalized for cheap reads at display time. Backfill script
  // exists in case they ever drift.
  likeCount: number
  dislikeCount: number
}

export interface SeenQuestion {
  at: FirebaseFirestore.Timestamp
  correct: boolean
}

export async function saveAIQuestion(
  question: Omit<AIQuestion, 'status' | 'timesShown' | 'timesCorrect' | 'avgTimeMs' | 'likeCount' | 'dislikeCount'>
): Promise<string> {
  const db = getFirestoreDb()
  const doc: AIQuestion = {
    ...question,
    status: 'active',
    timesShown: 0,
    timesCorrect: 0,
    avgTimeMs: null,
    likeCount: 0,
    dislikeCount: 0,
  }
  const ref = db.collection('aiQuestions').doc(question.id)
  await ref.set(doc)
  return ref.id
}

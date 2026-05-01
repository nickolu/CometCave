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
}

export interface SeenQuestion {
  at: FirebaseFirestore.Timestamp
  correct: boolean
}

export async function saveAIQuestion(
  question: Omit<AIQuestion, 'status' | 'timesShown' | 'timesCorrect' | 'avgTimeMs'>
): Promise<string> {
  const db = getFirestoreDb()
  const doc: AIQuestion = {
    ...question,
    status: 'active',
    timesShown: 0,
    timesCorrect: 0,
    avgTimeMs: null,
  }
  const ref = db.collection('aiQuestions').doc(question.id)
  await ref.set(doc)
  return ref.id
}

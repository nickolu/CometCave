import { FieldValue } from 'firebase-admin/firestore'
import { getFirestoreDb } from '@/lib/firebase/server'

const COLLECTION = 'triviaWrongAnswers'

function normalizeToKey(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

export interface WrongAnswerEntry {
  text: string
  count: number
}

export async function recordWrongAnswer(
  questionId: string,
  playerAnswer: string,
): Promise<void> {
  if (!playerAnswer || typeof playerAnswer !== 'string') return
  const trimmed = playerAnswer.trim()
  if (!trimmed) return
  const key = normalizeToKey(trimmed)
  if (!key) return

  const db = getFirestoreDb()
  await db.collection(COLLECTION).doc(questionId).set(
    {
      totalCount: FieldValue.increment(1),
      answers: {
        [key]: {
          text: trimmed.slice(0, 200),
          count: FieldValue.increment(1),
        },
      },
    },
    { merge: true },
  )
}

export async function getTopWrongAnswers(
  questionId: string,
  limit = 5,
): Promise<WrongAnswerEntry[]> {
  const db = getFirestoreDb()
  const snap = await db.collection(COLLECTION).doc(questionId).get()
  if (!snap.exists) return []

  const data = snap.data()
  const answers = data?.answers as Record<string, { text: string; count: number }> | undefined
  if (!answers) return []

  return Object.values(answers)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export interface GalleryEntry {
  questionId: string
  question: string
  correctAnswer: string
  topAnswers: WrongAnswerEntry[]
  totalCount: number
}

export async function getWrongAnswersGallery(limit = 20): Promise<GalleryEntry[]> {
  const db = getFirestoreDb()

  // Fetch questions with the most wrong answer submissions
  const snap = await db
    .collection(COLLECTION)
    .orderBy('totalCount', 'desc')
    .limit(limit)
    .get()

  if (snap.empty) return []

  // Batch-fetch question data from aiQuestions
  const entries: GalleryEntry[] = []
  await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data()
      const qSnap = await db.doc(`aiQuestions/${doc.id}`).get()
      if (!qSnap.exists || qSnap.data()?.status !== 'active') return
      const qData = qSnap.data()!

      const answers = data.answers as Record<string, { text: string; count: number }> | undefined
      const topAnswers = answers
        ? Object.values(answers).sort((a, b) => b.count - a.count).slice(0, 5)
        : []

      entries.push({
        questionId: doc.id,
        question: qData.question,
        correctAnswer: qData.correctAnswer,
        topAnswers,
        totalCount: data.totalCount ?? 0,
      })
    })
  )

  return entries.sort((a, b) => b.totalCount - a.totalCount)
}

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

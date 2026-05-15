import { FieldValue } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'
import type { TriviaQuestionWithAnswer } from '@/app/trivia/models/questions'

const COLLECTION = 'dailyQuestions'

export interface DailyQuestionsDocument {
  date: string
  categoryId: number
  categoryName: string
  questions: TriviaQuestionWithAnswer[]
  createdAt: FirebaseFirestore.Timestamp
}

export async function getDailyQuestions(date: string): Promise<DailyQuestionsDocument | null> {
  const db = getFirestoreDb()
  const snap = await db.collection(COLLECTION).doc(date).get()
  if (!snap.exists) return null
  return snap.data() as DailyQuestionsDocument
}

export async function setDailyQuestions(
  date: string,
  data: Omit<DailyQuestionsDocument, 'createdAt'>,
): Promise<void> {
  const db = getFirestoreDb()
  await db.collection(COLLECTION).doc(date).set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function getAvailableDates(startDate: string, endDate: string): Promise<string[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collection(COLLECTION)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date')
    .select()
    .get()
  return snap.docs.map((doc) => doc.id)
}

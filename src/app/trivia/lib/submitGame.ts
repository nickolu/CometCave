import { getDailyCategory } from '@/lib/trivia/categories'

import type { TriviaGameResult } from '../models/trivia'
import type { User } from 'firebase/auth'

export async function submitGameToServer(user: User, result: TriviaGameResult): Promise<void> {
  const token = await user.getIdToken()
  const res = await fetch('/api/v1/trivia/complete-game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      date: result.date,
      score: result.score,
      correct: result.correct,
      total: result.total,
      answers: result.answers,
      category: getDailyCategory(result.date),
    }),
  })
  // 409 = already submitted today; treat as success (idempotent reconcile)
  if (!res.ok && res.status !== 409) {
    throw new Error(`complete-game failed: ${res.status}`)
  }
}

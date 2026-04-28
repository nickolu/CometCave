import { FieldValue } from 'firebase-admin/firestore'
import { getFirestoreDb } from '@/lib/firebase/server'

export async function removeQuestion(questionId: string): Promise<{ affectedPlayers: number }> {
  const db = getFirestoreDb()
  const qRef = db.doc(`aiQuestions/${questionId}`)

  const qSnap = await qRef.get()
  if (!qSnap.exists) throw new Error('Question not found')
  if (qSnap.data()!.status === 'removed') return { affectedPlayers: 0 } // idempotent

  // Set status to removed
  await qRef.update({ status: 'removed' })

  // Walk answeredBy reverse index
  const answeredBySnap = await db.collection(`aiQuestions/${questionId}/answeredBy`).get()
  let affectedPlayers = 0

  for (const abDoc of answeredBySnap.docs) {
    const { uid, runId, correct } = abDoc.data()
    affectedPlayers++

    try {
      // Load the run
      const runRef = db.doc(`users/${uid}/triviaInfinite/${runId}`)
      const runSnap = await runRef.get()
      if (!runSnap.exists) continue
      const run = runSnap.data()!

      // Find and remove the answer entry
      const answers = run.answers as Array<{ questionId: string; correct: boolean; points: number; timeMs: number; trailblazer: boolean }>
      const answerIdx = answers.findIndex(a => a.questionId === questionId)
      if (answerIdx === -1) continue

      const removedAnswer = answers[answerIdx]
      const newAnswers = [...answers.slice(0, answerIdx), ...answers.slice(answerIdx + 1)]

      // Recompute score (simple sum of remaining points)
      const newScore = newAnswers.reduce((sum, a) => sum + a.points, 0)

      await runRef.update({
        answers: newAnswers,
        score: newScore,
      })

      // Decrement aggregate stats
      const aggRef = db.doc(`users/${uid}/triviaStats/aggregate`)
      const aggSnap = await aggRef.get()
      if (aggSnap.exists) {
        const qData = qSnap.data()!
        const updates: Record<string, unknown> = {
          totalAnswered: FieldValue.increment(-1),
          totalTimeMs: FieldValue.increment(-removedAnswer.timeMs),
        }
        if (removedAnswer.correct) {
          updates.totalCorrect = FieldValue.increment(-1)
        }
        if (removedAnswer.trailblazer) {
          updates.trailblazerCount = FieldValue.increment(-1)
        }
        // Note: byCategory and byDifficulty decrements use the question's category/difficulty
        if (qData.category && qData.difficulty) {
          updates[`byCategory.${qData.category}.answered`] = FieldValue.increment(-1)
          if (removedAnswer.correct) {
            updates[`byCategory.${qData.category}.correct`] = FieldValue.increment(-1)
          }
          updates[`byCategory.${qData.category}.totalTimeMs`] = FieldValue.increment(-removedAnswer.timeMs)
          updates[`byDifficulty.${qData.difficulty}.answered`] = FieldValue.increment(-1)
          if (removedAnswer.correct) {
            updates[`byDifficulty.${qData.difficulty}.correct`] = FieldValue.increment(-1)
          }
        }
        updates.lastUpdatedAt = FieldValue.serverTimestamp()
        await aggRef.update(updates)
      }

      // Remove seenQuestions entry
      await db.doc(`users/${uid}/seenQuestions/${questionId}`).delete()
    } catch (err) {
      console.error(`Failed to process removal for uid=${uid}, runId=${runId}:`, err)
    }
  }

  return { affectedPlayers }
}

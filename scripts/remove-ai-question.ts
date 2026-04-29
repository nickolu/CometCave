#!/usr/bin/env tsx
/**
 * Removes an AI question and cascades through affected players' runs and stats.
 *
 * Usage:
 *   npx tsx scripts/remove-ai-question.ts <questionId>
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

function ensureApp() {
  if (getApps().length > 0) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'ERROR: Missing Firebase env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
    )
    process.exit(1)
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

async function removeQuestion(questionId: string): Promise<{ affectedPlayers: number }> {
  const db = getFirestore()
  const qRef = db.doc(`aiQuestions/${questionId}`)

  const qSnap = await qRef.get()
  if (!qSnap.exists) throw new Error('Question not found')
  if (qSnap.data()!.status === 'removed') {
    console.log('Question is already removed. Nothing to do (idempotent).')
    return { affectedPlayers: 0 }
  }

  // Set status to removed
  await qRef.update({ status: 'removed' })
  console.log(`Set aiQuestions/${questionId} status = 'removed'`)

  // Walk answeredBy reverse index
  const answeredBySnap = await db.collection(`aiQuestions/${questionId}/answeredBy`).get()
  console.log(`Found ${answeredBySnap.size} answeredBy entries to process.`)

  let affectedPlayers = 0

  for (const abDoc of answeredBySnap.docs) {
    const { uid, runId, correct } = abDoc.data()
    affectedPlayers++

    try {
      const runRef = db.doc(`users/${uid}/triviaInfinite/${runId}`)
      const runSnap = await runRef.get()
      if (!runSnap.exists) {
        console.log(`  [${uid}/${runId}] Run not found, skipping.`)
        continue
      }
      const run = runSnap.data()!

      const answers = run.answers as Array<{ questionId: string; correct: boolean; points: number; timeMs: number; trailblazer: boolean }>
      const answerIdx = answers.findIndex(a => a.questionId === questionId)
      if (answerIdx === -1) {
        console.log(`  [${uid}/${runId}] Answer not found in run, skipping.`)
        continue
      }

      const removedAnswer = answers[answerIdx]
      const newAnswers = [...answers.slice(0, answerIdx), ...answers.slice(answerIdx + 1)]
      const newScore = newAnswers.reduce((sum, a) => sum + a.points, 0)

      await runRef.update({ answers: newAnswers, score: newScore })
      console.log(`  [${uid}/${runId}] Removed answer, new score: ${newScore}`)

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
        console.log(`  [${uid}] Updated aggregate stats.`)
      }

      // Remove seenQuestions entry
      await db.doc(`users/${uid}/seenQuestions/${questionId}`).delete()
      console.log(`  [${uid}] Removed seenQuestions entry.`)
    } catch (err) {
      console.error(`  ERROR processing uid=${uid}, runId=${runId}:`, err)
    }
  }

  return { affectedPlayers }
}

async function main() {
  const questionId = process.argv[2]
  if (!questionId) {
    console.error('Usage: npx tsx scripts/remove-ai-question.ts <questionId>')
    process.exit(1)
  }

  ensureApp()

  console.log(`Removing question: ${questionId}`)
  const { affectedPlayers } = await removeQuestion(questionId)
  console.log('─'.repeat(60))
  console.log(`Done. Affected players: ${affectedPlayers}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

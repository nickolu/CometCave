import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import { LIVES_START, applyAnswer } from '@/app/trivia/lib/infiniteScoring'
import type { AnswerResult } from '@/app/trivia/lib/infiniteScoring'
import { getFirestoreDb } from '@/lib/firebase/server'
import { applyRunToAggregate } from '@/lib/trivia/triviaStats'

export interface RunDoc {
  runId: string
  uid: string
  mode: 'scored' | 'practice'
  categoryFilter: number | null
  score: number
  livesRemaining: number
  currentStreak: number
  longestStreak: number
  trailblazes: number
  answers: RunAnswer[]
  bonusLivesEarned: number
  skipsUsed: number
  flaggedQuestionIds: string[]
  startedAt: FirebaseFirestore.Timestamp
  endedAt: FirebaseFirestore.Timestamp | null
}

export interface RunAnswer {
  questionId: string
  correct: boolean
  points: number
  timeMs: number
  trailblazer: boolean
  answeredAt: FirebaseFirestore.Timestamp
}

export async function startRun(uid: string, mode: 'scored' | 'practice' = 'scored', categoryId?: number): Promise<{ runId: string; livesRemaining: number; currentStreak: number }> {
  const db = getFirestoreDb()
  const runRef = db.collection(`users/${uid}/triviaInfinite`).doc()
  const now = FieldValue.serverTimestamp()
  await runRef.set({
    runId: runRef.id,
    uid,
    mode,
    categoryFilter: categoryId ?? null,
    score: 0,
    livesRemaining: LIVES_START,
    currentStreak: 0,
    longestStreak: 0,
    trailblazes: 0,
    answers: [],
    bonusLivesEarned: 0,
    skipsUsed: 0,
    flaggedQuestionIds: [],
    startedAt: now,
    endedAt: null,
  })
  return { runId: runRef.id, livesRemaining: LIVES_START, currentStreak: 0 }
}

export async function submitAnswer(params: {
  uid: string
  runId: string
  questionId: string
  correct: boolean
  elapsedMs: number
}): Promise<AnswerResult & { trailblazer: boolean }> {
  const db = getFirestoreDb()
  const { uid, runId, questionId, correct, elapsedMs } = params

  const runRef = db.doc(`users/${uid}/triviaInfinite/${runId}`)
  const questionRef = db.doc(`aiQuestions/${questionId}`)
  const seenRef = db.doc(`users/${uid}/seenQuestions/${questionId}`)
  const answeredByRef = db.doc(`aiQuestions/${questionId}/answeredBy/${uid}_${runId}`)

  const result = await db.runTransaction(async (tx) => {
    const runSnap = await tx.get(runRef)
    if (!runSnap.exists) throw new Error('Run not found')
    const run = runSnap.data() as RunDoc

    if (run.endedAt !== null) throw new Error('Run already ended')

    const qSnap = await tx.get(questionRef)
    if (!qSnap.exists) throw new Error('Question not found')
    const qData = qSnap.data()!

    // Trailblazer: if timesShown was 0 before this answer
    const isTrailblazer = correct && (qData.timesShown ?? 0) === 0

    // Compute result using pure function
    const txResult = applyAnswer({
      correct,
      trailblazer: isTrailblazer,
      elapsedMs,
      mode: run.mode,
      prevLives: run.livesRemaining,
      prevStreak: run.currentStreak,
      prevLongestStreak: run.longestStreak,
      prevScore: run.score,
    })

    const now = FieldValue.serverTimestamp()

    // Update question counters
    const qUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      timesShown: FieldValue.increment(1),
    }
    if (correct) {
      qUpdates.timesCorrect = FieldValue.increment(1)
    }
    // Running mean for avgTimeMs
    const prevAvg = qData.avgTimeMs ?? 0
    const prevCount = qData.timesShown ?? 0
    const newAvg = prevCount === 0 ? elapsedMs : Math.round((prevAvg * prevCount + elapsedMs) / (prevCount + 1))
    qUpdates.avgTimeMs = newAvg

    tx.update(questionRef, qUpdates)

    // Write seenQuestions
    tx.set(seenRef, { at: now, correct })

    // Write answeredBy reverse index
    tx.set(answeredByRef, { uid, runId, correct, at: now })

    // Build answer entry. Note: serverTimestamp() can't appear inside an
    // arrayUnion element, so we use a client-computed Timestamp here.
    const answerEntry = {
      questionId,
      correct,
      points: txResult.points,
      timeMs: elapsedMs,
      trailblazer: isTrailblazer,
      answeredAt: Timestamp.now(),
    }

    // Update run doc
    const runUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      score: txResult.score,
      livesRemaining: txResult.livesRemaining,
      currentStreak: txResult.currentStreak,
      longestStreak: txResult.longestStreak,
      answers: FieldValue.arrayUnion(answerEntry),
    }
    if (isTrailblazer) {
      runUpdates.trailblazes = FieldValue.increment(1)
    }
    if (txResult.runOver) {
      runUpdates.endedAt = now
    }
    tx.update(runRef, runUpdates)

    return { ...txResult, trailblazer: isTrailblazer }
  })

  // Auto-finalize: apply aggregate stats outside the transaction (no nesting)
  if (result.runOver) {
    applyRunToAggregate(uid, runId).catch((err) =>
      console.error('[submitAnswer] Failed to apply run to aggregate:', err)
    )
  }

  return result
}

export async function getRunByIdPublic(runId: string): Promise<{ run: RunDoc; uid: string } | null> {
  const db = getFirestoreDb()
  const snaps = await db.collectionGroup('triviaInfinite')
    .where('runId', '==', runId)
    .limit(1)
    .get()
  if (snaps.empty) return null
  const doc = snaps.docs[0]
  const run = doc.data() as RunDoc
  // Extract uid from the document path: users/{uid}/triviaInfinite/{runId}
  const uid = doc.ref.parent.parent?.id ?? ''
  return { run, uid }
}

export async function recordSkip(uid: string, runId: string, questionId: string): Promise<void> {
  const db = getFirestoreDb()
  const runRef = db.doc(`users/${uid}/triviaInfinite/${runId}`)
  await runRef.update({
    skipsUsed: FieldValue.increment(1),
  })
}

export async function endRun(uid: string, runId: string): Promise<void> {
  const db = getFirestoreDb()
  const runRef = db.doc(`users/${uid}/triviaInfinite/${runId}`)
  const snap = await runRef.get()
  if (!snap.exists) throw new Error('Run not found')
  const data = snap.data()!
  if (data.endedAt !== null) {
    // Run was already ended (e.g. auto-finalized when lives hit 0).
    // Still attempt to apply stats in case they weren't applied yet
    // (applyRunToAggregate is idempotent via statsApplied flag).
    applyRunToAggregate(uid, runId).catch((err) =>
      console.error('[endRun] Failed to apply run to aggregate:', err)
    )
    return
  }
  await runRef.update({ endedAt: FieldValue.serverTimestamp() })
  applyRunToAggregate(uid, runId).catch((err) =>
    console.error('[endRun] Failed to apply run to aggregate:', err)
  )
}

export interface InfiniteLeaderboardEntry {
  uid: string
  displayName: string
  score: number
  longestStreak: number
  questionsAnswered: number
  date: FirebaseFirestore.Timestamp | null
}

async function hydrateNicknames(uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map()
  const db = getFirestoreDb()
  const refs = uids.map((uid) => db.doc(`users/${uid}`))
  const snaps = await db.getAll(...refs)
  const map = new Map<string, string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data() as { uid?: string; nickname?: string }
    if (data?.uid) {
      map.set(data.uid, data.nickname ?? '')
    }
  }
  return map
}

export async function getInfiniteTopByScore(limit = 20): Promise<InfiniteLeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collectionGroup('triviaInfinite')
    .where('mode', '==', 'scored')
    .where('endedAt', '!=', null)
    .orderBy('score', 'desc')
    .limit(limit)
    .get()

  const entries = snap.docs.map((d) => {
    const run = d.data() as RunDoc
    const uid = d.ref.parent.parent?.id ?? ''
    return { uid, score: run.score, longestStreak: run.longestStreak, questionsAnswered: run.answers?.length ?? 0, date: run.endedAt }
  })
  const nicknames = await hydrateNicknames(entries.map((e) => e.uid))
  return entries.map((e) => ({
    ...e,
    displayName: nicknames.get(e.uid) || 'Player',
  }))
}

export async function getInfiniteTopByStreak(limit = 20): Promise<InfiniteLeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collectionGroup('triviaInfinite')
    .where('mode', '==', 'scored')
    .where('endedAt', '!=', null)
    .orderBy('longestStreak', 'desc')
    .limit(limit)
    .get()

  const entries = snap.docs.map((d) => {
    const run = d.data() as RunDoc
    const uid = d.ref.parent.parent?.id ?? ''
    return { uid, score: run.score, longestStreak: run.longestStreak, questionsAnswered: run.answers?.length ?? 0, date: run.endedAt }
  })
  const nicknames = await hydrateNicknames(entries.map((e) => e.uid))
  return entries.map((e) => ({
    ...e,
    displayName: nicknames.get(e.uid) || 'Player',
  }))
}

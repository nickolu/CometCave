import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import { LIVES_START, applyAnswer } from '@/app/trivia/lib/infiniteScoring'
import type { AnswerResult } from '@/app/trivia/lib/infiniteScoring'
import { getFirestoreDb } from '@/lib/firebase/server'
import { getCategoryIdByName } from '@/lib/trivia/categories'
import {
  type MedalEarned,
  customCategorySlug,
  detectCustomMedalEarned,
  detectMedalEarned,
} from '@/lib/trivia/medals'
import { buildMarkSeenWrite } from '@/lib/trivia/triviaState'
import { applyRunToAggregate } from '@/lib/trivia/triviaStats'

export interface RunDoc {
  runId: string
  uid: string
  mode: 'scored' | 'practice'
  // Empty array = all categories. Single-element = legacy single-category
  // behavior. The old categoryFilter field is still written for back-compat
  // with any reader that hasn't been updated.
  categoryFilters: number[]
  // Deprecated, kept for backward compatibility. Equals categoryFilters[0]
  // when there's exactly one filter, null otherwise.
  categoryFilter: number | null
  // When set, the run generates questions about this custom topic on-the-fly.
  // Mutually exclusive with categoryFilters (stored as [] when customCategory is set).
  customCategory?: string | null
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

export async function startRun(
  uid: string,
  mode: 'scored' | 'practice' = 'scored',
  categoryIds: number[] = [],
  customCategory?: string | null
): Promise<{ runId: string; livesRemaining: number; currentStreak: number }> {
  const db = getFirestoreDb()
  const runRef = db.collection(`users/${uid}/triviaInfinite`).doc()
  const now = FieldValue.serverTimestamp()
  const filters = customCategory ? [] : categoryIds
  const docData: Record<string, unknown> = {
    runId: runRef.id,
    uid,
    mode,
    categoryFilters: filters,
    categoryFilter: filters.length === 1 ? filters[0] : null,
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
  }
  if (customCategory) {
    docData.customCategory = customCategory
  }
  await runRef.set(docData)
  return { runId: runRef.id, livesRemaining: LIVES_START, currentStreak: 0 }
}

export async function submitAnswer(params: {
  uid: string
  runId: string
  questionId: string
  correct: boolean
  elapsedMs: number
}): Promise<AnswerResult & { trailblazer: boolean; medalEarned: MedalEarned | null }> {
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

    // Resolve the medal track for this answer. Only correct answers in
    // scored mode count. Custom-topic runs win medals on their own per-topic
    // track; preset-category runs win medals keyed by categoryId. The two
    // paths are mutually exclusive — a run with run.customCategory set
    // never produces preset-category medals, even if its question's category
    // string happens to match a known preset.
    const customTopic =
      typeof run.customCategory === 'string' && run.customCategory.length > 0
        ? run.customCategory
        : null
    const categoryId =
      customTopic === null && typeof qData.category === 'string'
        ? getCategoryIdByName(qData.category)
        : null
    const scoredAndCorrect = correct && run.mode === 'scored'
    const eligibleForCategoryMedal = scoredAndCorrect && categoryId !== null
    const eligibleForCustomMedal = scoredAndCorrect && customTopic !== null

    const medalStatsRef = eligibleForCategoryMedal
      ? db.doc(`users/${uid}/triviaCategoryStats/${categoryId}`)
      : eligibleForCustomMedal
      ? db.doc(`users/${uid}/triviaCustomCategoryStats/${customCategorySlug(customTopic!)}`)
      : null
    const medalStatsSnap = medalStatsRef ? await tx.get(medalStatsRef) : null
    const prevCorrectCount = medalStatsSnap?.exists ? (medalStatsSnap.data()?.correctCount ?? 0) : 0

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

    // Write seenQuestions (source of truth for analytics)
    tx.set(seenRef, { at: now, correct })

    // Mirror onto the per-user state doc so the sampler doesn't have to
    // scan the seenQuestions subcollection on every /next.
    const markSeen = buildMarkSeenWrite(uid, questionId)
    tx.set(markSeen.ref, markSeen.data, { merge: true })

    // Write answeredBy reverse index
    tx.set(answeredByRef, { uid, runId, correct, at: now })

    // Update or create the medal aggregate for whichever track applies.
    let medalEarned: MedalEarned | null = null
    if (eligibleForCategoryMedal && medalStatsRef && categoryId !== null) {
      const newCorrectCount = prevCorrectCount + 1
      const earned = detectMedalEarned(prevCorrectCount, newCorrectCount, categoryId)

      const baseUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        categoryId,
        correctCount: FieldValue.increment(1),
        lastAnswerAt: now,
      }
      if (earned) {
        baseUpdates.lastTierEarnedAt = now
      }

      if (medalStatsSnap?.exists) {
        tx.update(medalStatsRef, baseUpdates)
      } else {
        tx.set(medalStatsRef, {
          categoryId,
          correctCount: 1,
          lastAnswerAt: now,
          lastTierEarnedAt: earned ? now : null,
        })
      }

      if (earned) {
        const categoryName = typeof qData.category === 'string' ? qData.category : ''
        medalEarned = {
          tier: earned.tier,
          label: earned.label,
          categoryId,
          categoryName,
          correctCount: newCorrectCount,
        }
      }
    } else if (eligibleForCustomMedal && medalStatsRef && customTopic !== null) {
      const newCorrectCount = prevCorrectCount + 1
      const earned = detectCustomMedalEarned(prevCorrectCount, newCorrectCount)

      const baseUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        topic: customTopic,
        correctCount: FieldValue.increment(1),
        lastAnswerAt: now,
      }
      if (earned) {
        baseUpdates.lastTierEarnedAt = now
      }

      if (medalStatsSnap?.exists) {
        tx.update(medalStatsRef, baseUpdates)
      } else {
        tx.set(medalStatsRef, {
          topic: customTopic,
          correctCount: 1,
          lastAnswerAt: now,
          lastTierEarnedAt: earned ? now : null,
        })
      }

      if (earned) {
        medalEarned = {
          tier: earned.tier,
          label: earned.label,
          categoryId: null,
          categoryName: customTopic,
          correctCount: newCorrectCount,
          customTopic,
        }
      }
    }

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

    return { ...txResult, trailblazer: isTrailblazer, medalEarned }
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
  // Mark question as seen so the sampler won't return it again
  if (questionId) {
    await db.doc(`users/${uid}/seenQuestions/${questionId}`).set({
      at: FieldValue.serverTimestamp(),
      correct: false,
      skipped: true,
    })
    const markSeen = buildMarkSeenWrite(uid, questionId)
    await markSeen.ref.set(markSeen.data, { merge: true })
  }
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

// Drops anonymous players (CLAUDE.md "Anonymous-first, sign-up as reward":
// leaderboard visibility is one of the depth perks gated behind sign-up)
// and any user without a current nickname.
async function hydrateNicknames(uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map()
  const db = getFirestoreDb()
  const refs = uids.map((uid) => db.doc(`users/${uid}`))
  const snaps = await db.getAll(...refs)
  const map = new Map<string, string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data() as { nickname?: string; isAnonymous?: boolean }
    if (data?.isAnonymous) continue
    const nickname = data?.nickname ?? ''
    if (nickname) {
      map.set(snap.ref.id, nickname)
    }
  }
  return map
}

// TODO(#1263): Add getTopRunsByCustomCategory(customCategory, limit) for per-topic leaderboards.
// This requires a composite index on (customCategory, mode, score) which isn't yet defined.
export async function getInfiniteTopByScore(limit = 20): Promise<InfiniteLeaderboardEntry[]> {
  const db = getFirestoreDb()
  // Overfetch so that the post-hydration filter that drops players without
  // a nickname still returns up to `limit` entries.
  const snap = await db
    .collectionGroup('triviaInfinite')
    .where('mode', '==', 'scored')
    .where('endedAt', '!=', null)
    .orderBy('score', 'desc')
    .limit(limit * 2)
    .get()

  const entries = snap.docs.map((d) => {
    const run = d.data() as RunDoc
    const uid = d.ref.parent.parent?.id ?? ''
    return { uid, score: run.score, longestStreak: run.longestStreak, questionsAnswered: run.answers?.length ?? 0, date: run.endedAt }
  })
  const nicknames = await hydrateNicknames(entries.map((e) => e.uid))
  return entries
    .filter((e) => !!nicknames.get(e.uid))
    .slice(0, limit)
    .map((e) => ({
      ...e,
      displayName: nicknames.get(e.uid) as string,
    }))
}

export async function getInfiniteTopByStreak(limit = 20): Promise<InfiniteLeaderboardEntry[]> {
  const db = getFirestoreDb()
  const snap = await db
    .collectionGroup('triviaInfinite')
    .where('mode', '==', 'scored')
    .where('endedAt', '!=', null)
    .orderBy('longestStreak', 'desc')
    .limit(limit * 2)
    .get()

  const entries = snap.docs.map((d) => {
    const run = d.data() as RunDoc
    const uid = d.ref.parent.parent?.id ?? ''
    return { uid, score: run.score, longestStreak: run.longestStreak, questionsAnswered: run.answers?.length ?? 0, date: run.endedAt }
  })
  const nicknames = await hydrateNicknames(entries.map((e) => e.uid))
  return entries
    .filter((e) => !!nicknames.get(e.uid))
    .slice(0, limit)
    .map((e) => ({
      ...e,
      displayName: nicknames.get(e.uid) as string,
    }))
}

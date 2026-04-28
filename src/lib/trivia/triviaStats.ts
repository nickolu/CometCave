import { FieldValue } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'
import type { RunDoc } from '@/lib/trivia/infiniteRuns'

export interface AggregateStats {
  totalAnswered: number
  totalCorrect: number
  runsPlayed: number
  bestRun: {
    score: number
    longestStreak: number
    runId: string
    endedAt: FirebaseFirestore.Timestamp | null
  } | null
  bestStreak: number
  trailblazerCount: number
  totalTimeMs: number
  byCategory: Record<string, { answered: number; correct: number; totalTimeMs: number }>
  byDifficulty: {
    easy: { answered: number; correct: number }
    medium: { answered: number; correct: number }
    hard: { answered: number; correct: number }
  }
  lastUpdatedAt: FirebaseFirestore.Timestamp | null
}

const EMPTY_STATS: AggregateStats = {
  totalAnswered: 0,
  totalCorrect: 0,
  runsPlayed: 0,
  bestRun: null,
  bestStreak: 0,
  trailblazerCount: 0,
  totalTimeMs: 0,
  byCategory: {},
  byDifficulty: {
    easy: { answered: 0, correct: 0 },
    medium: { answered: 0, correct: 0 },
    hard: { answered: 0, correct: 0 },
  },
  lastUpdatedAt: null,
}

export async function getAggregateStats(uid: string): Promise<AggregateStats> {
  const db = getFirestoreDb()
  const snap = await db.doc(`users/${uid}/triviaStats/aggregate`).get()
  if (!snap.exists) return { ...EMPTY_STATS }
  return snap.data() as AggregateStats
}

// Called at run finalization. Reads the run doc, walks its answers[],
// and atomically updates the aggregate doc. Idempotent via statsApplied flag.
export async function applyRunToAggregate(uid: string, runId: string): Promise<void> {
  const db = getFirestoreDb()
  const runRef = db.doc(`users/${uid}/triviaInfinite/${runId}`)
  const aggRef = db.doc(`users/${uid}/triviaStats/aggregate`)

  await db.runTransaction(async (tx) => {
    const runSnap = await tx.get(runRef)
    if (!runSnap.exists) throw new Error('Run not found')
    const run = runSnap.data() as RunDoc & { statsApplied?: boolean }

    // Practice runs don't count toward stats
    if (run.mode === 'practice') return

    // Idempotency: skip if already applied
    if (run.statsApplied === true) return

    const aggSnap = await tx.get(aggRef)
    const agg: AggregateStats = aggSnap.exists
      ? (aggSnap.data() as AggregateStats)
      : { ...EMPTY_STATS }

    // Batch-read all question docs referenced by answers
    const questionIds = run.answers.map((a) => a.questionId)
    const questionRefs = questionIds.map((id) => db.doc(`aiQuestions/${id}`))
    const questionSnaps = questionRefs.length > 0 ? await tx.getAll(...questionRefs) : []
    const questionMap = new Map<string, { category: string; difficulty: 'easy' | 'medium' | 'hard' }>()
    for (const qs of questionSnaps) {
      if (qs.exists) {
        const qd = qs.data()!
        questionMap.set(qs.id, { category: qd.category, difficulty: qd.difficulty })
      }
    }

    // Accumulate deltas from this run's answers
    let totalAnswered = 0
    let totalCorrect = 0
    let totalTimeMs = 0
    let trailblazerCount = 0
    const byCategory: Record<string, { answered: number; correct: number; totalTimeMs: number }> = {}
    const byDifficulty: Record<string, { answered: number; correct: number }> = {
      easy: { answered: 0, correct: 0 },
      medium: { answered: 0, correct: 0 },
      hard: { answered: 0, correct: 0 },
    }

    for (const answer of run.answers) {
      totalAnswered += 1
      if (answer.correct) totalCorrect += 1
      totalTimeMs += answer.timeMs
      if (answer.trailblazer) trailblazerCount += 1

      const qInfo = questionMap.get(answer.questionId)
      if (qInfo) {
        // Category
        if (!byCategory[qInfo.category]) {
          byCategory[qInfo.category] = { answered: 0, correct: 0, totalTimeMs: 0 }
        }
        byCategory[qInfo.category].answered += 1
        if (answer.correct) byCategory[qInfo.category].correct += 1
        byCategory[qInfo.category].totalTimeMs += answer.timeMs

        // Difficulty
        byDifficulty[qInfo.difficulty].answered += 1
        if (answer.correct) byDifficulty[qInfo.difficulty].correct += 1
      }
    }

    // Merge byCategory: start from existing, add deltas
    const mergedByCategory: Record<string, { answered: number; correct: number; totalTimeMs: number }> = {}
    for (const [cat, val] of Object.entries(agg.byCategory)) {
      mergedByCategory[cat] = { ...val }
    }
    for (const [cat, deltas] of Object.entries(byCategory)) {
      if (!mergedByCategory[cat]) {
        mergedByCategory[cat] = { answered: 0, correct: 0, totalTimeMs: 0 }
      }
      mergedByCategory[cat].answered += deltas.answered
      mergedByCategory[cat].correct += deltas.correct
      mergedByCategory[cat].totalTimeMs += deltas.totalTimeMs
    }

    // Build merged aggregate
    const newAgg: AggregateStats = {
      totalAnswered: agg.totalAnswered + totalAnswered,
      totalCorrect: agg.totalCorrect + totalCorrect,
      runsPlayed: agg.runsPlayed + 1,
      bestRun: agg.bestRun,
      bestStreak: Math.max(agg.bestStreak, run.longestStreak),
      trailblazerCount: agg.trailblazerCount + trailblazerCount,
      totalTimeMs: agg.totalTimeMs + totalTimeMs,
      byCategory: mergedByCategory,
      byDifficulty: {
        easy: {
          answered: agg.byDifficulty.easy.answered + byDifficulty.easy.answered,
          correct: agg.byDifficulty.easy.correct + byDifficulty.easy.correct,
        },
        medium: {
          answered: agg.byDifficulty.medium.answered + byDifficulty.medium.answered,
          correct: agg.byDifficulty.medium.correct + byDifficulty.medium.correct,
        },
        hard: {
          answered: agg.byDifficulty.hard.answered + byDifficulty.hard.answered,
          correct: agg.byDifficulty.hard.correct + byDifficulty.hard.correct,
        },
      },
      lastUpdatedAt: null, // overwritten by server timestamp below
    }

    // Update bestRun if this run's score exceeds the current best
    if (!newAgg.bestRun || run.score > newAgg.bestRun.score) {
      newAgg.bestRun = {
        score: run.score,
        longestStreak: run.longestStreak,
        runId: run.runId,
        endedAt: run.endedAt,
      }
    }

    // Write aggregate with server timestamp
    tx.set(aggRef, { ...newAgg, lastUpdatedAt: FieldValue.serverTimestamp() })

    // Mark the run as having its stats applied (idempotency guard)
    tx.update(runRef, { statsApplied: true })
  })
}

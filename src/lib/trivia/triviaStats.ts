import { FieldValue } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'
import type { RunDoc } from '@/lib/trivia/infiniteRuns'

export interface AggregateStats {
  totalAnswered: number
  totalCorrect: number
  totalScore: number
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
  exhaustionCount: number
  likesGiven: number
  dislikesGiven: number
  reportsFiled: number
  lastUpdatedAt: FirebaseFirestore.Timestamp | null
}

const EMPTY_STATS: AggregateStats = {
  totalAnswered: 0,
  totalCorrect: 0,
  totalScore: 0,
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
  exhaustionCount: 0,
  likesGiven: 0,
  dislikesGiven: 0,
  reportsFiled: 0,
  lastUpdatedAt: null,
}

export async function getAggregateStats(uid: string): Promise<AggregateStats> {
  const db = getFirestoreDb()
  const snap = await db.doc(`users/${uid}/triviaStats/aggregate`).get()
  if (!snap.exists) return { ...EMPTY_STATS }
  // applyRunToAggregate now writes via merge-style field updates (instead
  // of full-doc rewrites), so a stored doc may be missing some fields.
  // Hydrate from EMPTY_STATS so the consumer always sees the full shape.
  const stored = snap.data() as Partial<AggregateStats>
  return {
    ...EMPTY_STATS,
    ...stored,
    byCategory: stored.byCategory ?? {},
    byDifficulty: {
      easy: { ...EMPTY_STATS.byDifficulty.easy, ...stored.byDifficulty?.easy },
      medium: { ...EMPTY_STATS.byDifficulty.medium, ...stored.byDifficulty?.medium },
      hard: { ...EMPTY_STATS.byDifficulty.hard, ...stored.byDifficulty?.hard },
    },
  }
}

// Called at run finalization. Reads the run doc, walks its answers[],
// and atomically updates the aggregate doc. Idempotent via statsApplied flag.
//
// Uses merge-style field updates (FieldValue.increment for counters,
// dotted field paths for nested deltas) instead of a full-doc rewrite,
// so concurrent writers like incrementVoiceStat / trackExhaustion never
// have their writes clobbered. The only fields this function touches
// are the run-derived ones; voice stats and exhaustion count belong
// exclusively to their respective writers.
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

    // We only need the existing aggregate to compare against bestStreak /
    // bestRun. Counters use FieldValue.increment so we don't read them.
    const aggSnap = await tx.get(aggRef)
    const existing: Partial<AggregateStats> = aggSnap.exists
      ? (aggSnap.data() as Partial<AggregateStats>)
      : {}

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
    const byDifficulty: Record<'easy' | 'medium' | 'hard', { answered: number; correct: number }> = {
      easy: { answered: 0, correct: 0 },
      medium: { answered: 0, correct: 0 },
      hard: { answered: 0, correct: 0 },
    }

    const flaggedSet = new Set<string>(run.flaggedQuestionIds ?? [])

    for (const answer of run.answers) {
      // Skip flagged questions — they don't count toward stats
      if (flaggedSet.has(answer.questionId)) continue

      totalAnswered += 1
      if (answer.correct) totalCorrect += 1
      totalTimeMs += answer.timeMs
      if (answer.trailblazer) trailblazerCount += 1

      const qInfo = questionMap.get(answer.questionId)
      if (qInfo) {
        if (!byCategory[qInfo.category]) {
          byCategory[qInfo.category] = { answered: 0, correct: 0, totalTimeMs: 0 }
        }
        byCategory[qInfo.category].answered += 1
        if (answer.correct) byCategory[qInfo.category].correct += 1
        byCategory[qInfo.category].totalTimeMs += answer.timeMs

        byDifficulty[qInfo.difficulty].answered += 1
        if (answer.correct) byDifficulty[qInfo.difficulty].correct += 1
      }
    }

    // Build a sparse update — only fields this function owns.
    const updates: Record<string, unknown> = {
      totalAnswered: FieldValue.increment(totalAnswered),
      totalCorrect: FieldValue.increment(totalCorrect),
      totalScore: FieldValue.increment(run.score),
      runsPlayed: FieldValue.increment(1),
      trailblazerCount: FieldValue.increment(trailblazerCount),
      totalTimeMs: FieldValue.increment(totalTimeMs),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    }

    // Max-style fields: read existing and only write if this run wins.
    if ((existing.bestStreak ?? 0) < run.longestStreak) {
      updates.bestStreak = run.longestStreak
    }
    if (!existing.bestRun || run.score > existing.bestRun.score) {
      updates.bestRun = {
        score: run.score,
        longestStreak: run.longestStreak,
        runId: run.runId,
        endedAt: run.endedAt,
      }
    }

    // byDifficulty deltas via dotted field paths.
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const d = byDifficulty[diff]
      if (d.answered > 0) updates[`byDifficulty.${diff}.answered`] = FieldValue.increment(d.answered)
      if (d.correct > 0) updates[`byDifficulty.${diff}.correct`] = FieldValue.increment(d.correct)
    }

    // byCategory deltas.
    for (const [cat, d] of Object.entries(byCategory)) {
      if (d.answered > 0) updates[`byCategory.${cat}.answered`] = FieldValue.increment(d.answered)
      if (d.correct > 0) updates[`byCategory.${cat}.correct`] = FieldValue.increment(d.correct)
      if (d.totalTimeMs > 0) updates[`byCategory.${cat}.totalTimeMs`] = FieldValue.increment(d.totalTimeMs)
    }

    tx.set(aggRef, updates, { merge: true })

    // Mark the run as having its stats applied (idempotency guard)
    tx.update(runRef, { statsApplied: true })
  })
}

export async function incrementVoiceStat(
  uid: string,
  field: 'likesGiven' | 'dislikesGiven' | 'reportsFiled',
  delta = 1
): Promise<void> {
  if (delta === 0) return
  const db = getFirestoreDb()
  const aggRef = db.doc(`users/${uid}/triviaStats/aggregate`)
  await aggRef.set(
    { [field]: FieldValue.increment(delta), lastUpdatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}

export async function trackExhaustion(uid: string): Promise<void> {
  const db = getFirestoreDb()
  const aggRef = db.doc(`users/${uid}/triviaStats/aggregate`)
  await aggRef.set(
    { exhaustionCount: FieldValue.increment(1), lastUpdatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}

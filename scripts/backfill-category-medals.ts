#!/usr/bin/env tsx
/**
 * Backfill per-category correct-answer counts onto triviaCategoryStats
 * aggregate docs from completed scored infinite runs.
 *
 * Run this once after the medal write path (PR #2) ships, to seed
 * historical runs into the medal system.
 *
 * Idempotent: each processed run is stamped with `medalsBackfilled: true`
 * in the same atomic batch as the aggregate increments, so re-running
 * skips already-processed runs.
 *
 * Edge case: a run that was in-progress when PR #2 deployed and ended
 * AFTER deploy will have a mix of live-counted and unbackfilled answers.
 * To avoid double-counting those, this script only processes runs where
 * `endedAt < <cutoff>`. Pass `--cutoff <ISO timestamp>` set to roughly
 * when PR #2 deployed (use git log on the merge commit for the time).
 *
 * Usage:
 *   npx tsx scripts/backfill-category-medals.ts \
 *     --cutoff 2026-04-30T18:25:00Z [--dry-run] [--user <uid>]
 *
 * Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'

import { getCategoryIdByName } from '@/lib/trivia/categories'
import { getMedalLabel, getMedalTier } from '@/lib/trivia/medals'

interface Args {
  dryRun: boolean
  cutoff: Date
  userId: string | null
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let cutoffStr: string | null = null
  let userId: string | null = null
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--cutoff') cutoffStr = args[++i]
    else if (a === '--user') userId = args[++i]
    else {
      console.error(`Unknown arg: ${a}`)
      process.exit(1)
    }
  }

  if (!cutoffStr) {
    console.error('ERROR: --cutoff <ISO timestamp> is required.')
    console.error('Set it to roughly when the medal write path (PR #2) deployed.')
    console.error('Find the deploy time via: git log -1 --format=%aI <merge-commit>')
    process.exit(1)
  }

  const cutoff = new Date(cutoffStr)
  if (isNaN(cutoff.getTime())) {
    console.error(`ERROR: Invalid --cutoff value: ${cutoffStr}`)
    process.exit(1)
  }

  return { dryRun, cutoff, userId }
}

function ensureApp() {
  if (getApps().length > 0) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    console.error('ERROR: Missing Firebase env vars.')
    process.exit(1)
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

interface RunSummary {
  ref: FirebaseFirestore.DocumentReference
  uid: string
  endedAt: Date
  correctsByCategory: Map<number, number>
}

async function main() {
  const { dryRun, cutoff, userId } = parseArgs()
  ensureApp()
  const db = getFirestore()

  console.log(`Cutoff: ${cutoff.toISOString()}`)
  console.log(`Dry run: ${dryRun ? 'YES (no writes)' : 'NO (will write to Firestore)'}`)
  if (userId) console.log(`Restricted to user: ${userId}`)
  console.log('─'.repeat(60))

  // Fetch eligible runs. For collection-group we filter by mode in-memory
  // to avoid needing a dedicated single-field collection-group index.
  let runDocs: FirebaseFirestore.QueryDocumentSnapshot[]
  if (userId) {
    const snap = await db
      .collection(`users/${userId}/triviaInfinite`)
      .where('mode', '==', 'scored')
      .get()
    runDocs = snap.docs
  } else {
    const snap = await db.collectionGroup('triviaInfinite').get()
    runDocs = snap.docs.filter((d) => d.data().mode === 'scored')
  }
  console.log(`Fetched ${runDocs.length} scored run(s).`)

  const questionCategoryCache = new Map<string, number | null>()

  async function resolveCategoryId(questionId: string): Promise<number | null> {
    if (questionCategoryCache.has(questionId)) return questionCategoryCache.get(questionId)!
    const qSnap = await db.doc(`aiQuestions/${questionId}`).get()
    if (!qSnap.exists) {
      questionCategoryCache.set(questionId, null)
      return null
    }
    const category = qSnap.data()?.category
    const id = typeof category === 'string' ? getCategoryIdByName(category) : null
    questionCategoryCache.set(questionId, id)
    return id
  }

  let skippedAlreadyBackfilled = 0
  let skippedAfterCutoff = 0
  let skippedNotEnded = 0
  const eligible: RunSummary[] = []

  for (const runDoc of runDocs) {
    const run = runDoc.data()
    const uid = runDoc.ref.parent.parent?.id
    if (!uid) continue

    if (run.medalsBackfilled === true) {
      skippedAlreadyBackfilled++
      continue
    }
    if (!run.endedAt) {
      skippedNotEnded++
      continue
    }
    const endedAt = (run.endedAt as Timestamp).toDate()
    if (endedAt >= cutoff) {
      skippedAfterCutoff++
      continue
    }

    const answers: Array<{ questionId: string; correct: boolean }> = run.answers ?? []
    const correctsByCategory = new Map<number, number>()
    for (const ans of answers) {
      if (!ans.correct) continue
      const catId = await resolveCategoryId(ans.questionId)
      if (catId === null) continue
      correctsByCategory.set(catId, (correctsByCategory.get(catId) ?? 0) + 1)
    }

    eligible.push({ ref: runDoc.ref, uid, endedAt, correctsByCategory })
  }

  console.log(`Eligible runs to process: ${eligible.length}`)
  console.log(`Skipped (already backfilled): ${skippedAlreadyBackfilled}`)
  console.log(`Skipped (ended after cutoff): ${skippedAfterCutoff}`)
  console.log(`Skipped (not yet ended): ${skippedNotEnded}`)
  console.log('─'.repeat(60))

  let processedRuns = 0
  let aggregateWrites = 0
  const perUserPerCategory = new Map<string, Map<number, number>>()

  for (const run of eligible) {
    if (run.correctsByCategory.size === 0) {
      // Still mark as backfilled so we don't re-walk on re-runs.
      if (!dryRun) await run.ref.update({ medalsBackfilled: true })
      processedRuns++
      continue
    }

    if (dryRun) {
      const userTotals = perUserPerCategory.get(run.uid) ?? new Map<number, number>()
      for (const [cat, n] of run.correctsByCategory) {
        userTotals.set(cat, (userTotals.get(cat) ?? 0) + n)
      }
      perUserPerCategory.set(run.uid, userTotals)
      processedRuns++
      continue
    }

    // Atomic per-run: increment all affected aggregates AND stamp the run.
    const batch = db.batch()
    for (const [cat, n] of run.correctsByCategory) {
      const ref = db.doc(`users/${run.uid}/triviaCategoryStats/${cat}`)
      batch.set(
        ref,
        {
          categoryId: cat,
          correctCount: FieldValue.increment(n),
          lastAnswerAt: Timestamp.fromDate(run.endedAt),
        },
        { merge: true }
      )
      aggregateWrites++
    }
    batch.update(run.ref, { medalsBackfilled: true })
    await batch.commit()
    processedRuns++
  }

  console.log(`Processed runs: ${processedRuns}`)
  if (!dryRun) console.log(`Aggregate writes: ${aggregateWrites}`)

  if (dryRun && perUserPerCategory.size > 0) {
    console.log('─'.repeat(60))
    console.log('Dry-run summary — increments that WOULD be applied:')
    console.log('(Note: existing aggregate values are not read; tier shown is')
    console.log(' from the BACKFILL DELTA only, ignoring any prior live counts.)')
    for (const [uid, totals] of perUserPerCategory) {
      console.log(`  ${uid}:`)
      for (const [cat, n] of totals) {
        const tier = getMedalTier(n)
        const label = getMedalLabel(cat, tier) ?? '(none)'
        console.log(`    cat ${cat}: +${n} correct → delta-only tier=${tier} (${label})`)
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

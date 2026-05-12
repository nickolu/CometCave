#!/usr/bin/env tsx
/**
 * Diagnose why /api/v1/trivia/infinite/next is hitting the slow
 * generation path. Replays the sampler logic offline against the live
 * Firestore for a given uid, prints pool/seen counts, and simulates 20
 * candidate-window picks to estimate how often the sampler is returning
 * null (which is what makes the route fall through to LLM generation).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/diag-trivia-sampler.ts <uid> [categoryId]
 *
 * Pass a categoryId (the numeric key in CATEGORY_META, e.g. 17 for
 * Science & Nature) to replay the per-category sampler path — that's
 * the scenario most likely to be exhausted in practice. Without a
 * categoryId, runs against the global pool.
 *
 * To find your uid: open the trivia game while signed in, run
 *   firebase.auth().currentUser?.uid
 * in the browser console; or look at users/{uid}/triviaInfiniteMeta/state
 * in the Firestore console.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import { CATEGORY_META } from '../src/lib/trivia/categories'

const CANDIDATE_WINDOW = 50
const SINGLE_CATEGORY_FETCH = 300
const TRIALS = 20

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

async function main() {
  const uid = process.argv[2]
  if (!uid) {
    console.error('Usage: diag-trivia-sampler <uid>')
    process.exit(1)
  }

  ensureApp()
  const db = getFirestore()

  // Active pool size
  const poolAgg = await db
    .collection('aiQuestions')
    .where('status', '==', 'active')
    .where('type', '==', 'free-text')
    .count()
    .get()
  const activeCount = poolAgg.data().count

  // State doc
  const stateSnap = await db.doc(`users/${uid}/triviaInfiniteMeta/state`).get()
  const state = stateSnap.exists
    ? (stateSnap.data() as {
        recentSeen?: string[]
        totalSeenCount?: number
        migrationVersion?: number
        migrated?: boolean
      })
    : null
  const recentSeen = state?.recentSeen ?? []
  const totalSeenCount = state?.totalSeenCount ?? 0
  const migrationVersion =
    typeof state?.migrationVersion === 'number'
      ? state.migrationVersion
      : state?.migrated === true
      ? 1
      : 0
  const seenSet = new Set(recentSeen)

  // Direct subcollection count for cross-check
  const seenCol = await db.collection(`users/${uid}/seenQuestions`).count().get()
  const seenColCount = seenCol.data().count

  // Stats with no-random-field check (would explain orderBy('random') gaps)
  const allActive = await db
    .collection('aiQuestions')
    .where('status', '==', 'active')
    .where('type', '==', 'free-text')
    .select('random')
    .get()
  let missingRandom = 0
  for (const d of allActive.docs) {
    const r = (d.data() as { random?: unknown }).random
    if (typeof r !== 'number') missingRandom++
  }

  console.log('═'.repeat(60))
  console.log('  Pool')
  console.log('═'.repeat(60))
  console.log(`  active free-text count : ${activeCount}`)
  console.log(`  docs missing random    : ${missingRandom}`)
  console.log()
  console.log('═'.repeat(60))
  console.log(`  User state — ${uid}`)
  console.log('═'.repeat(60))
  console.log(`  state doc exists       : ${state !== null}`)
  console.log(`  migrationVersion       : ${migrationVersion}`)
  console.log(`  recentSeen.length      : ${recentSeen.length}`)
  console.log(`  totalSeenCount         : ${totalSeenCount}`)
  console.log(`  seenQuestions subcol   : ${seenColCount}`)
  const approxUnanswered = Math.max(0, activeCount - recentSeen.length)
  console.log(`  approx unanswered      : ${approxUnanswered}`)
  console.log()

  // Simulate the sampler's candidate-window pick TRIALS times.
  console.log('═'.repeat(60))
  console.log(`  Sampler simulation (${TRIALS} trials, window=${CANDIDATE_WINDOW})`)
  console.log('═'.repeat(60))

  const baseQuery = db
    .collection('aiQuestions')
    .where('status', '==', 'active')
    .where('type', '==', 'free-text')

  let nullTrials = 0
  let totalUnseenInWindow = 0
  let zeroCandidateTrials = 0
  for (let i = 0; i < TRIALS; i++) {
    const r = Math.random()
    const fwd = await baseQuery.orderBy('random').startAt(r).limit(CANDIDATE_WINDOW).get()
    const picked = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
    for (const d of fwd.docs) picked.set(d.id, d)
    if (picked.size < CANDIDATE_WINDOW) {
      const more = await baseQuery
        .orderBy('random')
        .limit(CANDIDATE_WINDOW - picked.size)
        .get()
      for (const d of more.docs) if (!picked.has(d.id)) picked.set(d.id, d)
    }
    const candidates = Array.from(picked.values())
    if (candidates.length === 0) zeroCandidateTrials++
    const unseen = candidates.filter((d) => !seenSet.has(d.id)).length
    totalUnseenInWindow += unseen
    if (unseen === 0) nullTrials++
  }

  const avgUnseen = (totalUnseenInWindow / TRIALS).toFixed(1)
  console.log(`  trials returning null   : ${nullTrials}/${TRIALS}`)
  console.log(`  avg unseen in window    : ${avgUnseen} / ${CANDIDATE_WINDOW}`)
  console.log(`  zero-candidate trials   : ${zeroCandidateTrials}`)
  console.log()

  if (nullTrials > 0) {
    console.log(
      'DIAGNOSIS: The sampler is returning null on some/all trials. /next falls'
    )
    console.log(
      'through to LLM generation when this happens, which is the slow path the'
    )
    console.log('user is observing.')
  } else {
    console.log('DIAGNOSIS: Sampler is finding unseen questions reliably. Slowness is')
    console.log('coming from somewhere else — check generation logs / Next prefetch.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

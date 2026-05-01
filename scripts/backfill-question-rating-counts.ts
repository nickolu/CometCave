#!/usr/bin/env tsx
/**
 * Backfill the likeCount and dislikeCount fields on aiQuestions docs
 * by counting up/down votes in each question's ratings/ subcollection.
 *
 * Idempotent: each run computes the canonical counts from the
 * subcollection and SETs them on the question doc, replacing whatever
 * was there. Safe to re-run.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-question-rating-counts.ts [--dry-run]
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { type WriteBatch, getFirestore } from 'firebase-admin/firestore'

const BATCH_SIZE = 400

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
  const dryRun = process.argv.includes('--dry-run')
  ensureApp()
  const db = getFirestore()

  console.log(`Dry run: ${dryRun ? 'YES (no writes)' : 'NO (will write to Firestore)'}`)
  console.log('─'.repeat(60))

  // Fetch all rating docs once via a collection-group query — cheaper
  // than walking each question's subcollection individually.
  console.log('Reading ratings collection group...')
  const ratingsSnap = await db.collectionGroup('ratings').get()

  const counts = new Map<string, { up: number; down: number }>()
  for (const doc of ratingsSnap.docs) {
    const parent = doc.ref.parent.parent
    if (!parent) continue
    if (parent.parent.id !== 'aiQuestions') continue
    const qid = parent.id
    const vote = doc.data().vote
    const cur = counts.get(qid) ?? { up: 0, down: 0 }
    if (vote === 'up') cur.up += 1
    else if (vote === 'down') cur.down += 1
    counts.set(qid, cur)
  }

  console.log(`Found ${ratingsSnap.size} rating doc(s) across ${counts.size} unique question(s).`)

  console.log('Reading aiQuestions...')
  const qSnap = await db.collection('aiQuestions').get()
  console.log(`Found ${qSnap.size} aiQuestions doc(s).`)

  let batch: WriteBatch = db.batch()
  let batchCount = 0
  let updated = 0
  let unchanged = 0

  for (const doc of qSnap.docs) {
    const data = doc.data()
    const computed = counts.get(doc.id) ?? { up: 0, down: 0 }
    const currentLike = data.likeCount ?? 0
    const currentDislike = data.dislikeCount ?? 0

    if (currentLike === computed.up && currentDislike === computed.down) {
      unchanged++
      continue
    }

    if (dryRun) {
      console.log(
        `would update ${doc.id}: likeCount ${currentLike}→${computed.up}, dislikeCount ${currentDislike}→${computed.down}`
      )
      updated++
      continue
    }

    batch.update(doc.ref, {
      likeCount: computed.up,
      dislikeCount: computed.down,
    })
    batchCount++
    updated++

    if (batchCount >= BATCH_SIZE) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit()
  }

  console.log('─'.repeat(60))
  console.log(`Updated:   ${updated}`)
  console.log(`Unchanged: ${unchanged}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

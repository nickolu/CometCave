#!/usr/bin/env tsx
/**
 * Backfill new infinite-mode fields onto existing aiQuestions documents.
 *
 * For each doc in the `aiQuestions` collection that is missing any of the new
 * fields (status, timesShown, timesCorrect, flaggedCount, avgTimeMs, random),
 * this script sets sensible defaults using batched writes.
 *
 * `random` is a uniform [0,1) value the sampler uses to draw a small candidate
 * window via `orderBy('random').startAt(r).limit(N)` instead of scanning the
 * full pool. Each missing doc gets a fresh Math.random() — must be set before
 * the new sampler ships, since `orderBy('random')` excludes docs without the
 * field.
 *
 * Idempotent — safe to re-run. Docs that already have all fields are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-aiquestion-fields.ts
 *
 * Required env vars (same as the app):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { WriteBatch, getFirestore } from 'firebase-admin/firestore'

const BATCH_SIZE = 400 // Firestore max is 500; stay well under

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

async function main() {
  ensureApp()
  const db = getFirestore()

  console.log('Fetching all aiQuestions documents...')
  const snap = await db.collection('aiQuestions').get()
  console.log(`Found ${snap.size} document(s).`)

  const DEFAULTS = {
    status: 'active',
    timesShown: 0,
    timesCorrect: 0,
    flaggedCount: 0,
    avgTimeMs: null,
  } as const

  let batch: WriteBatch = db.batch()
  let batchCount = 0
  let updatedTotal = 0
  let skippedTotal = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const missing: Record<string, unknown> = {}

    for (const [field, defaultValue] of Object.entries(DEFAULTS) as Array<
      [keyof typeof DEFAULTS, (typeof DEFAULTS)[keyof typeof DEFAULTS]]
    >) {
      if (!(field in data)) {
        missing[field] = defaultValue
      }
    }

    // `random` needs a fresh draw per doc, so it lives outside the
    // static DEFAULTS map. Skipped if the field already exists.
    if (!('random' in data)) {
      missing.random = Math.random()
    }

    if (Object.keys(missing).length === 0) {
      skippedTotal++
      continue
    }

    batch.update(doc.ref, missing as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>)
    batchCount++
    updatedTotal++

    if (batchCount >= BATCH_SIZE) {
      process.stdout.write(`Committing batch of ${batchCount}...`)
      await batch.commit()
      console.log(' done.')
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) {
    process.stdout.write(`Committing final batch of ${batchCount}...`)
    await batch.commit()
    console.log(' done.')
  }

  console.log('─'.repeat(60))
  console.log(`Updated: ${updatedTotal}  |  Skipped (already complete): ${skippedTotal}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

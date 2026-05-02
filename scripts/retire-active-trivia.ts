#!/usr/bin/env tsx
/**
 * Flip every currently-active aiQuestions doc to status='legacy'.
 *
 * Used to retire a generation of questions wholesale after a pipeline
 * change (model swap, prompt change, new fact source). Anything
 * generated AFTER this script runs will land with status='active'
 * via the normal save path, so the active pool refills automatically
 * with the new pipeline's output.
 *
 * Distinct from `backfill-legacy-models.ts`: that script only touches
 * docs missing the `models` provenance field (i.e. the gpt-4o era).
 * This one is the broader nuclear option — flip every active doc,
 * regardless of which model produced it. Run it intentionally,
 * usually right after a pipeline-quality PR deploys.
 *
 * Idempotent: re-running has no additional effect once everything
 * 'active' is already 'legacy'.
 *
 * Preserves 'flagged' and 'removed' status so admin signals stay
 * intact.
 *
 * Usage:
 *   yarn retire-active-trivia
 *   (which runs `tsx --env-file=.env.local scripts/retire-active-trivia.ts`)
 *
 * Required env vars (same as the app), normally loaded from .env.local:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, type WriteBatch } from 'firebase-admin/firestore'

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

  console.log('Fetching all active aiQuestions documents...')
  const snap = await db.collection('aiQuestions').where('status', '==', 'active').get()
  console.log(`Found ${snap.size} active document(s).`)

  if (snap.size === 0) {
    console.log('Nothing to retire.')
    return
  }

  let batch: WriteBatch = db.batch()
  let batchCount = 0
  let flippedTotal = 0

  for (const doc of snap.docs) {
    const update: { [key: string]: FieldValue | Partial<unknown> | undefined } = {
      status: 'legacy',
    }

    batch.update(doc.ref, update)
    batchCount++
    flippedTotal++

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
  console.log(`Flipped ${flippedTotal} active → legacy.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

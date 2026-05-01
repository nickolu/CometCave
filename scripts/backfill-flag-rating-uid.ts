#!/usr/bin/env tsx
/**
 * Backfill the `uid` and `questionId` fields onto existing
 * aiQuestions/{qid}/flags/{uid} and aiQuestions/{qid}/ratings/{uid}
 * documents. The doc id is already the uid, but having it as a field
 * enables collection-group queries like "all flags by user X."
 *
 * Idempotent: docs that already have both fields are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-flag-rating-uid.ts [--dry-run]
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

async function backfillCollectionGroup(
  db: FirebaseFirestore.Firestore,
  groupName: 'flags' | 'ratings',
  dryRun: boolean
): Promise<{ scanned: number; updated: number; skipped: number }> {
  const snap = await db.collectionGroup(groupName).get()
  let updated = 0
  let skipped = 0

  let batch: WriteBatch = db.batch()
  let batchCount = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const uid = doc.id
    const parent = doc.ref.parent.parent
    if (!parent) {
      skipped++
      continue
    }
    const questionId = parent.id

    const needsUid = !data.uid
    const needsQid = !data.questionId
    if (!needsUid && !needsQid) {
      skipped++
      continue
    }

    const updates: Record<string, string> = {}
    if (needsUid) updates.uid = uid
    if (needsQid) updates.questionId = questionId

    if (dryRun) {
      console.log(`would update ${doc.ref.path}`, updates)
      updated++
      continue
    }

    batch.update(doc.ref, updates)
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

  return { scanned: snap.size, updated, skipped }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  ensureApp()
  const db = getFirestore()

  console.log(`Dry run: ${dryRun ? 'YES (no writes)' : 'NO (will write to Firestore)'}`)
  console.log('─'.repeat(60))

  console.log('Scanning collection-group: flags')
  const flagsResult = await backfillCollectionGroup(db, 'flags', dryRun)
  console.log(`  scanned=${flagsResult.scanned} updated=${flagsResult.updated} skipped=${flagsResult.skipped}`)

  console.log('Scanning collection-group: ratings')
  const ratingsResult = await backfillCollectionGroup(db, 'ratings', dryRun)
  console.log(`  scanned=${ratingsResult.scanned} updated=${ratingsResult.updated} skipped=${ratingsResult.skipped}`)

  console.log('─'.repeat(60))
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

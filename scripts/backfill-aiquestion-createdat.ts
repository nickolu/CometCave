#!/usr/bin/env tsx
/**
 * Backfill `createdAt` on aiQuestions documents that predate the field.
 *
 * `saveAIQuestion` only began stamping `createdAt` in the May 2026 library
 * redesign. Without the field, Firestore's `orderBy('createdAt')` silently
 * excludes the doc — which is why the questions library returns empty
 * results for newest/oldest sorts on most categories.
 *
 * Doc IDs are `ai-infinite-<Date.now()>-<rand>`, so we recover the
 * timestamp from the id. Docs whose id doesn't match that shape (none
 * expected today, but e.g. hand-authored entries) are reported and
 * skipped so the operator can decide.
 *
 * Idempotent — docs that already have `createdAt` are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-aiquestion-createdat.ts
 *   npx tsx --env-file=.env.local scripts/backfill-aiquestion-createdat.ts --dry-run
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { Timestamp, WriteBatch, getFirestore } from 'firebase-admin/firestore'

const BATCH_SIZE = 400

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

const ID_TIMESTAMP_RE = /^ai-infinite-(\d{13})-/

function timestampFromDocId(id: string): Timestamp | null {
  const m = id.match(ID_TIMESTAMP_RE)
  if (!m) return null
  const ms = Number(m[1])
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Timestamp.fromMillis(ms)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  ensureApp()
  const db = getFirestore()

  console.log(`Fetching all aiQuestions documents${dryRun ? ' (dry run)' : ''}...`)
  const snap = await db.collection('aiQuestions').get()
  console.log(`Found ${snap.size} document(s).`)

  let batch: WriteBatch = db.batch()
  let batchCount = 0
  let updatedTotal = 0
  let skippedHasField = 0
  const unparsableIds: string[] = []

  for (const doc of snap.docs) {
    const data = doc.data()
    if ('createdAt' in data && data.createdAt != null) {
      skippedHasField++
      continue
    }

    const ts = timestampFromDocId(doc.id)
    if (!ts) {
      unparsableIds.push(doc.id)
      continue
    }

    if (dryRun) {
      updatedTotal++
      continue
    }

    batch.update(doc.ref, { createdAt: ts })
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

  if (!dryRun && batchCount > 0) {
    process.stdout.write(`Committing final batch of ${batchCount}...`)
    await batch.commit()
    console.log(' done.')
  }

  console.log('─'.repeat(60))
  console.log(
    `Updated: ${updatedTotal}  |  Already had createdAt: ${skippedHasField}  |  Unparsable id: ${unparsableIds.length}`
  )
  if (unparsableIds.length > 0) {
    console.log('\nUnparsable doc ids (skipped — set createdAt manually if you want them sortable):')
    for (const id of unparsableIds.slice(0, 20)) console.log(`  ${id}`)
    if (unparsableIds.length > 20) console.log(`  …and ${unparsableIds.length - 20} more`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

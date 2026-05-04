#!/usr/bin/env tsx
/**
 * Backfills the `isAnonymous` field on users/{uid} docs by inspecting
 * each Firebase Auth user's providerData. Anonymous users have an empty
 * providerData array; named (linked) users have one or more entries.
 *
 * Run this once after deploying the leaderboard filter so existing
 * anonymous players who never re-engage are still hidden.
 *
 * Idempotent: docs that already have the correct flag are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-user-anonymous-flag.ts [--dry-run]
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { type UserRecord, getAuth } from 'firebase-admin/auth'
import { FieldValue, type WriteBatch, getFirestore } from 'firebase-admin/firestore'

const BATCH_SIZE = 400
const PAGE_SIZE = 1000

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

async function* iterateAllAuthUsers(): AsyncGenerator<UserRecord> {
  const auth = getAuth()
  let pageToken: string | undefined
  do {
    const result = await auth.listUsers(PAGE_SIZE, pageToken)
    for (const u of result.users) yield u
    pageToken = result.pageToken
  } while (pageToken)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  ensureApp()
  const db = getFirestore()

  console.log(`Dry run: ${dryRun ? 'YES (no writes)' : 'NO (will write to Firestore)'}`)
  console.log('─'.repeat(60))

  let scanned = 0
  let anonymous = 0
  let named = 0
  let updated = 0
  let skipped = 0
  let missingDoc = 0

  let batch: WriteBatch = db.batch()
  let batchCount = 0

  for await (const user of iterateAllAuthUsers()) {
    scanned++
    const isAnonymous = user.providerData.length === 0
    if (isAnonymous) anonymous++
    else named++

    const ref = db.doc(`users/${user.uid}`)
    const snap = await ref.get()
    if (!snap.exists) {
      missingDoc++
      continue
    }

    const current = snap.data()?.isAnonymous
    if (current === isAnonymous) {
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`would set ${ref.path} isAnonymous=${isAnonymous} (was ${current})`)
      updated++
      continue
    }

    batch.set(
      ref,
      { isAnonymous, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )
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
  console.log(`Auth users scanned : ${scanned}`)
  console.log(`  anonymous        : ${anonymous}`)
  console.log(`  named            : ${named}`)
  console.log(`Firestore docs     :`)
  console.log(`  updated          : ${updated}`)
  console.log(`  already correct  : ${skipped}`)
  console.log(`  no user doc      : ${missingDoc}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

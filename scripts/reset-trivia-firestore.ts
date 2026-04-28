#!/usr/bin/env tsx
/**
 * One-shot reset of legacy trivia Firestore collections.
 *
 * Deletes every doc in `trivia-users` and `trivia-scores` (the pre-#522
 * schema). Run this BEFORE deploying the shared-identity rewrite. Safe to
 * re-run; idempotent. Drops the legacy `date ASC + score DESC` composite
 * index from the Firebase console after this completes.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... \
 *   FIREBASE_CLIENT_EMAIL=... \
 *   FIREBASE_PRIVATE_KEY=... \
 *   npm run reset-trivia-firestore
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'

const LEGACY_COLLECTIONS = ['trivia-users', 'trivia-scores']
const BATCH_SIZE = 400

function ensureApp(): void {
  if (getApps().length) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY'
    )
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

async function deleteCollection(db: Firestore, name: string): Promise<number> {
  let deleted = 0
  for (;;) {
    const snap = await db.collection(name).limit(BATCH_SIZE).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    deleted += snap.size
    process.stdout.write(`  ${name}: deleted ${deleted}\r`)
  }
  process.stdout.write('\n')
  return deleted
}

async function main() {
  ensureApp()
  const db = getFirestore()
  console.log('Resetting legacy trivia collections...')
  for (const name of LEGACY_COLLECTIONS) {
    const n = await deleteCollection(db, name)
    console.log(`  ${name}: ${n} docs deleted`)
  }
  console.log('Done. Drop the legacy `trivia-scores` composite index in the Firebase console.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

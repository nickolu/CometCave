#!/usr/bin/env tsx
/**
 * Mark every existing aiQuestions/* doc as "seen" for a single user.
 *
 * Used to test the on-demand generation fallback in Infinite Trivia without
 * deleting any prod data. After running this for your uid, the sampler will
 * find zero unseen questions for you and fall through to runtime generation
 * on every /next request — every question you see during the test will be
 * freshly minted by gpt-4o.
 *
 * Touches only `users/{uid}/seenQuestions/*`. Other users are unaffected.
 * Daily Trivia (static JSON + `triviaDaily/*`) is untouched.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-seen-questions.ts <UID>
 *
 *   # If you don't have a .env.local:
 *   FIREBASE_PROJECT_ID=... \
 *   FIREBASE_CLIENT_EMAIL=... \
 *   FIREBASE_PRIVATE_KEY=... \
 *   npx tsx scripts/seed-seen-questions.ts <UID>
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'

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

async function main() {
  const uid = process.argv[2]
  if (!uid) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/seed-seen-questions.ts <UID>')
    process.exit(1)
  }

  ensureApp()
  const db = getFirestore()

  console.log(`Reading aiQuestions...`)
  const snap = await db.collection('aiQuestions').get()
  const ids = snap.docs.map((d) => d.id)
  console.log(`  Found ${ids.length} questions`)

  if (ids.length === 0) {
    console.log('Nothing to seed. Either the pool is empty or rules block read.')
    return
  }

  const now = Timestamp.now()
  const seenCol = db.collection(`users/${uid}/seenQuestions`)

  let written = 0
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    for (const qid of chunk) {
      batch.set(seenCol.doc(qid), { at: now, correct: true })
    }
    await batch.commit()
    written += chunk.length
    process.stdout.write(`  seeded ${written}/${ids.length}\r`)
  }
  process.stdout.write('\n')
  console.log(`Done. ${written} seenQuestions docs written under users/${uid}/seenQuestions.`)
  console.log('Now play /trivia/infinite — every question will be freshly generated.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

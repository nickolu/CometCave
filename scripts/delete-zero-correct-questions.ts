#!/usr/bin/env tsx
/**
 * Deletes aiQuestions where timesCorrect === 0, along with their
 * subcollections (flags, ratings, answeredBy).
 *
 * Defaults to DRY-RUN — prints what would be deleted and aborts.
 * Pass --apply to actually delete.
 *
 * By default, deletes ALL questions with timesCorrect === 0 (matches
 * the literal request). Pass --shown-only to only delete questions
 * that have been shown at least once (timesShown > 0) — preserves
 * brand-new questions that haven't had a chance yet.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/delete-zero-correct-questions.ts
 *   npx tsx --env-file=.env.local scripts/delete-zero-correct-questions.ts --shown-only
 *   npx tsx --env-file=.env.local scripts/delete-zero-correct-questions.ts --apply
 *   npx tsx --env-file=.env.local scripts/delete-zero-correct-questions.ts --shown-only --apply
 *
 * Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

interface Args {
  apply: boolean
  shownOnly: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let apply = false
  let shownOnly = false
  for (const a of args) {
    if (a === '--apply') apply = true
    else if (a === '--shown-only') shownOnly = true
    else {
      console.error(`Unknown arg: ${a}`)
      process.exit(1)
    }
  }
  return { apply, shownOnly }
}

async function main() {
  const { apply, shownOnly } = parseArgs()
  ensureApp()
  const db = getFirestore()

  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY RUN (no writes)'}`)
  console.log(`Scope: timesCorrect === 0${shownOnly ? ' AND timesShown > 0' : ' (includes never-shown)'}`)
  console.log('─'.repeat(60))

  console.log('Fetching aiQuestions with timesCorrect === 0...')
  const snap = await db
    .collection('aiQuestions')
    .where('timesCorrect', '==', 0)
    .get()

  const matches = snap.docs.filter((doc) => {
    if (!shownOnly) return true
    return (doc.data().timesShown ?? 0) > 0
  })

  // Stats breakdown
  let neverShown = 0
  let shownAndMissed = 0
  let alreadyFlagged = 0
  let alreadyRemoved = 0
  for (const doc of matches) {
    const d = doc.data()
    const timesShown = d.timesShown ?? 0
    if (timesShown === 0) neverShown++
    else shownAndMissed++
    if (d.status === 'flagged') alreadyFlagged++
    else if (d.status === 'removed') alreadyRemoved++
  }

  console.log(`Total matched:           ${matches.length}`)
  console.log(`  Never shown (timesShown=0): ${neverShown}`)
  console.log(`  Shown but always missed:    ${shownAndMissed}`)
  console.log(`  Status='flagged':           ${alreadyFlagged}`)
  console.log(`  Status='removed':           ${alreadyRemoved}`)
  console.log('─'.repeat(60))

  if (matches.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  // Show first few for sanity check
  console.log('Sample (first 10):')
  for (const doc of matches.slice(0, 10)) {
    const d = doc.data()
    console.log(`  ${doc.id}  shown=${d.timesShown ?? 0}  status=${d.status ?? '?'}  cat="${d.category ?? '?'}"`)
    console.log(`    Q: ${(d.question ?? '').slice(0, 100)}${(d.question ?? '').length > 100 ? '...' : ''}`)
  }
  console.log('─'.repeat(60))

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to actually delete.')
    return
  }

  console.log('Deleting (with subcollections via recursiveDelete)...')
  let deleted = 0
  let failed = 0
  for (const doc of matches) {
    try {
      // recursiveDelete cleans up flags/, ratings/, answeredBy/ subcollections.
      await db.recursiveDelete(doc.ref)
      deleted++
      if (deleted % 25 === 0) {
        console.log(`  ...${deleted}/${matches.length}`)
      }
    } catch (err) {
      failed++
      console.error(`  FAILED ${doc.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('─'.repeat(60))
  console.log(`Deleted: ${deleted}`)
  console.log(`Failed:  ${failed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

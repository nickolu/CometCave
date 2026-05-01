#!/usr/bin/env tsx
/**
 * Read-only audit of question flagging.
 *
 * Reports:
 *   - Total aiQuestions docs
 *   - Total flag docs (collection group sum)
 *   - Unique questions with at least one flag doc
 *   - Questions with status === 'flagged' that have NO flag docs
 *     (a possible bug — would mean status got set without a flag landing)
 *
 * The flags subcollection is the source of truth for flag count;
 * flaggedCount as a denormalized field has been removed.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-flag-counts.ts
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

async function main() {
  ensureApp()
  const db = getFirestore()

  console.log('Reading aiQuestions...')
  const qSnap = await db.collection('aiQuestions').get()
  const totalQuestions = qSnap.size
  const flaggedStatusIds = new Set<string>(
    qSnap.docs.filter((d) => d.data().status === 'flagged').map((d) => d.id)
  )

  console.log('Reading flags collection group...')
  const flagsSnap = await db.collectionGroup('flags').get()

  const flagCountByQuestion = new Map<string, number>()
  for (const doc of flagsSnap.docs) {
    const parent = doc.ref.parent.parent
    if (!parent) continue
    if (parent.parent.id !== 'aiQuestions') continue
    const qid = parent.id
    flagCountByQuestion.set(qid, (flagCountByQuestion.get(qid) ?? 0) + 1)
  }

  const totalFlagDocs = flagsSnap.docs.length
  const questionsWithFlags = [...flagCountByQuestion.keys()]

  // Status === 'flagged' but no flag docs: would mean the status got set
  // without a corresponding flag write — a real bug.
  const flaggedWithoutDocs = [...flaggedStatusIds].filter((id) => !flagCountByQuestion.has(id))

  console.log('─'.repeat(60))
  console.log(`aiQuestions docs:               ${totalQuestions}`)
  console.log(`status === 'flagged':           ${flaggedStatusIds.size}`)
  console.log(`Total flag docs:                ${totalFlagDocs}`)
  console.log(`Unique questions with flags:    ${questionsWithFlags.length}`)
  console.log('─'.repeat(60))
  console.log(`Status='flagged' but no flag docs: ${flaggedWithoutDocs.length}`)
  if (flaggedWithoutDocs.length > 0) {
    console.log('  (first 20):')
    for (const id of flaggedWithoutDocs.slice(0, 20)) {
      console.log(`    ${id}`)
    }
  }

  if (questionsWithFlags.length > 0) {
    console.log('\nFlag distribution (top 10 by flag count):')
    const sorted = [...flagCountByQuestion.entries()].sort((a, b) => b[1] - a[1])
    for (const [qid, count] of sorted.slice(0, 10)) {
      console.log(`  ${qid}  flags=${count}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

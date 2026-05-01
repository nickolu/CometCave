#!/usr/bin/env tsx
/**
 * Lists all aiQuestions with status === 'flagged'.
 *
 * Usage:
 *   npx tsx scripts/list-flagged-questions.ts
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

  console.log('Querying flagged aiQuestions...')
  const snap = await db.collection('aiQuestions').where('status', '==', 'flagged').get()
  console.log(`Found ${snap.size} flagged question(s).\n`)

  if (snap.size === 0) {
    console.log('No flagged questions.')
    return
  }

  for (const doc of snap.docs) {
    const data = doc.data()
    console.log('─'.repeat(60))
    console.log(`ID:           ${doc.id}`)
    console.log(`Question:     ${data.question}`)
    console.log(`Category:     ${data.category}`)
    console.log(`Difficulty:   ${data.difficulty}`)

    // Fetch flag subcollection (the source of truth for flag count)
    const flagsSnap = await db.collection(`aiQuestions/${doc.id}/flags`).get()
    console.log(`Flag count:   ${flagsSnap.size}`)
    if (flagsSnap.size > 0) {
      console.log('Flags:')
      for (const flagDoc of flagsSnap.docs) {
        const f = flagDoc.data()
        const at = f.flaggedAt?.toDate?.()?.toISOString() ?? 'unknown'
        const noteStr = f.note ? ` | note: "${f.note}"` : ''
        console.log(`  - uid=${flagDoc.id} reason=${f.reason}${noteStr} at=${at}`)
      }
    } else {
      console.log('Flags:        (none in subcollection)')
    }
  }
  console.log('─'.repeat(60))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

#!/usr/bin/env tsx
/**
 * Generation rate-limit telemetry report for issue #626.
 *
 * Queries Firestore for the past N days (default 7) and reports:
 * - Total unique UIDs with generation limit docs
 * - Histogram of generations-per-uid (quantiles: p50, p90, p95, p99, max)
 * - UIDs that hit the limit ceiling (count >= MAX_GENERATIONS_PER_WINDOW)
 * - Total generations across all users
 *
 * Usage:
 *   npx tsx scripts/trivia/generation-limit-stats.ts [--days 7]
 *
 * Required env vars (same as the app):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// NOTE: keep this in sync with src/lib/trivia/generationLimit.ts
const MAX_GENERATIONS_PER_WINDOW = 100

function ensureApp() {
  if (getApps().length > 0) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY')
    process.exit(1)
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function main() {
  const daysArg = process.argv.includes('--days')
    ? parseInt(process.argv[process.argv.indexOf('--days') + 1], 10)
    : 7
  const days = isNaN(daysArg) || daysArg < 1 ? 7 : daysArg

  ensureApp()
  const db = getFirestore()

  console.log(`\n📊 Generation Rate-Limit Stats (past ${days} days)\n`)
  console.log('='.repeat(50))

  // Query all generationLimit docs via collection group
  const limitSnaps = await db.collectionGroup('triviaInfiniteMeta').get()

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const counts: number[] = []
  const throttledUids: string[] = []
  let totalGenerations = 0
  let activeUids = 0

  for (const doc of limitSnaps.docs) {
    if (doc.id !== 'generationLimit') continue

    const data = doc.data()
    const windowStart: number = data?.windowStart?.toMillis?.() ?? 0
    const count: number = data?.count ?? 0

    // Only consider docs within the time window
    if (windowStart < cutoff) continue

    activeUids++
    counts.push(count)
    totalGenerations += count

    if (count >= MAX_GENERATIONS_PER_WINDOW) {
      const uid = doc.ref.parent.parent?.id ?? 'unknown'
      throttledUids.push(uid)
    }
  }

  if (counts.length === 0) {
    console.log('\nNo generation limit data found in the specified window.')
    console.log('This is expected if Infinite Trivia has not had traffic yet.')
    return
  }

  counts.sort((a, b) => a - b)

  console.log(`\n🔢 Summary`)
  console.log(`  Active UIDs with generation data: ${activeUids}`)
  console.log(`  Total generations: ${totalGenerations}`)
  console.log(`  Avg generations/uid: ${(totalGenerations / activeUids).toFixed(1)}`)

  console.log(`\n📈 Generations per UID (quantiles)`)
  console.log(`  p50: ${percentile(counts, 50)}`)
  console.log(`  p90: ${percentile(counts, 90)}`)
  console.log(`  p95: ${percentile(counts, 95)}`)
  console.log(`  p99: ${percentile(counts, 99)}`)
  console.log(`  max: ${counts[counts.length - 1]}`)

  console.log(`\n🚫 Throttled UIDs (hit ${MAX_GENERATIONS_PER_WINDOW}/window ceiling)`)
  if (throttledUids.length === 0) {
    console.log('  None — no users have hit the rate limit.')
  } else {
    console.log(`  ${throttledUids.length} unique UIDs hit the limit:`)
    // Anonymize UIDs by showing first 8 chars
    for (const uid of throttledUids) {
      console.log(`    ${uid.slice(0, 8)}...`)
    }
    console.log(`  Throttle rate: ${((throttledUids.length / activeUids) * 100).toFixed(1)}% of active UIDs`)
  }

  console.log(`\n💡 Recommendation thresholds`)
  console.log(`  If throttle rate > 5%: consider raising to 60/hr`)
  console.log(`  If throttle rate < 1%: current limit is fine`)
  console.log(`  If total daily spend > $X: consider adding global cap`)
  console.log('')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})

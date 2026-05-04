#!/usr/bin/env tsx
/**
 * Read-only audit of the aiQuestions pool composition. Reports:
 *   - Counts by (status, difficulty)
 *   - Active-pool difficulty mix as percentages, with deltas vs the
 *     target 4:2:1 (~57% / ~29% / ~14%)
 *   - Per-category active-pool difficulty mix (so we can see if some
 *     categories are heavy on hard while others are heavy on easy)
 *
 * Useful right after a difficulty-policy change to see whether the
 * existing pool still skews toward the old distribution and whether
 * `yarn retire-active-trivia` is worth running.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-question-mix.ts
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

type Difficulty = 'easy' | 'medium' | 'hard' | 'unknown'
type Status = 'active' | 'legacy' | 'flagged' | 'removed' | 'unknown'

const TARGETS: Record<Exclude<Difficulty, 'unknown'>, number> = {
  easy: 4 / 7,
  medium: 2 / 7,
  hard: 1 / 7,
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((n * 100) / total).toFixed(1)}%`
}

function delta(actualFrac: number, targetFrac: number): string {
  const d = (actualFrac - targetFrac) * 100
  if (Math.abs(d) < 0.5) return '   (=)'
  const sign = d > 0 ? '+' : ''
  return `   (${sign}${d.toFixed(1)}pp)`
}

async function main() {
  ensureApp()
  const db = getFirestore()

  console.log('Scanning aiQuestions collection (this is one full read pass)...')
  const snap = await db.collection('aiQuestions').get()
  console.log(`Total documents: ${snap.size}\n`)

  const byStatusDifficulty = new Map<string, number>()
  const activeByCategoryDifficulty = new Map<string, Map<Difficulty, number>>()

  for (const doc of snap.docs) {
    const data = doc.data() as {
      status?: string
      difficulty?: string
      category?: string
    }
    const status = (data.status as Status) ?? 'unknown'
    const difficulty = (data.difficulty as Difficulty) ?? 'unknown'
    const key = `${status}|${difficulty}`
    byStatusDifficulty.set(key, (byStatusDifficulty.get(key) ?? 0) + 1)

    if (status === 'active') {
      const cat = data.category ?? 'unknown'
      if (!activeByCategoryDifficulty.has(cat)) {
        activeByCategoryDifficulty.set(cat, new Map())
      }
      const cm = activeByCategoryDifficulty.get(cat)!
      cm.set(difficulty, (cm.get(difficulty) ?? 0) + 1)
    }
  }

  // Status × difficulty matrix
  console.log('Counts by (status, difficulty):')
  console.log('─'.repeat(60))
  const statuses: Status[] = ['active', 'legacy', 'flagged', 'removed', 'unknown']
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'unknown']
  console.log(
    `  ${'status'.padEnd(10)} ${difficulties.map((d) => d.padStart(8)).join(' ')}   total`
  )
  for (const s of statuses) {
    const row: number[] = []
    let rowTotal = 0
    for (const d of difficulties) {
      const c = byStatusDifficulty.get(`${s}|${d}`) ?? 0
      row.push(c)
      rowTotal += c
    }
    if (rowTotal === 0) continue
    console.log(
      `  ${s.padEnd(10)} ${row.map((c) => String(c).padStart(8)).join(' ')}   ${rowTotal}`
    )
  }

  // Active pool difficulty mix
  console.log('\nActive pool difficulty mix vs target 4:2:1:')
  console.log('─'.repeat(60))
  const activeTotal = (['easy', 'medium', 'hard'] as const).reduce(
    (sum, d) => sum + (byStatusDifficulty.get(`active|${d}`) ?? 0),
    0
  )
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const count = byStatusDifficulty.get(`active|${d}`) ?? 0
    const actualFrac = activeTotal === 0 ? 0 : count / activeTotal
    const targetFrac = TARGETS[d]
    console.log(
      `  ${d.padEnd(7)}: ${String(count).padStart(5)}   ${pct(count, activeTotal).padStart(6)}   target ${(targetFrac * 100).toFixed(1)}%${delta(actualFrac, targetFrac)}`
    )
  }
  console.log(`  ${'total'.padEnd(7)}: ${String(activeTotal).padStart(5)}`)

  // Per-category active mix (sorted by hard% — categories most over-skewed
  // to hard show up at the top)
  console.log('\nActive pool by category (sorted by hard% descending):')
  console.log('─'.repeat(74))
  console.log(`  ${'category'.padEnd(26)} ${'easy'.padStart(8)} ${'medium'.padStart(8)} ${'hard'.padStart(8)}   total   hard%`)
  const catRows = [...activeByCategoryDifficulty.entries()].map(([cat, cm]) => {
    const e = cm.get('easy') ?? 0
    const m = cm.get('medium') ?? 0
    const h = cm.get('hard') ?? 0
    const total = e + m + h
    return { cat, e, m, h, total, hardPct: total === 0 ? 0 : (h * 100) / total }
  })
  catRows.sort((a, b) => b.hardPct - a.hardPct)
  for (const row of catRows) {
    console.log(
      `  ${row.cat.padEnd(26)} ${String(row.e).padStart(8)} ${String(row.m).padStart(8)} ${String(row.h).padStart(8)}   ${String(row.total).padStart(5)}   ${row.hardPct.toFixed(1)}%`
    )
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})

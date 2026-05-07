#!/usr/bin/env tsx
/**
 * Retires aiQuestions flagged by a DB-eval run (e.g. concision_score === 1)
 * by flipping their status to 'legacy'. Same semantics as retire-active-trivia:
 * kept for analytics, excluded from sampling. Player history is preserved
 * (use scripts/remove-ai-question.ts if you also want to undo player stats).
 *
 * Idempotent: skips docs that are already 'legacy' or 'removed'. Skips
 * 'flagged' too (admin signal we shouldn't overwrite without explicit intent).
 *
 * Reads from evals/db-runs/latest.json by default. Dry-run by default;
 * --confirm commits the writes.
 *
 * Usage:
 *   yarn tsx --env-file=.env.local scripts/retire-by-eval.ts
 *   yarn tsx --env-file=.env.local scripts/retire-by-eval.ts --confirm
 *   yarn tsx --env-file=.env.local scripts/retire-by-eval.ts --filter=concision-1 --confirm
 *   yarn tsx --env-file=.env.local scripts/retire-by-eval.ts --input=evals/db-runs/2026-05-07T07-15-34-128Z.json
 */

import fs from 'node:fs'
import path from 'node:path'

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type WriteBatch } from 'firebase-admin/firestore'

const BATCH_SIZE = 400

type FilterKind = 'concision-1' | 'any-1' | 'concision-le-2'

interface Args {
  inputPath: string
  filter: FilterKind
  confirm: boolean
}

function parseArgs(): Args {
  const out: Args = {
    inputPath: 'evals/db-runs/latest.json',
    filter: 'concision-1',
    confirm: false,
  }
  for (const arg of process.argv.slice(2)) {
    if (arg === '--confirm') {
      out.confirm = true
    } else if (arg.startsWith('--input=')) {
      out.inputPath = arg.slice('--input='.length)
    } else if (arg.startsWith('--filter=')) {
      const v = arg.slice('--filter='.length)
      if (v !== 'concision-1' && v !== 'any-1' && v !== 'concision-le-2') {
        console.error(`Unknown --filter value: ${v}. Use concision-1, any-1, or concision-le-2.`)
        process.exit(2)
      }
      out.filter = v
    } else {
      console.error(`Unknown arg: ${arg}`)
      process.exit(2)
    }
  }
  return out
}

interface EvalRow {
  id: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  status: string
  question: string
  correctAnswer: string
  verdict: {
    factual_score: number
    factual_rationale: string
    difficulty_score: number
    difficulty_rationale: string
    concision_score: number
    concision_rationale: string
    ship: boolean
  }
  error?: string
}

interface EvalReport {
  timestamp: string
  rows: EvalRow[]
}

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

function matchesFilter(row: EvalRow, filter: FilterKind): boolean {
  if (row.error) return false
  const v = row.verdict
  switch (filter) {
    case 'concision-1':
      return v.concision_score === 1
    case 'any-1':
      return v.factual_score === 1 || v.difficulty_score === 1 || v.concision_score === 1
    case 'concision-le-2':
      return v.concision_score <= 2
  }
}

async function main() {
  const args = parseArgs()
  const inputPath = path.resolve(process.cwd(), args.inputPath)
  if (!fs.existsSync(inputPath)) {
    console.error(`ERROR: input file not found: ${inputPath}`)
    process.exit(1)
  }
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as EvalReport
  console.log(`Loaded ${report.rows.length} rows from ${inputPath}`)
  console.log(`Eval timestamp: ${report.timestamp}`)
  console.log(`Filter: ${args.filter}`)
  console.log()

  const matched = report.rows.filter((r) => matchesFilter(r, args.filter))
  console.log(`Matched ${matched.length} questions for retirement.`)
  console.log()

  if (matched.length === 0) {
    console.log('Nothing to do.')
    return
  }

  // Show breakdown by category + difficulty so the user can sanity-check.
  const byCat = new Map<string, number>()
  const byDiff = new Map<string, number>()
  for (const r of matched) {
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1)
    byDiff.set(r.difficulty, (byDiff.get(r.difficulty) ?? 0) + 1)
  }
  console.log('Breakdown by difficulty:')
  for (const d of ['easy', 'medium', 'hard']) {
    console.log(`  ${d.padEnd(8)}: ${byDiff.get(d) ?? 0}`)
  }
  console.log()
  console.log('Breakdown by category (top 10 by count):')
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [cat, n] of cats) {
    console.log(`  ${cat.padEnd(40)}: ${n}`)
  }
  console.log()

  if (!args.confirm) {
    console.log('DRY-RUN: pass --confirm to actually flip status → legacy.')
    console.log()
    console.log('Sample of IDs that would be retired (first 10):')
    for (const r of matched.slice(0, 10)) {
      console.log(`  ${r.id}  [${r.difficulty}/${r.category}]`)
      console.log(`    Q: ${r.question.slice(0, 100)}${r.question.length > 100 ? '…' : ''}`)
      console.log(`    A: ${r.correctAnswer.slice(0, 60)}`)
    }
    return
  }

  ensureApp()
  const db = getFirestore()

  console.log('Reading current statuses (skip-if-already-retired pass)…')
  const ids = matched.map((r) => r.id)
  const toFlip: string[] = []
  const skipReasons = new Map<string, number>()

  // Firestore getAll caps at ~500 per call; chunk.
  const READ_CHUNK = 100
  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK)
    const refs = chunk.map((id) => db.doc(`aiQuestions/${id}`))
    const docs = await db.getAll(...refs)
    for (const doc of docs) {
      if (!doc.exists) {
        skipReasons.set('not-found', (skipReasons.get('not-found') ?? 0) + 1)
        continue
      }
      const status = (doc.data() as { status?: string }).status ?? 'active'
      if (status === 'active') {
        toFlip.push(doc.id)
      } else {
        skipReasons.set(`already-${status}`, (skipReasons.get(`already-${status}`) ?? 0) + 1)
      }
    }
  }

  console.log(`To flip: ${toFlip.length}`)
  for (const [reason, n] of skipReasons) {
    console.log(`  skipped (${reason}): ${n}`)
  }
  console.log()

  if (toFlip.length === 0) {
    console.log('Nothing to flip.')
    return
  }

  console.log('Committing batches…')
  let batch: WriteBatch = db.batch()
  let inBatch = 0
  let flippedTotal = 0
  for (const id of toFlip) {
    batch.update(db.doc(`aiQuestions/${id}`), { status: 'legacy' })
    inBatch++
    flippedTotal++
    if (inBatch >= BATCH_SIZE) {
      process.stdout.write(`  batch of ${inBatch}…`)
      await batch.commit()
      console.log(' done.')
      batch = db.batch()
      inBatch = 0
    }
  }
  if (inBatch > 0) {
    process.stdout.write(`  final batch of ${inBatch}…`)
    await batch.commit()
    console.log(' done.')
  }

  console.log('─'.repeat(60))
  console.log(`Flipped ${flippedTotal} active → legacy.`)
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})

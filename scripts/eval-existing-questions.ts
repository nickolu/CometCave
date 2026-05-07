#!/usr/bin/env tsx
/**
 * Reads aiQuestions from Firestore and runs the (split) judge over each.
 * Writes a JSON report under evals/db-runs/ and prints a scorecard.
 *
 * Differs from eval-trivia.ts in that it does NOT generate fresh questions —
 * it judges what's already in the DB, so we can answer "how concise is the
 * pool we've already shipped?" without burning generation budget.
 *
 * Cost: ~3 LLM calls per question (factual + difficulty + concision), each
 * ~600 input + ~80 output tokens. With gpt-4o that's ~$0.007/question.
 *
 * Usage:
 *   yarn tsx --env-file=.env.local scripts/eval-existing-questions.ts --dry-run
 *   yarn tsx --env-file=.env.local scripts/eval-existing-questions.ts --limit=20
 *   yarn tsx --env-file=.env.local scripts/eval-existing-questions.ts --status=active,flagged
 *   yarn tsx --env-file=.env.local scripts/eval-existing-questions.ts
 */

import fs from 'node:fs'
import path from 'node:path'

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import { computeCost, formatUsd } from './eval/cost'
import { JUDGE_MODEL_ID, judgeQuestion, type Verdict } from './eval/judge'
import {
  type UsageEvent,
  withUsageRecording,
} from '../src/lib/trivia/usageRecorder'

type Status = 'active' | 'flagged' | 'removed' | 'legacy'
type Difficulty = 'easy' | 'medium' | 'hard'

interface Args {
  dryRun: boolean
  limit: number | null
  statuses: Status[]
  concurrency: number
  outDir: string
}

function parseArgs(): Args {
  const out: Args = {
    dryRun: false,
    limit: null,
    statuses: ['active', 'flagged', 'legacy'],
    concurrency: 8,
    outDir: 'evals/db-runs',
  }
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') {
      out.dryRun = true
    } else if (arg.startsWith('--limit=')) {
      out.limit = parseInt(arg.slice('--limit='.length), 10)
    } else if (arg.startsWith('--status=')) {
      out.statuses = arg.slice('--status='.length).split(',') as Status[]
    } else if (arg.startsWith('--concurrency=')) {
      out.concurrency = parseInt(arg.slice('--concurrency='.length), 10)
    } else {
      console.error(`Unknown arg: ${arg}`)
      process.exit(2)
    }
  }
  return out
}

function ensureFirebase() {
  if (getApps().length > 0) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    console.error('ERROR: Missing Firebase env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).')
    process.exit(1)
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

interface DbQuestion {
  id: string
  question: string
  correctAnswer: string
  explanation: string
  category: string
  difficulty: Difficulty
  status: Status
  appVersion?: string
  sourceUrl?: string
}

async function loadQuestions(args: Args): Promise<DbQuestion[]> {
  const db = getFirestore()
  const snap = await db.collection('aiQuestions').get()
  const out: DbQuestion[] = []
  for (const doc of snap.docs) {
    const d = doc.data() as {
      question?: string
      correctAnswer?: string
      explanation?: string
      category?: string
      difficulty?: string
      status?: string
      appVersion?: string
      sourceUrl?: string
    }
    const status = (d.status as Status) ?? 'active'
    if (!args.statuses.includes(status)) continue
    if (
      typeof d.question !== 'string' ||
      typeof d.correctAnswer !== 'string' ||
      typeof d.category !== 'string' ||
      (d.difficulty !== 'easy' && d.difficulty !== 'medium' && d.difficulty !== 'hard')
    ) {
      continue
    }
    out.push({
      id: doc.id,
      question: d.question,
      correctAnswer: d.correctAnswer,
      explanation: d.explanation ?? '',
      category: d.category,
      difficulty: d.difficulty,
      status,
      appVersion: d.appVersion,
      sourceUrl: d.sourceUrl,
    })
  }
  // Stable order so --limit returns a deterministic prefix.
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

interface JudgedRow {
  id: string
  category: string
  difficulty: Difficulty
  status: Status
  question: string
  correctAnswer: string
  appVersion?: string
  sourceUrl?: string
  verdict: Verdict
  usageEvents: UsageEvent[]
  durationMs: number
  error?: string
}

async function runJudges(
  questions: DbQuestion[],
  concurrency: number
): Promise<JudgedRow[]> {
  const results: JudgedRow[] = new Array(questions.length)
  let cursor = 0
  let done = 0
  const total = questions.length

  async function worker() {
    while (true) {
      const idx = cursor++
      if (idx >= total) return
      const q = questions[idx]
      const events: UsageEvent[] = []
      const start = Date.now()
      try {
        const verdict = await withUsageRecording(events, () =>
          judgeQuestion({
            question: q.question,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            category: q.category,
            difficulty: q.difficulty,
            sourceUrl: q.sourceUrl,
          })
        )
        results[idx] = {
          id: q.id,
          category: q.category,
          difficulty: q.difficulty,
          status: q.status,
          question: q.question,
          correctAnswer: q.correctAnswer,
          appVersion: q.appVersion,
          sourceUrl: q.sourceUrl,
          verdict,
          usageEvents: events,
          durationMs: Date.now() - start,
        }
      } catch (err) {
        results[idx] = {
          id: q.id,
          category: q.category,
          difficulty: q.difficulty,
          status: q.status,
          question: q.question,
          correctAnswer: q.correctAnswer,
          appVersion: q.appVersion,
          sourceUrl: q.sourceUrl,
          // Stub a verdict so downstream code is happy; we filter on `error` for stats.
          verdict: {
            factual_score: 0,
            factual_rationale: 'judge failed',
            difficulty_score: 0,
            difficulty_rationale: 'judge failed',
            concision_score: 0,
            concision_rationale: 'judge failed',
            ship: false,
          },
          usageEvents: events,
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        }
      }
      done++
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`  judged ${done}/${total}\n`)
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

interface Summary {
  scored: number
  shipPct: number
  factualMean: number
  difficultyMean: number
  concisionMean: number
  factualDist: { 1: number; 2: number; 3: number }
  difficultyDist: { 1: number; 2: number; 3: number }
  concisionDist: { 1: number; 2: number; 3: number }
}

function summarize(rows: JudgedRow[]): Summary {
  const scored = rows.filter((r) => !r.error)
  const f: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  const d: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  const c: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  let fSum = 0
  let dSum = 0
  let cSum = 0
  let ship = 0
  for (const r of scored) {
    const v = r.verdict
    f[v.factual_score as 1 | 2 | 3]++
    d[v.difficulty_score as 1 | 2 | 3]++
    c[v.concision_score as 1 | 2 | 3]++
    fSum += v.factual_score
    dSum += v.difficulty_score
    cSum += v.concision_score
    if (v.ship) ship++
  }
  const n = scored.length || 1
  return {
    scored: scored.length,
    shipPct: (ship * 100) / n,
    factualMean: fSum / n,
    difficultyMean: dSum / n,
    concisionMean: cSum / n,
    factualDist: f,
    difficultyDist: d,
    concisionDist: c,
  }
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '(n/a)'
  return `${((num * 100) / denom).toFixed(1)}%`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function printScorecard(rows: JudgedRow[], args: Args, totalUsd: number): void {
  const w = (s = '') => process.stdout.write(s + '\n')
  const failed = rows.filter((r) => r.error)
  const overall = summarize(rows)

  w()
  w('═══════════════════════════════════════════════════════════════')
  w(`  DB Question Eval — ${new Date().toISOString()}`)
  w('═══════════════════════════════════════════════════════════════')
  w(`  judge      : ${JUDGE_MODEL_ID}`)
  w(`  statuses   : ${args.statuses.join(', ')}`)
  w(`  concurrency: ${args.concurrency}`)
  w(`  attempted  : ${rows.length}`)
  w(`  judged     : ${overall.scored}`)
  w(`  judge-fail : ${failed.length}   ${pct(failed.length, rows.length)}`)
  w(`  cost       : ${formatUsd(totalUsd)}`)
  w()

  w('Quality (overall)')
  w(`  ship-worthy : ${overall.shipPct.toFixed(1)}%`)
  w(`  factual μ   : ${overall.factualMean.toFixed(2)}`)
  w(`  difficulty μ: ${overall.difficultyMean.toFixed(2)}`)
  w(`  concision μ : ${overall.concisionMean.toFixed(2)}`)
  w()

  w('Score distributions')
  w(`  factual    : 3=${overall.factualDist[3]}  2=${overall.factualDist[2]}  1=${overall.factualDist[1]}`)
  w(`  difficulty : 3=${overall.difficultyDist[3]}  2=${overall.difficultyDist[2]}  1=${overall.difficultyDist[1]}`)
  w(`  concision  : 3=${overall.concisionDist[3]}  2=${overall.concisionDist[2]}  1=${overall.concisionDist[1]}`)
  w()

  // By difficulty
  w('Quality by stated difficulty')
  for (const diff of ['easy', 'medium', 'hard'] as const) {
    const subset = rows.filter((r) => r.difficulty === diff)
    if (subset.length === 0) continue
    const s = summarize(subset)
    w(
      `  ${diff.padEnd(7)}: ship=${s.shipPct.toFixed(1)}%   f=${s.factualMean.toFixed(2)}  d=${s.difficultyMean.toFixed(2)}  c=${s.concisionMean.toFixed(2)}   (n=${s.scored})`
    )
  }
  w()

  // By category (sorted by ship% asc — worst first)
  const cats = new Map<string, JudgedRow[]>()
  for (const r of rows) {
    if (!cats.has(r.category)) cats.set(r.category, [])
    cats.get(r.category)!.push(r)
  }
  w('Ship-worthy by category (worst first)')
  const catSummaries = [...cats.entries()].map(([cat, rs]) => ({
    cat,
    s: summarize(rs),
  }))
  catSummaries.sort((a, b) => a.s.shipPct - b.s.shipPct)
  for (const { cat, s } of catSummaries) {
    w(
      `  ${cat.padEnd(26)}: ship=${s.shipPct.toFixed(1).padStart(5)}%   c=${s.concisionMean.toFixed(2)}   (n=${s.scored})`
    )
  }
  w()

  // Bottom 10 questions by combined score
  const judged = rows.filter((r) => !r.error)
  const worst = [...judged]
    .sort(
      (a, b) =>
        a.verdict.factual_score +
        a.verdict.difficulty_score +
        a.verdict.concision_score -
        (b.verdict.factual_score + b.verdict.difficulty_score + b.verdict.concision_score)
    )
    .slice(0, 10)
  if (worst.length) {
    w('Worst 10 questions (lowest combined score)')
    for (const r of worst) {
      const v = r.verdict
      w(`  [${r.difficulty}/${r.category}] f=${v.factual_score} d=${v.difficulty_score} c=${v.concision_score}  (${r.id})`)
      w(`     Q: ${truncate(r.question, 100)}`)
      w(`     A: ${truncate(r.correctAnswer, 60)}`)
      if (v.factual_score < 3) w(`     factual: ${truncate(v.factual_rationale, 100)}`)
      if (v.difficulty_score < 3) w(`     diff:    ${truncate(v.difficulty_rationale, 100)}`)
      if (v.concision_score < 3) w(`     concise: ${truncate(v.concision_rationale, 100)}`)
    }
    w()
  }

  // Bottom 10 by concision specifically (so the new dimension is easy to scan)
  const worstConcision = judged
    .filter((r) => r.verdict.concision_score < 3)
    .sort((a, b) => a.verdict.concision_score - b.verdict.concision_score)
    .slice(0, 10)
  if (worstConcision.length) {
    w('Worst 10 by concision (over-specified questions)')
    for (const r of worstConcision) {
      const v = r.verdict
      w(`  [${r.difficulty}/${r.category}] c=${v.concision_score}  (${r.id})`)
      w(`     Q: ${truncate(r.question, 100)}`)
      w(`     A: ${truncate(r.correctAnswer, 60)}`)
      w(`     concise: ${truncate(v.concision_rationale, 120)}`)
    }
    w()
  }

  if (failed.length) {
    w('Judge failures')
    for (const r of failed.slice(0, 5)) {
      w(`  [${r.id}] ${truncate(r.error ?? '', 140)}`)
    }
    if (failed.length > 5) w(`  …and ${failed.length - 5} more`)
    w()
  }
}

function persistRun(rows: JudgedRow[], args: Args, totalUsd: number): string {
  const dir = path.resolve(process.cwd(), args.outDir)
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(dir, `${stamp}.json`)
  const payload = {
    timestamp: new Date().toISOString(),
    judgeModel: JUDGE_MODEL_ID,
    config: args,
    totals: { attempted: rows.length, judged: rows.filter((r) => !r.error).length, failed: rows.filter((r) => r.error).length },
    cost: { totalUsd },
    rows: rows.map((r) => ({
      id: r.id,
      category: r.category,
      difficulty: r.difficulty,
      status: r.status,
      question: r.question,
      correctAnswer: r.correctAnswer,
      appVersion: r.appVersion,
      sourceUrl: r.sourceUrl,
      verdict: r.verdict,
      durationMs: r.durationMs,
      error: r.error,
    })),
  }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2))
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(payload, null, 2))
  return file
}

async function main() {
  const args = parseArgs()
  ensureFirebase()

  process.stdout.write(`Loading aiQuestions (statuses: ${args.statuses.join(', ')})…\n`)
  let questions = await loadQuestions(args)
  process.stdout.write(`  matched ${questions.length} questions\n`)
  if (args.limit !== null) {
    questions = questions.slice(0, args.limit)
    process.stdout.write(`  limited to ${questions.length}\n`)
  }

  // Cost estimate up front, regardless of dry-run.
  // Heuristic: 3 calls × ~600 input + ~80 output @ gpt-4o.
  const estPerQ = (1800 * 2.5 + 240 * 10) / 1_000_000
  const estTotal = estPerQ * questions.length
  process.stdout.write(
    `\nEstimated cost: ${formatUsd(estTotal)}  (~${formatUsd(estPerQ)}/question × ${questions.length})\n\n`
  )

  if (args.dryRun) {
    process.stdout.write('--dry-run: exiting without judging.\n')
    return
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not set.')
    process.exit(1)
  }

  process.stdout.write(`Judging with concurrency=${args.concurrency}…\n`)
  const t0 = Date.now()
  const rows = await runJudges(questions, args.concurrency)
  const totalMs = Date.now() - t0

  const allEvents = rows.flatMap((r) => r.usageEvents)
  const cost = computeCost(allEvents)

  printScorecard(rows, args, cost.totalUsd)

  const file = persistRun(rows, args, cost.totalUsd)
  process.stdout.write(`Wrote ${file}\n`)
  process.stdout.write(`Wall clock: ${(totalMs / 1000).toFixed(1)}s\n`)
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})

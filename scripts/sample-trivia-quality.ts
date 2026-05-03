#!/usr/bin/env tsx
/**
 * One-shot quality sampler. Generates a small grid of Infinite-pipeline
 * questions across difficulties + categories so we can eyeball whether
 * a prompt change regressed quality or difficulty calibration.
 *
 * NOT idempotent against prod Firestore: calls the same generation
 * path the live route does, including the duplicate-answer backstop
 * (which reads from prod). It does NOT save anything.
 *
 * Usage:
 *   yarn tsx --env-file=.env.local scripts/sample-trivia-quality.ts
 *   yarn tsx --env-file=.env.local scripts/sample-trivia-quality.ts \
 *     reps=3 categories=9,20,25
 */
import { readFileSync } from 'node:fs'

async function main() {
  // Load .env.local manually (the rest of scripts/ does this too;
  // staying consistent so the file works whether invoked via `yarn
  // tsx` directly or the existing tsx --env-file path).
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }

  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.split('=')
      return [k, v]
    })
  )
  const reps = args.reps ? parseInt(args.reps, 10) : 2
  const categoryIds = args.categories
    ? args.categories.split(',').map((s: string) => parseInt(s, 10))
    : [9, 20, 25] // general knowledge, mythology, art
  const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']

  const { generateInfiniteQuestion } = await import('../src/lib/trivia/generateQuestion')
  const { getOpenTDBCategoryName } = await import('../src/app/trivia/data/seeds')

  // Build the full job list, then run with bounded parallelism.
  // Bounded so we don't accidentally swamp Perplexity / Anthropic
  // rate limits while sampling.
  const PARALLELISM = 6
  type Job = { difficulty: 'easy' | 'medium' | 'hard'; categoryId: number; rep: number }
  const jobs: Job[] = []
  for (const difficulty of difficulties) {
    for (const categoryId of categoryIds) {
      for (let rep = 0; rep < reps; rep++) {
        jobs.push({ difficulty, categoryId, rep })
      }
    }
  }

  console.log(
    `Sampling ${jobs.length} questions: ${difficulties.length} difficulties × ${categoryIds.length} categories × ${reps} reps. Parallelism=${PARALLELISM}.`
  )
  console.log('─'.repeat(72))

  type Result = {
    job: Job
    question?: string
    answer?: string
    seed?: string
    sourceUrl?: string
    explanation?: string
    elapsedMs: number
    error?: string
  }

  const results: Result[] = new Array(jobs.length)
  let next = 0

  async function worker() {
    while (true) {
      const idx = next++
      if (idx >= jobs.length) return
      const job = jobs[idx]
      const t0 = Date.now()
      try {
        const q = await generateInfiniteQuestion({
          categoryId: job.categoryId,
          difficulty: job.difficulty,
        })
        results[idx] = {
          job,
          question: q.question,
          answer: q.correctAnswer,
          seed: q.seed,
          sourceUrl: q.sourceUrl,
          explanation: q.explanation,
          elapsedMs: Date.now() - t0,
        }
        process.stdout.write('.')
      } catch (err) {
        results[idx] = {
          job,
          elapsedMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        }
        process.stdout.write('x')
      }
    }
  }

  const t0 = Date.now()
  await Promise.all(Array.from({ length: PARALLELISM }, () => worker()))
  process.stdout.write('\n')
  const totalMs = Date.now() - t0

  // Group by difficulty for easy human comparison.
  const byDifficulty: Record<string, Result[]> = { easy: [], medium: [], hard: [] }
  for (const r of results) byDifficulty[r.job.difficulty].push(r)

  for (const difficulty of difficulties) {
    console.log(`\n=== ${difficulty.toUpperCase()} ===`)
    for (const r of byDifficulty[difficulty]) {
      const cat = getOpenTDBCategoryName(r.job.categoryId)
      if (r.error) {
        console.log(`[${cat}] FAILED in ${r.elapsedMs}ms: ${r.error}`)
        continue
      }
      console.log(`[${cat}] (${r.elapsedMs}ms)`)
      console.log(`  seed:   ${r.seed ?? '<none>'}`)
      console.log(`  Q:      ${r.question}`)
      console.log(`  A:      ${r.answer}`)
      if (r.sourceUrl) console.log(`  source: ${r.sourceUrl}`)
      if (r.explanation) console.log(`  expl:   ${r.explanation}`)
    }
  }

  // Quick aggregate signals.
  const ok = results.filter((r) => !r.error)
  const failed = results.filter((r) => r.error)
  const answers = ok.map((r) => (r.answer ?? '').toLowerCase().trim())
  const answerCounts = new Map<string, number>()
  for (const a of answers) answerCounts.set(a, (answerCounts.get(a) ?? 0) + 1)
  const dupes = [...answerCounts.entries()].filter(([, n]) => n > 1)

  const sources = ok.map((r) => {
    if (!r.sourceUrl) return null
    try {
      return new URL(r.sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  })
  const sourceCounts = new Map<string, number>()
  for (const s of sources) {
    if (!s) continue
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1)
  }
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  console.log('\n─'.repeat(72))
  console.log(`Summary: ${ok.length}/${results.length} succeeded in ${totalMs}ms wall clock.`)
  if (failed.length) {
    console.log(`Failed: ${failed.length}`)
    for (const r of failed) {
      console.log(`  - [${getOpenTDBCategoryName(r.job.categoryId)} ${r.job.difficulty}] ${r.error}`)
    }
  }
  if (dupes.length) {
    console.log('Duplicate answers in this batch:')
    for (const [a, n] of dupes) console.log(`  ${n}× "${a}"`)
  } else {
    console.log('No duplicate answers in this batch.')
  }
  if (topSources.length) {
    console.log('Top source domains:')
    for (const [s, n] of topSources) console.log(`  ${n}× ${s}`)
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})

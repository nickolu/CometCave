#!/usr/bin/env tsx
/**
 * Trivia generation eval harness.
 *
 * Replays the live generateInfiniteQuestion() pipeline against a curated
 * set of (category, difficulty) cells, then scores each generated
 * question with an OpenAI judge on two dimensions: factual accuracy and
 * difficulty calibration. Persists each run to evals/runs/, prints a
 * scorecard with deltas vs. the previous run.
 *
 * Workflow:
 *   make a change → npm run eval:trivia:smoke → check scorecard
 *   pre-merge → npm run eval:trivia → check scorecard
 *
 * Usage:
 *   npm run eval:trivia                    # full sweep (51 cells × 3 trials)
 *   npm run eval:trivia:smoke              # smoke (15 cells × 1 trial)
 *   npm run eval:trivia -- --trials 5      # override trial count
 *   npm run eval:trivia -- --concurrency 2 # gentler on rate limits
 *
 * Required env (loaded from .env.local via tsx --env-file):
 *   ANTHROPIC_API_KEY  — generation pipeline
 *   OPENAI_API_KEY     — judge
 *   PERPLEXITY_API_KEY — fact source (if Perplexity is the configured FactSource)
 *
 * Override the judge model with OPENAI_EVAL_MODEL=gpt-4.1 (default: gpt-4o).
 */

import { getGoldenCells } from './eval/golden-cells'
import { JUDGE_MODEL_ID } from './eval/judge'
import { runEval, type TrialResult } from './eval/runner'
import { loadPreviousRun, persistRun, printScorecard, summarize } from './eval/scorecard'

interface Args {
  smoke: boolean
  trialsOverride: number | null
  concurrency: number
  // When true, ship-eligible generations are persisted to the live
  // aiQuestions Firestore collection (same path the seeder uses, with
  // createdBy='system-eval'). Default off so experiment runs stay
  // clean — promoting an arm should not depend on whether the previous
  // arm seeded the duplicate-answer backstop with its own outputs.
  save: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let smoke = false
  let trialsOverride: number | null = null
  let concurrency = 4
  let save = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--smoke') smoke = true
    else if (a === '--trials' && args[i + 1]) {
      trialsOverride = parseInt(args[++i], 10)
    } else if (a === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[++i], 10)
    } else if (a === '--save') save = true
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: eval-trivia [--smoke] [--trials N] [--concurrency N] [--save]\n'
      )
      process.exit(0)
    }
  }

  return { smoke, trialsOverride, concurrency, save }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const cells = getGoldenCells(args.smoke)
  const trialsPerCell = args.trialsOverride ?? (args.smoke ? 1 : 3)
  const totalJobs = cells.length * trialsPerCell

  process.stdout.write(
    `\nRunning ${args.smoke ? 'SMOKE' : 'FULL'} eval: ${cells.length} cells × ${trialsPerCell} trials = ${totalJobs} generations (concurrency=${args.concurrency}${args.save ? ', SAVE ship-eligible to Firestore' : ''})\n`
  )
  process.stdout.write(`Judge model: ${JUDGE_MODEL_ID}\n\n`)

  const startedAt = Date.now()
  const results = await runEval({
    cells,
    trialsPerCell,
    concurrency: args.concurrency,
    save: args.save,
    onProgress: (done, total, latest) => {
      const tag = formatProgressTag(latest)
      process.stdout.write(
        `  [${String(done).padStart(3)}/${total}] ${tag}\n`
      )
    },
  })
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  process.stdout.write(`\nFinished ${results.length} jobs in ${elapsedSec}s\n`)
  if (args.save) {
    const saved = results.filter(
      (r) => r.outcome.kind === 'generated' && r.outcome.saved === true
    ).length
    const saveFails = results.filter(
      (r) => r.outcome.kind === 'generated' && r.outcome.saveError
    ).length
    process.stdout.write(
      `Saved ${saved} ship-eligible questions to Firestore${saveFails > 0 ? ` (${saveFails} save failures)` : ''}\n`
    )
  }

  const summary = summarize({
    results,
    cells,
    trialsPerCell,
    concurrency: args.concurrency,
    smoke: args.smoke,
    judgeModel: JUDGE_MODEL_ID,
  })

  const previous = loadPreviousRun()
  printScorecard(summary, previous)

  const { runPath } = persistRun(summary)
  process.stdout.write(`Wrote ${runPath}\n\n`)
}

function formatProgressTag(r: TrialResult): string {
  const cell = `${r.cell.categoryName}/${r.cell.difficulty}`
  if (r.outcome.kind === 'generation_failed') {
    return `${cell}  GEN-FAIL  ${truncate(r.outcome.error, 60)}`
  }
  if (r.outcome.kind === 'judge_failed') {
    return `${cell}  JUDGE-FAIL  ${truncate(r.outcome.error, 60)}`
  }
  const v = r.outcome.verdict
  const ship = r.outcome.saved
    ? 'SAVED'
    : r.outcome.saveError
      ? 'save-fail'
      : v.ship
        ? 'ship'
        : '----'
  return `${cell}  f=${v.factual_score} d=${v.difficulty_score} c=${v.concision_score} ${ship}  "${truncate(r.outcome.question, 50)}"`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

main().catch((err) => {
  process.stderr.write(`\nEval failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})

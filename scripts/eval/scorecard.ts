// Aggregates raw trial results into the printable scorecard, persists
// the run as JSON, and computes deltas vs. the previous run so a
// regression jumps out without manual diffing.

import fs from 'fs'
import path from 'path'

import { computeCost, formatUsd } from './cost'
import type { Difficulty, GoldenCell } from './golden-cells'
import type { TrialResult } from './runner'

export interface DimensionBreakdown {
  total: number
  scored: number
  score3: number
  score2: number
  score1: number
  shipPct: number
  factualMean: number
  difficultyMean: number
  concisionMean: number
}

export interface CostSummary {
  totalUsd: number
  perTrialUsd: number
  byStage: Record<string, number>
  byModel: Record<string, number>
  unknownModels: string[]
}

export interface RunSummary {
  timestamp: string
  appVersion: string | null
  judgeModel: string
  config: {
    cells: number
    trialsPerCell: number
    totalJobs: number
    concurrency: number
    smoke: boolean
  }
  totals: {
    generated: number
    generationFailed: number
    judgeFailed: number
  }
  cost: CostSummary
  overall: DimensionBreakdown
  byDifficulty: Record<Difficulty, DimensionBreakdown>
  byCategory: Record<string, DimensionBreakdown>
  // Bottom-N worst results, kept inline so a single JSON file is enough
  // to investigate regressions without re-running.
  worst: Array<{
    category: string
    difficulty: Difficulty
    question: string
    correctAnswer: string
    factualScore: number
    factualRationale: string
    difficultyScore: number
    difficultyRationale: string
    concisionScore: number
    concisionRationale: string
    sourceUrl?: string
  }>
  generationFailures: Array<{
    category: string
    difficulty: Difficulty
    error: string
  }>
}

const RUNS_DIR = path.resolve(process.cwd(), 'evals/runs')
const LATEST_PATH = path.join(RUNS_DIR, 'latest.json')

export function summarize(args: {
  results: TrialResult[]
  cells: GoldenCell[]
  trialsPerCell: number
  concurrency: number
  smoke: boolean
  judgeModel: string
}): RunSummary {
  const { results, cells, trialsPerCell, concurrency, smoke, judgeModel } = args

  const generated = results.filter((r) => r.outcome.kind === 'generated')
  const generationFailed = results.filter(
    (r) => r.outcome.kind === 'generation_failed'
  )
  const judgeFailed = results.filter((r) => r.outcome.kind === 'judge_failed')

  const overall = computeBreakdown(results)
  const byDifficulty: Record<Difficulty, DimensionBreakdown> = {
    easy: computeBreakdown(filterByDifficulty(results, 'easy')),
    medium: computeBreakdown(filterByDifficulty(results, 'medium')),
    hard: computeBreakdown(filterByDifficulty(results, 'hard')),
  }

  const categoryNames = Array.from(new Set(cells.map((c) => c.categoryName)))
  const byCategory: Record<string, DimensionBreakdown> = {}
  for (const name of categoryNames) {
    byCategory[name] = computeBreakdown(
      results.filter((r) => r.cell.categoryName === name)
    )
  }

  const worst = generated
    .filter((r) => r.outcome.kind === 'generated')
    .map((r) => {
      if (r.outcome.kind !== 'generated') throw new Error('unreachable')
      return {
        category: r.cell.categoryName,
        difficulty: r.cell.difficulty,
        question: r.outcome.question,
        correctAnswer: r.outcome.correctAnswer,
        factualScore: r.outcome.verdict.factual_score,
        factualRationale: r.outcome.verdict.factual_rationale,
        difficultyScore: r.outcome.verdict.difficulty_score,
        difficultyRationale: r.outcome.verdict.difficulty_rationale,
        concisionScore: r.outcome.verdict.concision_score,
        concisionRationale: r.outcome.verdict.concision_rationale,
        sourceUrl: r.outcome.sourceUrl,
      }
    })
    .sort(
      (a, b) =>
        a.factualScore +
        a.difficultyScore +
        a.concisionScore -
        (b.factualScore + b.difficultyScore + b.concisionScore)
    )
    .slice(0, 10)

  const generationFailures = generationFailed.map((r) => {
    if (r.outcome.kind !== 'generation_failed') throw new Error('unreachable')
    return {
      category: r.cell.categoryName,
      difficulty: r.cell.difficulty,
      error: r.outcome.error,
    }
  })

  const appVersion =
    generated
      .map((r) => (r.outcome.kind === 'generated' ? r.outcome.appVersion : null))
      .find((v): v is string => Boolean(v)) ?? null

  // Sum token-usage events across all trials. Failed trials still
  // contribute (a generation_failed trial can still have burned
  // construct + repair tokens before throwing) — important so cost
  // doesn't look artificially low when a run has many failures.
  const allEvents = results.flatMap((r) => r.usageEvents)
  const breakdown = computeCost(allEvents)
  const cost: CostSummary = {
    totalUsd: breakdown.totalUsd,
    perTrialUsd: results.length === 0 ? 0 : breakdown.totalUsd / results.length,
    byStage: breakdown.byStage,
    byModel: breakdown.byModel,
    unknownModels: breakdown.unknownModels,
  }

  return {
    timestamp: new Date().toISOString(),
    appVersion,
    judgeModel,
    config: {
      cells: cells.length,
      trialsPerCell,
      totalJobs: results.length,
      concurrency,
      smoke,
    },
    totals: {
      generated: generated.length,
      generationFailed: generationFailed.length,
      judgeFailed: judgeFailed.length,
    },
    cost,
    overall,
    byDifficulty,
    byCategory,
    worst,
    generationFailures,
  }
}

function filterByDifficulty(
  results: TrialResult[],
  difficulty: Difficulty
): TrialResult[] {
  return results.filter((r) => r.cell.difficulty === difficulty)
}

function computeBreakdown(results: TrialResult[]): DimensionBreakdown {
  const total = results.length
  const judged = results.filter((r) => r.outcome.kind === 'generated')
  const scored = judged.length

  let f3 = 0
  let f2 = 0
  let f1 = 0
  let d3 = 0
  let d2 = 0
  let d1 = 0
  let c3 = 0
  let c2 = 0
  let c1 = 0
  let ship = 0
  let factualSum = 0
  let difficultySum = 0
  let concisionSum = 0

  for (const r of judged) {
    if (r.outcome.kind !== 'generated') continue
    const v = r.outcome.verdict
    if (v.factual_score === 3) f3++
    else if (v.factual_score === 2) f2++
    else f1++
    if (v.difficulty_score === 3) d3++
    else if (v.difficulty_score === 2) d2++
    else d1++
    if (v.concision_score === 3) c3++
    else if (v.concision_score === 2) c2++
    else c1++
    if (v.ship) ship++
    factualSum += v.factual_score
    difficultySum += v.difficulty_score
    concisionSum += v.concision_score
  }

  return {
    total,
    scored,
    score3: f3 + d3 + c3, // not used directly but kept for completeness
    score2: f2 + d2 + c2,
    score1: f1 + d1 + c1,
    shipPct: scored === 0 ? 0 : (ship * 100) / scored,
    factualMean: scored === 0 ? 0 : factualSum / scored,
    difficultyMean: scored === 0 ? 0 : difficultySum / scored,
    concisionMean: scored === 0 ? 0 : concisionSum / scored,
  }
}

export function loadPreviousRun(): RunSummary | null {
  if (!fs.existsSync(LATEST_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(LATEST_PATH, 'utf-8')) as RunSummary
  } catch {
    return null
  }
}

export function persistRun(summary: RunSummary): { runPath: string; latestPath: string } {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  const stamp = summary.timestamp.replace(/[:.]/g, '-')
  const runPath = path.join(RUNS_DIR, `${stamp}.json`)
  const json = JSON.stringify(summary, null, 2)
  fs.writeFileSync(runPath, json)
  fs.writeFileSync(LATEST_PATH, json)
  return { runPath, latestPath: LATEST_PATH }
}

// ─────────────────────────────────────────────────────────────────────
// Pretty printing
// ─────────────────────────────────────────────────────────────────────

export function printScorecard(summary: RunSummary, previous: RunSummary | null): void {
  const w = (s: string) => process.stdout.write(s)
  const line = (s = '') => w(s + '\n')

  line('')
  line('═══════════════════════════════════════════════════════════════')
  line(`  Trivia Eval — ${summary.timestamp}`)
  line('═══════════════════════════════════════════════════════════════')
  line(`  appVersion : ${summary.appVersion ?? '(unknown)'}`)
  line(`  judge      : ${summary.judgeModel}`)
  line(
    `  config     : ${summary.config.cells} cells × ${summary.config.trialsPerCell} trials = ${summary.config.totalJobs} jobs (concurrency=${summary.config.concurrency}${summary.config.smoke ? ', smoke' : ''})`
  )
  if (previous) {
    line(`  vs prev    : ${previous.timestamp} (${previous.appVersion ?? '?'})`)
  } else {
    line(`  vs prev    : (no previous run)`)
  }
  line('')

  // Generation
  line('Generation')
  line(
    `  succeeded : ${summary.totals.generated}/${summary.config.totalJobs}   ${pct(summary.totals.generated, summary.config.totalJobs)}${delta(pct(summary.totals.generated, summary.config.totalJobs), previous && pct(previous.totals.generated, previous.config.totalJobs))}`
  )
  line(
    `  gen-fail  : ${summary.totals.generationFailed}   ${pct(summary.totals.generationFailed, summary.config.totalJobs)}`
  )
  line(
    `  judge-fail: ${summary.totals.judgeFailed}   ${pct(summary.totals.judgeFailed, summary.config.totalJobs)}`
  )
  line('')

  // Cost
  line('Cost (USD)')
  line(
    `  total       : ${formatUsd(summary.cost.totalUsd).padStart(7)}${deltaUsd(summary.cost.totalUsd, previous?.cost?.totalUsd)}`
  )
  line(
    `  per-trial   : ${formatUsd(summary.cost.perTrialUsd).padStart(7)}${deltaUsd(summary.cost.perTrialUsd, previous?.cost?.perTrialUsd)}`
  )
  if (Object.keys(summary.cost.byStage).length > 0) {
    const stages = Object.entries(summary.cost.byStage).sort((a, b) => b[1] - a[1])
    line('  by stage    :')
    for (const [stage, usd] of stages) {
      const prevUsd = previous?.cost?.byStage?.[stage]
      const sharePct = summary.cost.totalUsd === 0 ? 0 : (usd * 100) / summary.cost.totalUsd
      line(
        `    ${stage.padEnd(10)}: ${formatUsd(usd).padStart(7)}  (${sharePct.toFixed(0)}%)${deltaUsd(usd, prevUsd)}`
      )
    }
  }
  if (summary.cost.unknownModels.length > 0) {
    line(`  unpriced models : ${summary.cost.unknownModels.join(', ')} — add to MODEL_PRICING`)
  }
  line('')

  // Overall quality
  line('Quality (overall)')
  printDimensionRow('  ship-worthy : ', summary.overall.shipPct, previous?.overall.shipPct)
  printMeanRow('  factual μ   : ', summary.overall.factualMean, previous?.overall.factualMean)
  printMeanRow('  difficulty μ: ', summary.overall.difficultyMean, previous?.overall.difficultyMean)
  printMeanRow('  concision μ : ', summary.overall.concisionMean, previous?.overall.concisionMean)
  line('')

  // By difficulty
  line('Ship-worthy by difficulty')
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const cur = summary.byDifficulty[d]
    const prev = previous?.byDifficulty[d]
    line(
      `  ${d.padEnd(7)}: ${formatPct(cur.shipPct).padStart(7)}   (${cur.scored} scored)${delta(cur.shipPct, prev?.shipPct)}`
    )
  }
  line('')

  // By category — compact, sorted by ship%
  line('Ship-worthy by category (sorted)')
  const cats = Object.entries(summary.byCategory)
    .filter(([, v]) => v.scored > 0)
    .sort((a, b) => a[1].shipPct - b[1].shipPct)
  for (const [name, v] of cats) {
    const prev = previous?.byCategory[name]
    line(
      `  ${name.padEnd(24)}: ${formatPct(v.shipPct).padStart(7)}   (${v.scored} scored)${delta(v.shipPct, prev?.shipPct)}`
    )
  }
  line('')

  // Worst
  if (summary.worst.length > 0) {
    line('Worst-scoring questions (lowest combined score)')
    for (const w of summary.worst.slice(0, 5)) {
      line(
        `  [${w.difficulty}/${w.category}] f=${w.factualScore} d=${w.difficultyScore} c=${w.concisionScore}`
      )
      line(`     Q: ${truncate(w.question, 100)}`)
      line(`     A: ${truncate(w.correctAnswer, 60)}`)
      if (w.factualScore < 3) line(`     factual: ${truncate(w.factualRationale, 100)}`)
      if (w.difficultyScore < 3) line(`     diff:    ${truncate(w.difficultyRationale, 100)}`)
      if (w.concisionScore < 3) line(`     concise: ${truncate(w.concisionRationale, 100)}`)
    }
    line('')
  }

  if (summary.generationFailures.length > 0) {
    line('Generation failures')
    for (const f of summary.generationFailures.slice(0, 5)) {
      line(`  [${f.difficulty}/${f.category}] ${truncate(f.error, 120)}`)
    }
    if (summary.generationFailures.length > 5) {
      line(`  …and ${summary.generationFailures.length - 5} more`)
    }
    line('')
  }
}

function printDimensionRow(label: string, value: number, prev: number | undefined): void {
  process.stdout.write(`${label}${formatPct(value).padStart(7)}${delta(value, prev)}\n`)
}

function printMeanRow(label: string, value: number, prev: number | undefined): void {
  process.stdout.write(`${label}${value.toFixed(2).padStart(5)}${deltaMean(value, prev)}\n`)
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '(n/a)'
  return formatPct((num * 100) / denom)
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

function delta(curPct: string | number, prevPct: string | number | undefined | null): string {
  if (prevPct === undefined || prevPct === null) return ''
  const cur = typeof curPct === 'string' ? parseFloat(curPct) : curPct
  const prev = typeof prevPct === 'string' ? parseFloat(prevPct) : prevPct
  if (Number.isNaN(cur) || Number.isNaN(prev)) return ''
  const diff = cur - prev
  if (Math.abs(diff) < 0.05) return '   (=)'
  const sign = diff > 0 ? '+' : ''
  const arrow = diff > 0 ? '↑' : '↓'
  return `   ${arrow} ${sign}${diff.toFixed(1)} pts`
}

function deltaMean(cur: number, prev: number | undefined): string {
  if (prev === undefined) return ''
  const diff = cur - prev
  if (Math.abs(diff) < 0.005) return '   (=)'
  const sign = diff > 0 ? '+' : ''
  const arrow = diff > 0 ? '↑' : '↓'
  return `   ${arrow} ${sign}${diff.toFixed(2)}`
}

function deltaUsd(cur: number, prev: number | undefined | null): string {
  if (prev === undefined || prev === null) return ''
  const diff = cur - prev
  // Threshold = 1¢ — anything smaller is noise.
  if (Math.abs(diff) < 0.01) return '   (=)'
  const sign = diff > 0 ? '+' : '-'
  const arrow = diff > 0 ? '↑' : '↓'
  return `   ${arrow} ${sign}${formatUsd(Math.abs(diff))}`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

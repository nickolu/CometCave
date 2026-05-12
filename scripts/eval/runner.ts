// Orchestrates the eval: for each (cell, trial), run the live generation
// pipeline once, then run the OpenAI judge over the result. Concurrency-
// limited because the underlying pipeline already burns multiple LLM
// calls per generation (fact source, construction, optional repair,
// review) and we'd rather not melt rate limits.

import { saveAIQuestion } from '../../src/lib/trivia/aiQuestions'
import { generateInfiniteQuestion } from '../../src/lib/trivia/generateQuestion'
import {
  type UsageEvent,
  withUsageRecording,
} from '../../src/lib/trivia/usageRecorder'
import type { GoldenCell } from './golden-cells'
import { judgeQuestion, type Verdict } from './judge'

export interface TrialResult {
  cell: GoldenCell
  trialIndex: number
  // Generation either succeeded (question/answer/...) or failed with a
  // reason. Failures are quality signals too — a change that increases
  // the failure rate is a regression.
  outcome:
    | {
        kind: 'generated'
        question: string
        correctAnswer: string
        explanation: string
        actualDifficulty: 'easy' | 'medium' | 'hard'
        seed?: string
        sourceUrl?: string
        appVersion?: string
        verdict: Verdict
        // Set when --save was on AND verdict.ship was true. `saved`
        // means saveAIQuestion succeeded; `saveError` records why it
        // didn't. Both undefined when --save is off or verdict.ship is
        // false (no save attempt was made).
        saved?: boolean
        saveError?: string
      }
    | {
        kind: 'generation_failed'
        error: string
      }
    | {
        kind: 'judge_failed'
        question: string
        correctAnswer: string
        error: string
      }
  durationMs: number
  // Token usage recorded per LLM call during this trial (generation +
  // judge). Empty if the recorder caught no events (shouldn't happen
  // during a normal trial). Used by the scorecard for cost rollups.
  usageEvents: UsageEvent[]
}

export interface RunOptions {
  cells: GoldenCell[]
  trialsPerCell: number
  concurrency: number
  // When true, ship-eligible generations are saved to Firestore as
  // they're judged. Off for clean experiment runs; on for production-
  // style runs that want eval cost to also grow the question pool.
  save?: boolean
  onProgress?: (done: number, total: number, latest: TrialResult) => void
}

interface Job {
  cell: GoldenCell
  trialIndex: number
}

export async function runEval(options: RunOptions): Promise<TrialResult[]> {
  const jobs: Job[] = []
  for (const cell of options.cells) {
    for (let t = 0; t < options.trialsPerCell; t++) {
      jobs.push({ cell, trialIndex: t })
    }
  }

  const results: TrialResult[] = []
  let cursor = 0
  let done = 0
  const save = options.save === true

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= jobs.length) return
      const job = jobs[idx]
      const result = await runOne(job, save)
      results.push(result)
      done++
      options.onProgress?.(done, jobs.length, result)
    }
  }

  const workers = Array.from(
    { length: Math.min(options.concurrency, jobs.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

async function runOne(job: Job, save: boolean): Promise<TrialResult> {
  const start = Date.now()
  // One event buffer per trial. AsyncLocalStorage scopes recordUsage()
  // calls inside generateInfiniteQuestion + judgeQuestion to this
  // buffer, so concurrent trials don't pollute each other's totals.
  const events: UsageEvent[] = []
  return withUsageRecording(events, async () => {
    try {
      const generated = await generateInfiniteQuestion({
        categoryId: job.cell.categoryId,
        difficulty: job.cell.difficulty,
      })

      const explanation = generated.explanation ?? ''
      let verdict: Verdict
      try {
        verdict = await judgeQuestion({
          question: generated.question,
          correctAnswer: generated.correctAnswer,
          explanation,
          category: job.cell.categoryName,
          difficulty: job.cell.difficulty,
          sourceUrl: generated.sourceUrl,
        })
      } catch (err) {
        return {
          cell: job.cell,
          trialIndex: job.trialIndex,
          outcome: {
            kind: 'judge_failed',
            question: generated.question,
            correctAnswer: generated.correctAnswer,
            error: err instanceof Error ? err.message : String(err),
          },
          durationMs: Date.now() - start,
          usageEvents: events,
        }
      }

      // Persist ship-eligible questions when --save is on. The pipeline
      // already ran the duplicate-answer backstop before returning, so
      // anything we write here is fresh. Save failures don't poison the
      // trial — the eval verdict is still valid signal.
      let saved: boolean | undefined
      let saveError: string | undefined
      if (save && verdict.ship) {
        try {
          await saveAIQuestion({ ...generated, createdBy: 'system-eval' })
          saved = true
        } catch (err) {
          saved = false
          saveError = err instanceof Error ? err.message : String(err)
        }
      }

      return {
        cell: job.cell,
        trialIndex: job.trialIndex,
        outcome: {
          kind: 'generated',
          question: generated.question,
          correctAnswer: generated.correctAnswer,
          explanation,
          actualDifficulty: generated.difficulty,
          seed: generated.seed,
          sourceUrl: generated.sourceUrl,
          appVersion: generated.appVersion,
          verdict,
          ...(saved !== undefined ? { saved } : {}),
          ...(saveError !== undefined ? { saveError } : {}),
        },
        durationMs: Date.now() - start,
        usageEvents: events,
      }
    } catch (err) {
      return {
        cell: job.cell,
        trialIndex: job.trialIndex,
        outcome: {
          kind: 'generation_failed',
          error: err instanceof Error ? err.message : String(err),
        },
        durationMs: Date.now() - start,
        usageEvents: events,
      }
    }
  })
}

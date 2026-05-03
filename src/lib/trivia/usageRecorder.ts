// Eval-only observability for the question-generation pipeline. Lets a
// caller (the eval harness) capture per-trial token usage from every LLM
// call inside a single generateInfiniteQuestion() invocation, without
// the pipeline knowing or caring whether anyone is listening.
//
// In production nobody calls withUsageRecording, so recordUsage is a
// single AsyncLocalStorage `getStore()` lookup that returns undefined
// and the call no-ops — no cost, no behavioral change.
//
// AsyncLocalStorage is what makes this work under the eval's parallel
// concurrency: each trial's call to withUsageRecording installs a
// separate event-buffer in async context, so two concurrent trials
// don't bleed events into each other.

import { AsyncLocalStorage } from 'node:async_hooks'

export type GenerationStage =
  | 'facts'
  | 'factPicker'
  | 'construct'
  | 'repair'
  | 'review'
  | 'judge'

export interface UsageEvent {
  stage: GenerationStage
  model: string
  inputTokens: number
  outputTokens: number
}

const storage = new AsyncLocalStorage<UsageEvent[]>()

export function recordUsage(event: UsageEvent): void {
  storage.getStore()?.push(event)
}

export function withUsageRecording<T>(
  events: UsageEvent[],
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(events, fn)
}

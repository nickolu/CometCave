// Token-usage → USD rollup for the eval harness. Pricing table is
// hand-maintained because the SDK doesn't surface unit prices and
// because each provider lists rates in slightly different ways
// (per-million tokens, per-call, etc.). Numbers are USD per million
// tokens, sourced from each provider's public pricing page as of
// 2026-05-02. Update if you swap models or vendors raise prices.
//
// Models not in the table contribute $0 — the eval logs unknown
// models so we notice and add them, rather than silently mispricing.

import type { UsageEvent } from '../../src/lib/trivia/usageRecorder'

interface ModelPricing {
  inputPerM: number
  outputPerM: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic — claude.ai/pricing
  'claude-sonnet-4-6': { inputPerM: 3, outputPerM: 15 },
  'claude-haiku-4-5-20251001': { inputPerM: 1, outputPerM: 5 },
  // Perplexity — docs.perplexity.ai/guides/pricing (sonar = base tier)
  // Per-search fee not modelled — it's a flat ~$5/1k requests on top of
  // tokens, small relative to LLM cost at our scale.
  sonar: { inputPerM: 1, outputPerM: 1 },
  // OpenAI — openai.com/api/pricing
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
}

export interface CostBreakdown {
  totalUsd: number
  byStage: Record<string, number>
  byModel: Record<string, number>
  unknownModels: string[]
}

export function computeCost(events: UsageEvent[]): CostBreakdown {
  let totalUsd = 0
  const byStage: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  const unknownModels = new Set<string>()

  for (const e of events) {
    const pricing = MODEL_PRICING[e.model]
    if (!pricing) {
      unknownModels.add(e.model)
      continue
    }
    const cost =
      (e.inputTokens * pricing.inputPerM + e.outputTokens * pricing.outputPerM) /
      1_000_000
    totalUsd += cost
    byStage[e.stage] = (byStage[e.stage] ?? 0) + cost
    byModel[e.model] = (byModel[e.model] ?? 0) + cost
  }

  return {
    totalUsd,
    byStage,
    byModel,
    unknownModels: [...unknownModels],
  }
}

export function formatUsd(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

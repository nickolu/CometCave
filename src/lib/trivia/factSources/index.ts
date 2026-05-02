import { LLMFactSource } from './llmFactSource'
import { PerplexityFactSource } from './perplexityFactSource'

import type { FactSource } from './types'

export type { Fact, FactSource, FetchFactsOptions, Difficulty } from './types'
export { LLMFactSource } from './llmFactSource'
export { PerplexityFactSource } from './perplexityFactSource'

let _default: FactSource | null = null

// Returns the default FactSource implementation. Perplexity is the
// preferred source — facts come back grounded in live web search with
// citations attached. Falls back to the parametric LLMFactSource when
// the Perplexity key isn't configured (so local dev without a
// Perplexity key still works).
export function getDefaultFactSource(): FactSource {
  if (_default) return _default

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (perplexityKey) {
    _default = new PerplexityFactSource(perplexityKey)
    return _default
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    throw new Error('Neither PERPLEXITY_API_KEY nor ANTHROPIC_API_KEY is configured')
  }
  _default = new LLMFactSource(anthropicKey)
  return _default
}

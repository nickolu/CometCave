import { LLMFactSource } from './llmFactSource'

import type { FactSource } from './types'

export type { Fact, FactSource, FetchFactsOptions, Difficulty } from './types'
export { LLMFactSource } from './llmFactSource'

let _default: FactSource | null = null

// Returns the default FactSource implementation. Today this is the
// LLM-only source; planned implementations include WikipediaFactSource,
// WikidataFactSource, and PerplexityFactSource. Callers should not
// hardcode a specific implementation — the factory picks based on env
// or a future feature flag.
export function getDefaultFactSource(): FactSource {
  if (_default) return _default
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not configured')
  _default = new LLMFactSource(apiKey)
  return _default
}

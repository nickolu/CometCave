import { describe, expect, it } from 'vitest'

import type { Fact, FactSource, FetchFactsOptions } from '@/lib/trivia/factSources/types'

// These tests document the FactSource interface contract any
// implementation must satisfy. They run against a stub source so
// migrations (Wikipedia, Wikidata, Perplexity) only need to drop in
// a new class and the same expectations should hold.

class StubFactSource implements FactSource {
  readonly id = 'stub:test'
  constructor(private response: Fact[]) {}
  async fetchFacts(_opts: FetchFactsOptions): Promise<Fact[]> {
    return this.response
  }
}

describe('FactSource interface', () => {
  const baseOpts: FetchFactsOptions = {
    categoryId: 9,
    category: 'General Knowledge',
    seed: 'fandom :: deep cut',
    difficulty: 'medium',
    count: 5,
  }

  it('returns facts whose keyDetail appears verbatim in the claim', async () => {
    const source = new StubFactSource([
      {
        claim: 'The first commercial CD was released in 1982.',
        keyDetail: '1982',
        source: null,
      },
    ])
    const facts = await source.fetchFacts(baseOpts)
    expect(facts).toHaveLength(1)
    for (const f of facts) {
      expect(f.claim.includes(f.keyDetail)).toBe(true)
    }
  })

  it('source field is nullable to distinguish ungrounded LLM facts from cited ones', async () => {
    const source = new StubFactSource([
      { claim: 'a', keyDetail: 'a', source: null },
      { claim: 'b', keyDetail: 'b', source: 'wikipedia:Pulp_Fiction' },
    ])
    const facts = await source.fetchFacts(baseOpts)
    expect(facts[0].source).toBeNull()
    expect(typeof facts[1].source).toBe('string')
  })

  it('id field identifies the implementation in logs and citations', () => {
    const source = new StubFactSource([])
    expect(source.id).toBe('stub:test')
  })

  it('an empty result is allowed (soft failure, not exception)', async () => {
    const source = new StubFactSource([])
    const facts = await source.fetchFacts(baseOpts)
    expect(facts).toEqual([])
  })
})

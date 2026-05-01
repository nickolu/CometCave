import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import type { Fact, FactSource, FetchFactsOptions } from './types'

const FACT_MODEL = 'gpt-4o-mini'

const FactsSchema = z.object({
  facts: z
    .array(
      z.object({
        claim: z
          .string()
          .describe(
            'A single verifiable factual statement, written as a complete sentence. The keyDetail must appear verbatim (or as a clear synonym) inside the claim.'
          ),
        keyDetail: z
          .string()
          .describe(
            'The specific concrete answer this fact supports — a name, date, number, place, or short phrase. Typically 1-3 words.'
          ),
      })
    )
    .describe('The list of distinct, surprising facts about the topic.'),
})

const DIFFICULTY_GUIDANCE: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Facts should be approachable — well-known but rewarding to recall.',
  medium:
    'Facts should require some specific knowledge — beyond common knowledge but not obscure trivia.',
  hard: 'Facts should be genuinely deep cuts — surprising, specific, the kind only an enthusiast would know.',
}

export class LLMFactSource implements FactSource {
  readonly id = `llm:${FACT_MODEL}`

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetchFacts({
    category,
    seed,
    difficulty,
    count,
  }: FetchFactsOptions): Promise<Fact[]> {
    const openaiClient = createOpenAI({ apiKey: this.apiKey })

    const seedLine = seed ? `Topical seed: ${seed}\n` : ''

    const result = await generateObject({
      model: openaiClient(FACT_MODEL),
      schema: FactsSchema,
      system:
        'You are a meticulous trivia researcher for a cosmic-cave-themed game. You surface facts that make people say "huh, I didn\'t know that." You never invent facts; if you are not confident a claim is true, you do not include it.',
      prompt: `Produce ${count} distinct, interesting facts about the category "${category}".
${seedLine}Difficulty: ${difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[difficulty]}

Each fact must:
- Be specifically about the category "${category}" — not adjacent topics.
- State ONE specific, verifiable claim.
- Have a single concrete keyDetail (a name, date, number, place, or 1-3 word phrase) that uniquely identifies the answer.
- Have the keyDetail appear verbatim inside the claim sentence.
- Reach for surprising or deep-cut angles rather than obvious common knowledge.
- Be true. If you are uncertain, replace the fact with one you are confident about.

Avoid duplicates: each of the ${count} facts should be about a different subject.`,
      temperature: 0.7,
      maxTokens: 800,
    })

    return result.object.facts.map((f) => ({
      claim: f.claim,
      keyDetail: f.keyDetail,
      source: null,
    }))
  }
}

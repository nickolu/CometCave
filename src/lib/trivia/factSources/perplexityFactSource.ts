import Perplexity from '@perplexity-ai/perplexity_ai'
import { z } from 'zod'

import type { Fact, FactSource, FetchFactsOptions } from './types'

// Sonar is Perplexity's cheapest web-grounded model. Fact extraction
// is a recall task with web search — we don't need multi-hop reasoning
// or sonar-pro's tool use. Bumping models is a single string change.
const FACT_MODEL = 'sonar'

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
        sourceUrl: z
          .string()
          .describe(
            'The single most-supporting URL from the search results for THIS fact. Pick the most authoritative result that directly states the claim. Empty string if no result clearly supports this fact.'
          ),
      })
    )
    .describe('The list of distinct, surprising, well-grounded facts about the topic.'),
})

const DIFFICULTY_GUIDANCE: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Facts should be approachable — well-known but rewarding to recall.',
  medium:
    'Facts should require some specific knowledge — beyond common knowledge but not obscure trivia.',
  hard: 'Facts should be genuinely deep cuts — surprising, specific, the kind only an enthusiast would know.',
}

// JSON Schema (not Zod) is what Perplexity's response_format expects.
// Keep this in sync with FactsSchema above — the Zod one is used for
// post-parse validation, the JSON-Schema one constrains generation.
const FACTS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          keyDetail: { type: 'string' },
          sourceUrl: { type: 'string' },
        },
        required: ['claim', 'keyDetail', 'sourceUrl'],
      },
    },
  },
  required: ['facts'],
} as const

export class PerplexityFactSource implements FactSource {
  readonly id = `perplexity:${FACT_MODEL}`
  readonly model = FACT_MODEL

  private client: Perplexity

  constructor(apiKey: string) {
    this.client = new Perplexity({ apiKey })
  }

  async fetchFacts({
    category,
    seed,
    difficulty,
    count,
  }: FetchFactsOptions): Promise<Fact[]> {
    const seedLine = seed ? `Topical seed: ${seed}\n` : ''

    const response = await this.client.chat.completions.create({
      model: FACT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a meticulous trivia researcher for a cosmic-cave-themed game. You search the web for facts that make people say "huh, I didn\'t know that." You only include facts that your search results directly support. If a search result contradicts or doesn\'t support a candidate fact, drop it. Output JSON conforming to the response_format schema.',
        },
        {
          role: 'user',
          content: `Produce ${count} distinct, interesting, well-sourced facts about the category "${category}".
${seedLine}Difficulty: ${difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[difficulty]}

Each fact must:
- Be specifically about the category "${category}" — not adjacent topics.
- State ONE specific, verifiable claim about ONE specific subject (a particular person, work, event, place, or thing — not a category of things).
- Have a single concrete keyDetail (a name, date, number, place, or 1-3 word phrase) that is the UNIQUE answer to a question about this fact. If multiple things could plausibly be the answer (e.g. "a tennis player who won many Grand Slams" — there are several), the fact is too vague; pick a more specific subject.
- The keyDetail must be the MINIMAL answer string — drop unit words and articles that the question would naturally contain. Use "40" not "40 novels" if the question would already say "how many novels"; use "Mount Everest" not "the mountain Mount Everest." If the answer is fundamentally tied to a unit (e.g. an album title that contains the word "Album"), keep the unit.
- AVOID "guess a number" keyDetails. A numeric keyDetail (a year, count, percentage, measurement) is acceptable ONLY when the number is the famous/defining property of the subject — something an enthusiast would know off the top of their head. Examples that ARE acceptable: "23" for Serena Williams's Grand Slam total (a record fans know), "1066" for the Battle of Hastings (canonical history). Examples that are NOT acceptable: a book's translation count, a city's population, the publication year of an arbitrary work, an obscure film's box office.
- Have the keyDetail appear verbatim inside the claim sentence.
- Reach for surprising or deep-cut angles rather than obvious common knowledge.
- Be DIRECTLY supported by one of the search results you retrieved. If you couldn't find a search result that supports the claim, do not include it.
- Set sourceUrl to the single most-authoritative search result URL that supports the claim.

Avoid duplicates: each of the ${count} facts should be about a different subject.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { schema: FACTS_JSON_SCHEMA },
      },
      temperature: 0.7,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content
    const text = typeof content === 'string' ? content : extractText(content)
    if (!text) {
      throw new Error('Perplexity returned empty content')
    }

    const parsed = FactsSchema.parse(JSON.parse(text))

    // Top-level citations array is the canonical source list for the
    // whole response. We prefer the per-fact sourceUrl the model picked,
    // and fall back to the first citation (or null) when the model
    // failed to attach one.
    const fallbackCitation = response.citations?.[0] ?? null

    return parsed.facts.map((f) => ({
      claim: f.claim,
      keyDetail: f.keyDetail,
      source: f.sourceUrl && f.sourceUrl.length > 0 ? f.sourceUrl : fallbackCitation,
    }))
  }
}

// Perplexity occasionally returns the message content as a structured
// chunk array instead of a plain string when JSON mode is on. Flatten
// to a single string for downstream parsing.
function extractText(
  content: Array<{ type: string; text?: string }> | null | undefined
): string | null {
  if (!content) return null
  return content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('')
}

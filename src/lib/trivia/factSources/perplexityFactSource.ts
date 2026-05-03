import Perplexity from '@perplexity-ai/perplexity_ai'
import { z } from 'zod'

import { recordUsage } from '../usageRecorder'
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
  easy: 'Facts must be COMMON KNOWLEDGE — about subjects a typical adult would recognize from popular culture, school, or daily life. Famous people, iconic places, well-known works, mainstream events. Do NOT reach for surprising / obscure / deep-cut framings; an "easy" fact is one that confirms something a player likely already knows.',
  medium:
    'Facts should require some category-specific knowledge — beyond what an average adult knows, but in reach for someone who follows the category casually. Not deep cuts; not insider trivia.',
  hard: 'Facts should be genuinely deep cuts — surprising, specific, the kind only an enthusiast or specialist would know.',
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
    // Seed format from the generator is "${seedWord} :: ${modifier}".
    // We parse it back out so the prompt can make seedWord the primary
    // search subject (binding) and modifier the framing (decorative).
    // Without this, Perplexity treats the category as the binding
    // constraint and the seed as flavor — converging on whatever
    // generic "facts about ${category}" listicle has highest PageRank
    // (e.g. every Art seed → the Mona Lisa listicle).
    let seedWord: string | null = null
    let modifier: string | null = null
    if (seed) {
      const parts = seed.split(' :: ')
      seedWord = (parts[0] ?? '').trim() || null
      modifier = (parts[1] ?? '').trim() || null
    }

    const subject = seedWord ? `"${seedWord}"` : `the category "${category}"`
    const subjectLine = seedWord
      ? `Find ${count} distinct, well-sourced trivia facts SPECIFICALLY about ${subject} within the broader category of "${category}".`
      : `Find ${count} distinct, well-sourced trivia facts about the category "${category}".`
    const modifierLine = modifier
      ? `\nAngle / framing to emphasize: "${modifier}" — bias the facts toward this aspect of ${subject}.`
      : ''

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
          content: `${subjectLine}${modifierLine}

Difficulty: ${difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[difficulty]}

CRITICAL — bind your search to ${subject}, not to "${category}" generically:
- Every fact MUST be specifically about ${subject} (or something directly tied to it). Facts about other subjects in "${category}" do not count, even if they're famous and even if they appear in the same search results.
- If a search result is a generic "facts about ${category}" listicle that isn't specifically about ${subject}, IGNORE it. Search again with more specific queries (e.g. ${seedWord ? `"${seedWord} interesting facts", "${seedWord} history", "${seedWord} trivia"` : `"${category} <specific subtopic>"`}) instead.
- The ${count} facts should come from at least 3 different source domains. If your search keeps returning the same listicle, broaden your queries — do not pull multiple facts from a single listicle.
- Concrete failure mode to avoid: when seeded with "Pablo Picasso" within the Art category, do NOT return a fact about the Mona Lisa just because it appears in a "famous artworks" listicle. Return facts about Picasso.

Each fact must:
- State ONE specific, verifiable claim about ONE specific subject (a particular person, work, event, place, or thing — not a category of things).
- The keyDetail must be a NAMED ENTITY — a person, place, work, event, organism, concept, or short proper-noun phrase. NEVER a number, year, date, percentage, or measurement on its own. Specific numbers and dates are unfair as trivia answers — players have to guess. If a fact's most surprising aspect is a number ("Lake Baikal is 1,642m deep"), use the named entity as the keyDetail ("Lake Baikal") and let the number live inside the claim — it will become a clue in the eventual question.
- The keyDetail must be the MINIMAL answer string — drop articles and unit words the question would naturally contain ("Mount Everest" not "the mountain Mount Everest"). Names that legitimately contain a number ("Apollo 11", "Area 51", "Catch-22") are fine; the rule is about pure-numeric answers, not about names that happen to include digits.
- The keyDetail must be UNIQUE — if multiple things could plausibly be the answer (e.g. "a tennis player who won many Grand Slams" — there are several), the fact is too vague; pick a more specific subject.
- Have the keyDetail appear verbatim inside the claim sentence.
- Match the difficulty above. At EASY, prefer common-knowledge subjects (famous people, iconic places, mainstream works); the surprise should be a small twist on something the player already recognizes, not an obscure deep cut. At HARD, deep cuts are welcome.
- Be DIRECTLY supported by one of the search results you retrieved. If you couldn't find a search result that supports the claim, do not include it.
- Set sourceUrl to the single most-authoritative search result URL that supports the claim.

Avoid duplicates: each of the ${count} facts should be about a different subject within ${subject}.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { schema: FACTS_JSON_SCHEMA },
      },
      temperature: 0.7,
      max_tokens: 1500,
    })
    recordUsage({
      stage: 'facts',
      model: FACT_MODEL,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
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

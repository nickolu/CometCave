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
- State ONE specific, verifiable claim about ONE specific subject (a particular person, work, event, place, or thing — not a category of things).
- Have a single concrete keyDetail (a name, date, number, place, or 1-3 word phrase) that is the UNIQUE answer to a question about this fact. If multiple things could plausibly be the answer (e.g. "a tennis player who won many Grand Slams" — there are several), the fact is too vague; pick a more specific subject.
- The keyDetail must be the MINIMAL answer string — drop unit words and articles that the question would naturally contain. Use "40" not "40 novels" if the question would already say "how many novels"; use "Mount Everest" not "the mountain Mount Everest." If the answer is fundamentally tied to a unit (e.g. an album title that contains the word "Album"), keep the unit.
- AVOID "guess a number" keyDetails. A numeric keyDetail (a year, count, percentage, measurement) is acceptable ONLY when the number is the famous/defining property of the subject — something an enthusiast would know off the top of their head. Examples that ARE acceptable: "23" for Serena Williams's Grand Slam total (a record fans know), "1066" for the Battle of Hastings (canonical history), "41" for the Discworld novel count (well-known to fans). Examples that are NOT acceptable: a book's translation count, a city's population, the publication year of an arbitrary work, an obscure film's box office. Test: would a fan of this topic know the exact number with confidence, or would they have to guess? If guess, pick a different angle from the same subject (the person, place, work, rule, or consequence) and write a fact about that instead.
- Have the keyDetail appear verbatim inside the claim sentence.
- Reach for surprising or deep-cut angles rather than obvious common knowledge.
- Be true. If you are uncertain, replace the fact with one you are confident about.

Examples of good vs bad facts:

GOOD: claim="Serena Williams won her 23rd and final Grand Slam singles title at the 2017 Australian Open." keyDetail="2017 Australian Open"
  → unique because there's only one 23rd-Grand-Slam-win event for her.

GOOD: claim="The Discworld series by Terry Pratchett comprises 41 novels published between 1983 and 2015." keyDetail="41"
  → minimal; the question will naturally say "how many novels," so the keyDetail is just the number.

BAD: claim="Serena Williams is a tennis player who has won many Grand Slam titles." keyDetail="Serena Williams"
  → degenerate; the keyDetail is named in the claim and the fact gives no specific answer.

BAD: claim="The Basenji is known as the 'barkless dog'." keyDetail="Basenji"
  → other quiet breeds could plausibly be called "barkless" too. Pick a more specific framing.

BAD: claim="The Discworld series has 41 novels." keyDetail="41 novels"
  → keyDetail includes "novels" which the question will naturally contain. Use just "41."

BAD: claim="The first edition of 'The Dark Tower: The Gunslinger' by Stephen King was published in 1982." keyDetail="1982"
  → year-only keyDetail. The resulting question is "what year did X happen?" which is a guessing game with no skill signal. Pick a different angle from the same subject — e.g. claim="'The Dark Tower: The Gunslinger' was Stephen King's first novel in his 'Dark Tower' series." keyDetail="The Gunslinger" (or "Stephen King" if the fact framed it that way).

Avoid duplicates: each of the ${count} facts should be about a different subject.`,
      temperature: 0.7,
      maxTokens: 1000,
    })

    return result.object.facts.map((f) => ({
      claim: f.claim,
      keyDetail: f.keyDetail,
      source: null,
    }))
  }
}

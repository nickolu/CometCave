import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

import type { Fact, FactSource, FetchFactsOptions } from './types'

// Sonnet without extended thinking. Fact extraction is mostly recall,
// not multi-constraint reasoning — bumping to thinking adds latency
// without obvious quality wins. Construction and repair are the stages
// that actually benefit from reasoning.
const FACT_MODEL = 'claude-sonnet-4-6'

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
  readonly model = FACT_MODEL

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
    const anthropicClient = createAnthropic({ apiKey: this.apiKey })

    const seedLine = seed ? `Topical seed: ${seed}\n` : ''

    const result = await generateObject({
      model: anthropicClient(FACT_MODEL),
      schema: FactsSchema,
      system:
        'You are a meticulous trivia researcher for a cosmic-cave-themed game. You surface facts that make people say "huh, I didn\'t know that." You never invent facts; if you are not confident a claim is true, you do not include it.',
      prompt: `Produce ${count} distinct, interesting facts about the category "${category}".
${seedLine}Difficulty: ${difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[difficulty]}

Each fact must:
- Be specifically about the category "${category}" — not adjacent topics.
- State ONE specific, verifiable claim about ONE specific subject (a particular person, work, event, place, or thing — not a category of things).
- The keyDetail must be a NAMED ENTITY — a person, place, work, event, organism, concept, or short proper-noun phrase. NEVER a number, year, date, percentage, or measurement on its own. Specific numbers and dates are unfair as trivia answers — players have to guess. If a fact's most surprising aspect is a number ("Lake Baikal is 1,642m deep"), use the named entity as the keyDetail ("Lake Baikal") and let the number live inside the claim — it will become a clue in the eventual question.
- The keyDetail must be the MINIMAL answer string — drop articles and unit words the question would naturally contain ("Mount Everest" not "the mountain Mount Everest"). Names that legitimately contain a number ("Apollo 11", "Area 51", "Catch-22") are fine; the rule is about pure-numeric answers, not names that happen to include digits.
- The keyDetail must be UNIQUE — if multiple things could plausibly be the answer (e.g. "a tennis player who won many Grand Slams" — there are several), the fact is too vague; pick a more specific subject.
- Have the keyDetail appear verbatim inside the claim sentence.
- Reach for surprising or deep-cut angles rather than obvious common knowledge.
- Be true. If you are uncertain, replace the fact with one you are confident about.

Examples of good vs bad facts:

GOOD: claim="Serena Williams won her 23rd and final Grand Slam singles title at the 2017 Australian Open." keyDetail="2017 Australian Open"
  → unique because there's only one 23rd-Grand-Slam-win event for her. Number ("23rd") and date ("2017") sit inside the claim as clues; the answer is a named event.

GOOD: claim="The Discworld series by Terry Pratchett comprises 41 novels published between 1983 and 2015." keyDetail="Discworld"
  → answer is a named series; the count "41" lives in the claim and will become a clue in the eventual question ("Which Terry Pratchett series comprises 41 novels?").

BAD: claim="The Discworld series by Terry Pratchett comprises 41 novels." keyDetail="41"
  → numeric keyDetail. The resulting question would ask "how many novels" — players just have to guess the number.

BAD: claim="Serena Williams is a tennis player who has won many Grand Slam titles." keyDetail="Serena Williams"
  → degenerate; the keyDetail is named in the claim and the fact gives no specific answer.

BAD: claim="The Basenji is known as the 'barkless dog'." keyDetail="Basenji"
  → other quiet breeds could plausibly be called "barkless" too. Pick a more specific framing.

BAD: claim="The first edition of 'The Dark Tower: The Gunslinger' by Stephen King was published in 1982." keyDetail="1982"
  → year-only keyDetail; numeric answers are forbidden. Pick a different angle from the same subject — e.g. claim="'The Dark Tower: The Gunslinger' was Stephen King's first novel in his 'Dark Tower' series." keyDetail="The Gunslinger".

Avoid duplicates: each of the ${count} facts should be about a different subject.`,
      temperature: 0.7,
      maxTokens: 1500,
    })

    return result.object.facts.map((f) => ({
      claim: f.claim,
      keyDetail: f.keyDetail,
      source: null,
    }))
  }
}

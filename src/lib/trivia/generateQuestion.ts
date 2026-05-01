import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import {
  CATEGORIZED_SEEDS,
  MODIFIERS,
  getOpenTDBCategoryName,
} from '@/app/trivia/data/seeds'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import {
  type Fact,
  type FactSource,
  getDefaultFactSource,
} from '@/lib/trivia/factSources'

export type GeneratedQuestion = Omit<
  AIQuestion,
  'status' | 'timesShown' | 'timesCorrect' | 'avgTimeMs'
>

export interface GenerateInfiniteQuestionOptions {
  difficulty?: 'easy' | 'medium' | 'hard'
  categoryId?: number
  streak?: number
  // Override for tests / future per-category source routing. Falls
  // back to getDefaultFactSource() when omitted.
  factSource?: FactSource
}

const QUESTION_MODEL = 'gpt-4o-mini'
const REVIEW_MODEL = 'gpt-4o-mini'
const FACTS_PER_FETCH = 5
const MAX_GENERATION_ATTEMPTS = 3

const DIFFICULTY_GUIDANCE: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Should be approachable — a well-known fact that many people could answer correctly.',
  medium:
    'Should require some specific knowledge — harder than common knowledge but not obscure trivia.',
  hard: 'Should require real, specific knowledge of the topic — challenging but fair.',
}

function streakBiasedDifficulty(streak: number): 'easy' | 'medium' | 'hard' {
  let weights: [number, number, number]
  if (streak >= 20) weights = [0.05, 0.25, 0.7]
  else if (streak >= 10) weights = [0.1, 0.3, 0.6]
  else if (streak >= 5) weights = [0.3, 0.4, 0.3]
  else weights = [0.6, 0.3, 0.1]

  const r = Math.random()
  if (r < weights[0]) return 'easy'
  if (r < weights[0] + weights[1]) return 'medium'
  return 'hard'
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickCategoryId(): number {
  const ids = Object.keys(CATEGORIZED_SEEDS).map(Number)
  return pickRandom(ids)
}

const QuestionSchema = z.object({
  question: z
    .string()
    .describe('The trivia question text, ending with a question mark.'),
  correct_answer: z
    .string()
    .describe(
      'The exact correct answer. Must equal the fact\'s keyDetail (or a close, unambiguous variant — e.g. "1986" instead of "February 21, 1986" if the question asks for the year).'
    ),
  explanation: z
    .string()
    .describe(
      '2-3 sentences explaining the answer and why it is interesting. May elaborate beyond the fact.'
    ),
})

const ReviewSchema = z.object({
  accept: z
    .boolean()
    .describe('Whether the question meets the quality bar described in the prompt.'),
  inferred_category: z
    .string()
    .describe('The single category from the provided list this question best belongs to.'),
  rejection_reason: z
    .string()
    .nullable()
    .describe('Brief explanation if rejected, otherwise null.'),
})

const KNOWN_CATEGORIES = [
  'General Knowledge',
  'Books',
  'Film',
  'Music',
  'Musicals & Theatre',
  'Television',
  'Video Games',
  'Board Games',
  'Science & Nature',
  'Computers',
  'Mathematics',
  'Mythology',
  'Sports',
  'Geography',
  'History',
  'Politics',
  'Art',
  'Celebrities',
  'Animals',
  'Vehicles',
  'Comics',
  'Gadgets',
  'Anime & Manga',
  'Cartoons & Animation',
] as const

interface DraftQuestion {
  question: string
  correct_answer: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  categoryName: string
  fact: Fact
  seedSummary: string
}

async function constructQuestionFromFact(
  apiKey: string,
  fact: Fact,
  ctx: {
    categoryName: string
    difficulty: 'easy' | 'medium' | 'hard'
    seedSummary: string
  }
): Promise<DraftQuestion> {
  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient(QUESTION_MODEL),
    schema: QuestionSchema,
    system:
      'You are a trivia question writer for a cosmic-cave-themed game. You receive a verified fact and turn it into a single short trivia question that asks for the fact\'s keyDetail. You never invent details; you only ask about what the fact already states.',
    prompt: `Build a ${ctx.difficulty} trivia question from this fact.

Fact: ${fact.claim}
Answer (keyDetail): ${fact.keyDetail}
Category: ${ctx.categoryName}

Difficulty: ${ctx.difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[ctx.difficulty]}

Rules:
- The question MUST have ONE unambiguous correct answer. If a knowledgeable person could plausibly give a different answer than the keyDetail, you must add identifying details to the question that rule out the alternatives. Do not write a question whose answer is "any X that fits Y" when many X fit Y.
- The question must ask specifically for the keyDetail.
- The question must NOT contain the keyDetail or a synonym/translation of it.
- The correct_answer must equal the keyDetail or a clear variant (e.g. "1986" if the keyDetail is "February 21, 1986" and the question asks for the year).
- The explanation may elaborate beyond the fact (2-3 sentences).
- Stay in the "${ctx.categoryName}" category. Do not drift.
- Free-text answer; this is NOT a multiple-choice question.

Examples:

GOOD: fact="Serena Williams won her 23rd and final Grand Slam singles title at the 2017 Australian Open." keyDetail="2017 Australian Open"
  Question: "At which Grand Slam tournament did Serena Williams win her 23rd and final singles title?"
  → unambiguous because the question pins it to her specific 23rd title.

BAD: same fact, keyDetail="2017 Australian Open"
  Question: "At which Grand Slam did Serena Williams win a major title?"
  → ambiguous; she won several. The question must specify "her 23rd / final" to rule out alternatives.

If you cannot construct a question with one unambiguous answer from this fact, output the best-effort question you can — the reviewer will reject ambiguous questions and we will retry with a different fact.`,
    temperature: 0.5,
    maxTokens: 400,
  })

  if (!result.object.question || !result.object.correct_answer) {
    throw new Error('Question construction returned empty fields')
  }

  return {
    question: result.object.question,
    correct_answer: result.object.correct_answer,
    explanation: result.object.explanation,
    difficulty: ctx.difficulty,
    categoryName: ctx.categoryName,
    fact,
    seedSummary: ctx.seedSummary,
  }
}

interface ReviewResult {
  accept: boolean
  reason: string | null
  inferred_category: string
}

async function reviewQuestion(
  apiKey: string,
  draft: DraftQuestion
): Promise<ReviewResult> {
  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient(REVIEW_MODEL),
    schema: ReviewSchema,
    system:
      'You are a strict quality reviewer for trivia questions. You reject anything that would frustrate a player.',
    prompt: `Review this trivia question for the category "${draft.categoryName}".

Source fact: ${draft.fact.claim}
Question: ${draft.question}
Correct answer: ${draft.correct_answer}
Explanation: ${draft.explanation}

Reject the question if ANY of these are true:
- The answer is unambiguously stated (or trivially translated) inside the question text.
- The question has multiple equally-valid answers — it must have ONE specific answer.
- The question is too vague to answer without options.
- The question is nonsensical, broken, or contradicts itself.
- The "correct answer" doesn't actually answer the question.
- The question's claim contradicts the source fact, or the answer doesn't match what the source fact supports.
- The question doesn't belong to the category "${draft.categoryName}" — pick the best-fitting category from this list:
  ${KNOWN_CATEGORIES.join(', ')}

Set accept=true ONLY if every check passes AND inferred_category equals "${draft.categoryName}".
If you reject, give a one-sentence rejection_reason. Otherwise rejection_reason is null.`,
    temperature: 0,
    maxTokens: 150,
  })

  // Trust the LLM's overall accept signal. We previously also required
  // inferred_category === draft.categoryName exactly, but that produced
  // false rejections for near-matches ("Pop Music" vs "Music") and the
  // construction prompt already enforces category fidelity upstream.
  // Keep inferred_category in the return for telemetry.
  return {
    accept: result.object.accept,
    reason: result.object.rejection_reason,
    inferred_category: result.object.inferred_category,
  }
}

/**
 * Generate a single trivia question on the fly for Infinite Trivia.
 *
 * Three-stage pipeline:
 *
 *   1. Fact extraction — call the configured FactSource (LLM-only
 *      today; Wikipedia / Perplexity planned) to surface candidate
 *      facts about the chosen category + seed.
 *   2. Question construction (gpt-4o-mini, temp 0.5) — pick a fact
 *      and turn it into a question whose answer is the fact's
 *      keyDetail.
 *   3. Quality review (gpt-4o-mini, temp 0) — strict reviewer that
 *      rejects answer-leaks, vague questions, factual contradictions,
 *      and category drift.
 *
 * On rejection we retry once (fresh facts, fresh seed) before giving
 * up. The /next route maps the throw to a 204 (pool exhausted), same
 * as any other generation failure.
 *
 * The FactSource interface lets us migrate to grounded sources
 * (Wikipedia, Wikidata, Perplexity) without touching the question
 * construction or review stages.
 */
export async function generateInfiniteQuestion(
  options: GenerateInfiniteQuestionOptions = {}
): Promise<GeneratedQuestion> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const factSource = options.factSource ?? getDefaultFactSource()

  let lastReason = 'unknown'
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const difficulty = options.difficulty ?? streakBiasedDifficulty(options.streak ?? 0)
    const categoryId = options.categoryId ?? pickCategoryId()
    const categoryName = getOpenTDBCategoryName(categoryId)
    const seeds = CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]
    const seedWord = pickRandom(seeds)
    const modifier = pickRandom(MODIFIERS)
    const seedSummary = `${seedWord} :: ${modifier}`

    let facts: Fact[]
    try {
      facts = await factSource.fetchFacts({
        categoryId,
        category: categoryName,
        seed: seedSummary,
        difficulty,
        count: FACTS_PER_FETCH,
      })
    } catch (err) {
      lastReason = `factSource(${factSource.id}) failed: ${err instanceof Error ? err.message : String(err)}`
      console.warn('[generateInfiniteQuestion] fact fetch failed', { attempt, reason: lastReason })
      continue
    }

    if (facts.length === 0) {
      lastReason = `factSource(${factSource.id}) returned 0 facts`
      console.warn('[generateInfiniteQuestion] no facts', { attempt, category: categoryName })
      continue
    }

    const fact = pickRandom(facts)
    const draft = await constructQuestionFromFact(apiKey, fact, {
      categoryName,
      difficulty,
      seedSummary,
    })
    const review = await reviewQuestion(apiKey, draft)

    if (review.accept) {
      const id = `ai-infinite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      console.info('[generateInfiniteQuestion] generated', {
        id,
        category: categoryName,
        difficulty,
        attempt,
        factSource: factSource.id,
        factSourceCitation: fact.source,
        inferredCategory: review.inferred_category,
      })
      return {
        id,
        question: draft.question,
        correctAnswer: draft.correct_answer,
        explanation: draft.explanation,
        category: categoryName,
        difficulty,
        type: 'free-text',
      }
    }

    lastReason = review.reason ?? `inferred=${review.inferred_category}`
    console.warn('[generateInfiniteQuestion] draft rejected', {
      attempt,
      category: categoryName,
      seed: seedSummary,
      factSource: factSource.id,
      factSourceCitation: fact.source,
      reason: lastReason,
    })
  }

  throw new Error(
    `Generation failed quality gate after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastReason}`
  )
}

import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import {
  CATEGORIZED_SEEDS,
  MODIFIERS,
  getOpenTDBCategoryName,
} from '@/app/trivia/data/seeds'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'

export type GeneratedQuestion = Omit<
  AIQuestion,
  'status' | 'timesShown' | 'timesCorrect' | 'flaggedCount' | 'avgTimeMs'
>

export interface GenerateInfiniteQuestionOptions {
  difficulty?: 'easy' | 'medium' | 'hard'
  categoryId?: number
  streak?: number
}

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
  question: z.string().describe('The trivia question text, ending with a question mark.'),
  correct_answer: z
    .string()
    .describe('The specific correct answer — typically 1-3 words (a name, date, number, place, or concept).'),
  explanation: z
    .string()
    .describe('2-3 sentences explaining the answer and why it is interesting.'),
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
  seedSummary: string
}

async function generateDraft(
  apiKey: string,
  opts: GenerateInfiniteQuestionOptions
): Promise<DraftQuestion> {
  const difficulty = opts.difficulty ?? streakBiasedDifficulty(opts.streak ?? 0)
  const categoryId = opts.categoryId ?? pickCategoryId()
  const categoryName = getOpenTDBCategoryName(categoryId)
  const seeds = CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]
  const seedWord = pickRandom(seeds)
  const modifier = pickRandom(MODIFIERS)
  const seedStr = `${seedWord} :: ${modifier}`

  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    schema: QuestionSchema,
    system:
      'You are a trivia question creator for a cosmic-cave-themed game. Each question should feel hand-crafted and a little surprising — the kind of fact that makes someone say "huh, I didn\'t know that." Avoid the obvious; reach for the well-loved deep cut.',
    prompt: `Generate a ${difficulty} trivia question.

Topical seed: "${seedStr}"
Category: ${categoryName}

Difficulty: ${difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[difficulty]}

The question should:
- Have ONE specific, unambiguous correct answer (a name, date, number, place, or concept — typically 1-3 words).
- Be specific enough that a knowledgeable person could land the exact answer with confidence.
- Be the kind of fact that's slightly surprising or rewarding to know — favor unusual angles over common-knowledge framings.
- NOT mention the answer (or a synonym/translation of it) in the question text.
- NOT be a multiple-choice question — answer is free-text.
- Belong unambiguously to the category "${categoryName}". If the seed pulls you toward a different category, ignore it and stay in this one.

Return the question, the exact correct answer, and a 2-3 sentence explanation that makes the fact interesting.`,
    temperature: 0.7,
    maxTokens: 400,
  })

  if (!result.object.question || !result.object.correct_answer) {
    throw new Error('OpenAI response missing required fields')
  }

  return {
    question: result.object.question,
    correct_answer: result.object.correct_answer,
    explanation: result.object.explanation,
    difficulty,
    categoryName,
    seedSummary: seedStr,
  }
}

interface ReviewResult {
  accept: boolean
  reason: string | null
  inferred_category: string
}

async function reviewQuestion(apiKey: string, draft: DraftQuestion): Promise<ReviewResult> {
  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    schema: ReviewSchema,
    system:
      'You are a strict quality reviewer for trivia questions. You reject anything that would frustrate a player.',
    prompt: `Review this trivia question for the category "${draft.categoryName}".

Question: ${draft.question}
Correct answer: ${draft.correct_answer}
Explanation: ${draft.explanation}

Reject the question if ANY of these are true:
- The answer is unambiguously stated (or trivially translated) inside the question text.
- The question has multiple equally-valid answers — it must have ONE specific answer.
- The question is too vague to answer without options.
- The question is nonsensical, broken, or contradicts itself.
- The "correct answer" doesn't actually answer the question.
- The factual claim in the question or explanation is wrong.
- The question doesn't belong to the category "${draft.categoryName}" — pick the best-fitting category from this list:
  ${KNOWN_CATEGORIES.join(', ')}

Set accept=true ONLY if every check passes AND inferred_category equals "${draft.categoryName}".
If you reject, give a one-sentence rejection_reason. Otherwise rejection_reason is null.`,
    temperature: 0,
    maxTokens: 150,
  })

  return {
    accept: result.object.accept && result.object.inferred_category === draft.categoryName,
    reason: result.object.rejection_reason,
    inferred_category: result.object.inferred_category,
  }
}

const MAX_GENERATION_ATTEMPTS = 2

/**
 * Generate a single trivia question on the fly for Infinite Trivia.
 *
 * Two-stage pipeline:
 *   1. Draft generation (gpt-4o-mini, temp 0.7) using a random seed-word
 *      and modifier from the chosen category's bucket.
 *   2. Quality review (gpt-4o-mini, temp 0) that rejects questions
 *      that leak the answer, are vague, contradict themselves, are
 *      factually wrong, or fall outside the requested category.
 *
 * On rejection we retry once with a fresh seed/modifier before failing.
 * The /next route maps the throw to a 204 (pool exhausted), same as
 * any other generation failure.
 */
export async function generateInfiniteQuestion(
  options: GenerateInfiniteQuestionOptions = {}
): Promise<GeneratedQuestion> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  let lastReason = 'unknown'
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const draft = await generateDraft(apiKey, options)
    const review = await reviewQuestion(apiKey, draft)

    if (review.accept) {
      const id = `ai-infinite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      return {
        id,
        question: draft.question,
        correctAnswer: draft.correct_answer,
        explanation: draft.explanation,
        category: draft.categoryName,
        difficulty: draft.difficulty,
        type: 'free-text',
      }
    }

    lastReason = review.reason ?? `inferred=${review.inferred_category}`
    console.warn('[generateInfiniteQuestion] draft rejected', {
      attempt,
      category: draft.categoryName,
      seed: draft.seedSummary,
      reason: lastReason,
    })
  }

  throw new Error(
    `Generation failed quality gate after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastReason}`
  )
}

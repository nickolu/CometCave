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

/**
 * Generate a single trivia question on the fly for Infinite Trivia.
 * Picks a random category + seed/modifier combo so back-to-back calls don't collide.
 * Returns the AIQuestion shape sans auto-initialized counters; pair with saveAIQuestion().
 */
export async function generateInfiniteQuestion(
  options: GenerateInfiniteQuestionOptions = {}
): Promise<GeneratedQuestion> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const difficulty =
    options.difficulty ?? streakBiasedDifficulty(options.streak ?? 0)
  const categoryId = options.categoryId ?? pickCategoryId()
  const categoryName = getOpenTDBCategoryName(categoryId)
  const seeds = CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]
  const seedWord = pickRandom(seeds)
  const modifier = pickRandom(MODIFIERS)
  const seedStr = `${seedWord} :: ${modifier}`

  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient('gpt-4o'),
    schema: QuestionSchema,
    system:
      'You are a trivia question creator. Create a specific trivia question with a clear factual answer.',
    prompt: `Generate a ${difficulty} trivia question about the topic: "${seedStr}"
Category: ${categoryName}

Difficulty: ${difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[difficulty]}

The question should:
- Be specific enough that someone knowledgeable could guess the exact answer
- Not mention the answer in the question text
- Have a clear, specific correct answer (a name, date, number, place, or concept — typically 1-3 words)
- Be answerable without multiple choice options`,
    temperature: 0.7,
    maxTokens: 400,
  })

  const { question, correct_answer, explanation } = result.object
  if (!question || !correct_answer) {
    throw new Error('OpenAI response missing required fields')
  }

  const id = `ai-infinite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return {
    id,
    question,
    correctAnswer: correct_answer,
    explanation,
    category: categoryName,
    difficulty,
    type: 'free-text',
  }
}

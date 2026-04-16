import { z } from 'zod'

export const TriviaQuestionSchema = z.object({
  id: z.string(),
  source: z.enum(['opentdb', 'ai']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string(),
  question: z.string(),
  options: z.array(z.string()).optional(), // undefined for AI free-text
  correctAnswer: z.string(),
  explanation: z.string().optional(),
})
export type TriviaQuestion = z.infer<typeof TriviaQuestionSchema>

export const DailyTriviaSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  categoryId: z.number(),
  categoryName: z.string(),
  questions: z.array(TriviaQuestionSchema),
})
export type DailyTrivia = z.infer<typeof DailyTriviaSchema>

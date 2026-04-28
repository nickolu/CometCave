import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

export async function judgeAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const openaiClient = createOpenAI({ apiKey })
  const JudgeSchema = z.object({
    correct: z.boolean().describe('Whether the answer is correct or close enough'),
  })

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    schema: JudgeSchema,
    prompt: `You are a trivia answer judge. Determine if the user's answer is correct.

Question: "${question}"
Correct answer: "${correctAnswer}"
User's answer: "${userAnswer}"

Accept reasonable variations, minor spelling errors, and equivalent answers.
Be generous — if the core concept is correct, mark it correct.`,
    temperature: 0.1,
    maxTokens: 100,
  })

  return result.object.correct
}

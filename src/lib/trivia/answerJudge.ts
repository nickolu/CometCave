import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

// Reject answers that are obviously gaming the system rather than answering
const GAMING_PATTERNS = /^(correct|right|yes|true|the answer|answer|idk|i don'?t know|<correct>|<answer>|pass|skip|none|n\/a)$/i

export async function judgeAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<boolean> {
  const trimmed = userAnswer.trim()

  // Pre-check: reject obviously non-answers and gaming attempts
  if (!trimmed || trimmed.length < 2 || GAMING_PATTERNS.test(trimmed)) {
    return false
  }

  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const openaiClient = createOpenAI({ apiKey })
  const JudgeSchema = z.object({
    correct: z.boolean().describe('Whether the answer is correct or close enough'),
  })

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    schema: JudgeSchema,
    prompt: `You are a strict trivia answer judge. Determine if the user's answer is correct.

Question: "${question}"
Correct answer: "${correctAnswer}"
User's answer: "${trimmed}"

Rules:
- Accept reasonable variations, minor spelling errors, and equivalent answers.
- The user must provide a SPECIFIC answer that matches the correct answer.
- Do NOT accept generic words like "correct", "right", "yes", "true", or meta-answers like "<correct>".
- Do NOT accept answers that merely describe the category or topic without giving a specific answer.
- If the answer is vague or could apply to many questions, mark it INCORRECT.`,
    temperature: 0.1,
    maxTokens: 100,
  })

  return result.object.correct
}

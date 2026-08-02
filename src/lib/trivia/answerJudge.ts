import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

// Reject answers that are obviously gaming the system rather than answering
const GAMING_PATTERNS = /^(correct|right|yes|true|the answer|answer|idk|i don'?t know|<correct>|<answer>|pass|skip|none|n\/a)$/i

export async function judgeAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<boolean> {
  const trimmed = userAnswer.trim()

  // Pre-check: reject empty input and obvious gaming attempts.
  // (We deliberately don't enforce a minimum length — single-character
  // answers like "3" or "C" are legitimate for "how many" / musical-key
  // questions.)
  if (!trimmed || GAMING_PATTERNS.test(trimmed)) {
    return false
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const openaiClient = createOpenAI({ apiKey })
  const JudgeSchema = z.object({
    correct: z.boolean().describe('Whether the answer is correct or close enough'),
  })

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    prompt: `You are a friendly-but-fair trivia answer judge. Your job is to accept clearly-correct answers, including casual or shortened forms a person would naturally type when they know the answer. Reject only answers that genuinely don't match.

Question: "${question}"
Correct answer: "${correctAnswer}"
User's answer: "${trimmed}"

ACCEPT (mark correct=true) when the user's answer matches the correct answer in any of these ways:
- Numeric/word equivalence: "3" matches "three", "twelve" matches "12", "1.5 million" matches "1,500,000".
- Spelling variations and minor typos: "Pythagoras" / "Pithagoras", "Caesar" / "Cesar".
- Common abbreviations: "USA" / "United States", "WWII" / "World War 2" / "Second World War", "JFK" / "John F. Kennedy", "NYC" / "New York City".
- Subset matches when the question implies the level of specificity: if the question asks "what year" and the correct answer is "February 21, 1986", accept "1986". If the question asks for a person's last name and the correct answer is "Albert Einstein", accept "Einstein".
- Casing, punctuation, or article differences: "The Beatles" / "beatles", "Lord of the Rings" / "the lord of the rings".
- Plural/singular when the question doesn't pin one or the other.

REJECT (mark correct=false) when:
- The user gave a different specific answer (wrong fact).
- The user gave a vague/generic word that could apply to many questions: "correct", "right", "yes", "true", a category name, etc.
- The user gave only a meta-answer (e.g. "<answer>", "the answer").
- The user's answer is missing the key identifier the question asks for.

Default to ACCEPTING when the user clearly knows the answer but typed a casual or numeric form. Trivia is about knowing the fact, not about formatting.`,
    schema: JudgeSchema,
    temperature: 0,
    maxTokens: 100,
  })

  return result.object.correct
}

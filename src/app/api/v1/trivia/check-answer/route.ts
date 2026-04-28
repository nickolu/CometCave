import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { loadDailyQuestionsFromDisk } from '@/app/trivia/lib/loadDailyQuestions'
import { dailyCache } from '@/app/trivia/lib/questionCache'
import { getTodayPST } from '@/lib/dates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId, answer, date } = body

    if (!questionId || !answer || !date) {
      return NextResponse.json(
        { error: 'questionId, answer, and date are required.' },
        { status: 400 }
      )
    }

    const today = getTodayPST()
    if (date !== today) {
      return NextResponse.json(
        { error: "Can only check answers for today's trivia." },
        { status: 400 }
      )
    }

    // Look up the question in the shared cache, or load from disk
    let cachedQuestions = dailyCache.get(today)
    if (!cachedQuestions) {
      const fromDisk = loadDailyQuestionsFromDisk(today)
      if (fromDisk && fromDisk.length > 0) {
        dailyCache.set(today, fromDisk)
        cachedQuestions = fromDisk
      }
    }

    if (!cachedQuestions) {
      return NextResponse.json(
        { error: "Questions not loaded. Please fetch today's questions first." },
        { status: 404 }
      )
    }

    const question = cachedQuestions.find((q) => q.id === questionId)
    if (!question) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    }

    // For AI questions, use semantic matching via GPT
    if (question.source === 'ai') {
      let apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
      const headerApiKey = request.headers.get('x-openai-api-key')
      if (headerApiKey) apiKey = headerApiKey

      if (!apiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key required for AI question validation.' },
          { status: 500 }
        )
      }

      const openaiClient = createOpenAI({ apiKey })

      const JudgeSchema = z.object({
        correct: z.boolean().describe('Whether the answer is correct or close enough'),
      })

      const result = await generateObject({
        model: openaiClient('gpt-4o-mini'),
        schema: JudgeSchema,
        prompt: `You are a trivia answer judge. Determine if the user's answer is correct.

Question: "${question.question}"
Correct answer: "${question.correctAnswer}"
User's answer: "${answer}"

Accept reasonable variations, minor spelling errors, and equivalent answers.
Be generous — if the core concept is correct, mark it correct.`,
        temperature: 0.1,
        maxTokens: 100,
      })

      return NextResponse.json({
        correct: result.object.correct,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      })
    }

    // For OpenTDB questions, use exact string matching
    const correct =
      answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()

    return NextResponse.json({
      correct,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    })
  } catch (error) {
    console.error('Error checking answer:', error)
    return NextResponse.json(
      { error: 'Failed to check answer. Please try again.' },
      { status: 500 }
    )
  }
}

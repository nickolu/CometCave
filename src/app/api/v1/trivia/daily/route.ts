import { NextResponse } from 'next/server'

import { dailyCache } from '@/app/trivia/lib/questionCache'
import type { TriviaQuestion } from '@/app/trivia/models/questions'
import { getTodayPST } from '@/lib/dates'
import { getDailyQuestions, setDailyQuestions } from '@/lib/trivia/dailyQuestionsDb'
import {
  daysSinceEpoch,
  fetchOpenTDBQuestions,
  generateAIQuestion,
  generateFallbackQuestions,
} from '@/lib/trivia/generateDailyQuestions'

import type { NextRequest } from 'next/server'

// Re-export dailyCache so check-answer route can import it
export { dailyCache }

// Shuffle array deterministically using a seed (kept inline for the fallback path in this route)
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export async function GET(request: NextRequest) {
  try {
    const today = getTodayPST()
    const dateParam = request.nextUrl.searchParams.get('date')
    const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today

    if (targetDate > today) {
      return NextResponse.json({ error: 'Cannot load trivia for a future date.' }, { status: 400 })
    }

    // Check cache first
    if (dailyCache.has(targetDate)) {
      const cached = dailyCache.get(targetDate)!
      const questions: TriviaQuestion[] = cached.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ correctAnswer, explanation, ...q }) => q
      )
      return NextResponse.json({ date: targetDate, questions })
    }

    // PREFERRED: Load from Firestore
    const firestoreDoc = await getDailyQuestions(targetDate)
    if (firestoreDoc && firestoreDoc.questions.length > 0) {
      dailyCache.set(targetDate, firestoreDoc.questions)
      const questions: TriviaQuestion[] = firestoreDoc.questions.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ correctAnswer, explanation, ...q }) => q
      )
      return NextResponse.json({ date: targetDate, questions })
    }

    // FALLBACK: Generate questions on-the-fly if no Firestore doc exists
    console.warn(`No pre-generated questions for ${targetDate}, falling back to live generation`)

    // Resolve API key for AI question
    let apiKey = process.env.OPENAI_API_KEY
    const headerApiKey = request.headers.get('x-openai-api-key')
    if (headerApiKey) apiKey = headerApiKey

    // Fetch OpenTDB questions
    let opentdbQuestions = await fetchOpenTDBQuestions(targetDate)

    // If OpenTDB failed or returned too few, use AI fallback
    if (opentdbQuestions.length < 6 && apiKey) {
      const fallbacks = await generateFallbackQuestions(
        targetDate,
        6 - opentdbQuestions.length,
        apiKey
      )
      opentdbQuestions = [...opentdbQuestions, ...fallbacks]
    }

    // Generate AI question
    let allQuestions = [...opentdbQuestions]
    if (apiKey) {
      try {
        const aiQuestion = await generateAIQuestion(
          targetDate,
          opentdbQuestions[0]?.category || 'General Knowledge',
          apiKey
        )
        allQuestions.push(aiQuestion)
      } catch (error) {
        console.error('Failed to generate AI question:', error)
        // Continue without AI question
      }
    }

    // Shuffle question order deterministically
    const seed = daysSinceEpoch(targetDate)
    allQuestions = seededShuffle(allQuestions, seed)

    // Cache the full questions (with answers) server-side
    dailyCache.set(targetDate, allQuestions)

    // Persist to Firestore so future requests (and other instances) skip generation
    const days = daysSinceEpoch(targetDate)
    const categoryId = 9 + (days % 24)
    try {
      await setDailyQuestions(targetDate, {
        date: targetDate,
        categoryId,
        categoryName: allQuestions[0]?.category || 'General Knowledge',
        questions: allQuestions,
      })
    } catch (err) {
      console.error('Failed to persist generated daily trivia to Firestore:', err)
    }

    // Return questions WITHOUT answers
    const questions: TriviaQuestion[] = allQuestions.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ correctAnswer, explanation, ...q }) => q
    )
    return NextResponse.json({ date: targetDate, questions })
  } catch (error) {
    console.error('Error fetching daily trivia:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily trivia questions. Please try again.' },
      { status: 500 }
    )
  }
}

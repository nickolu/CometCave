import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getTodayPST } from '@/lib/dates'
import { dailyCache } from '@/app/trivia/lib/questionCache'
import { loadDailyQuestionsFromDisk } from '@/app/trivia/lib/loadDailyQuestions'
import type { TriviaQuestion, TriviaQuestionWithAnswer } from '@/app/trivia/models/questions'

// Re-export dailyCache so check-answer route can import it
export { dailyCache }

// HTML entity decoder
function decodeHTML(html: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&eacute;': 'é',
    '&ouml;': 'ö',
    '&uuml;': 'ü',
    '&ntilde;': 'ñ',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&hellip;': '…',
    '&ndash;': '–',
    '&mdash;': '—',
    '&shy;': '',
  }
  return html.replace(/&[#\w]+;/g, (match) => entities[match] ?? match)
}

// Shuffle array deterministically using a seed
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

// Calculate days since epoch for category rotation
function daysSinceEpoch(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00-08:00')
  return Math.floor(d.getTime() / 86400000)
}

interface OpenTDBQuestion {
  category: string
  type: string
  difficulty: string
  question: string
  correct_answer: string
  incorrect_answers: string[]
}

interface OpenTDBResponse {
  response_code: number
  results: OpenTDBQuestion[]
}

async function fetchOpenTDBQuestions(dateStr: string): Promise<TriviaQuestionWithAnswer[]> {
  const days = daysSinceEpoch(dateStr)
  const categoryId = 9 + (days % 24)

  // Fetch 6 questions: 3 easy, 2 medium, 1 hard
  // OpenTDB can be flaky, so we'll do separate calls per difficulty with fallbacks
  const difficulties: Array<{ difficulty: string; count: number }> = [
    { difficulty: 'easy', count: 3 },
    { difficulty: 'medium', count: 2 },
    { difficulty: 'hard', count: 1 },
  ]

  const questions: TriviaQuestionWithAnswer[] = []

  for (let idx = 0; idx < difficulties.length; idx++) {
    const { difficulty, count } = difficulties[idx]
    try {
      const url = `https://opentdb.com/api.php?amount=${count}&category=${categoryId}&difficulty=${difficulty}&type=multiple`
      const res = await fetch(url)
      const data: OpenTDBResponse = await res.json()

      if (data.response_code === 0 && data.results.length > 0) {
        for (const q of data.results) {
          const seed = days * 1000 + questions.length
          const options = seededShuffle(
            [q.correct_answer, ...q.incorrect_answers].map(decodeHTML),
            seed
          )

          questions.push({
            id: `opentdb-${dateStr}-${questions.length}`,
            question: decodeHTML(q.question),
            options,
            difficulty: difficulty as 'easy' | 'medium' | 'hard',
            category: decodeHTML(q.category),
            source: 'opentdb',
            correctAnswer: decodeHTML(q.correct_answer),
          })
        }
      }

      // Rate limit: wait between requests
      if (idx < difficulties.length - 1) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    } catch (error) {
      console.error(`Failed to fetch ${difficulty} questions from OpenTDB:`, error)
    }
  }

  return questions
}

async function generateAIQuestion(
  dateStr: string,
  category: string,
  apiKey: string
): Promise<TriviaQuestionWithAnswer> {
  const days = daysSinceEpoch(dateStr)

  const topics = [
    'Science',
    'History',
    'Geography',
    'Literature',
    'Art',
    'Music',
    'Film',
    'Technology',
    'Nature',
    'Space',
    'Philosophy',
    'Mathematics',
    'Language',
    'Sports',
    'Food',
    'Architecture',
    'Psychology',
    'Economics',
    'Medicine',
    'Mythology',
  ]
  const topic = topics[days % topics.length]

  const openaiClient = createOpenAI({ apiKey })

  const AIQuestionSchema = z.object({
    question: z.string().describe('An interesting, challenging trivia question'),
    correctAnswer: z.string().describe('The correct answer (short, 1-5 words)'),
    explanation: z.string().describe('Brief explanation of why this is the answer'),
  })

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    schema: AIQuestionSchema,
    prompt: `Generate a unique, challenging trivia question about ${topic}.
The question should be thought-provoking and have a specific, concise answer (1-5 words).
Today's date is ${dateStr} — use it as a seed for uniqueness.
Related category context: ${category}.
Make it interesting and educational.`,
    temperature: 0.7,
    maxTokens: 300,
  })

  return {
    id: `ai-${dateStr}-0`,
    question: result.object.question,
    options: null,
    difficulty: 'hard',
    category: topic,
    source: 'ai',
    correctAnswer: result.object.correctAnswer,
    explanation: result.object.explanation,
  }
}

async function generateFallbackQuestions(
  dateStr: string,
  needed: number,
  apiKey: string
): Promise<TriviaQuestionWithAnswer[]> {
  const days = daysSinceEpoch(dateStr)
  const openaiClient = createOpenAI({ apiKey })

  const difficultyMap = ['easy', 'easy', 'easy', 'medium', 'medium', 'hard'] as const
  const questions: TriviaQuestionWithAnswer[] = []

  for (let i = 0; i < needed; i++) {
    const diff = difficultyMap[i] || 'medium'
    const topics = [
      'Science',
      'History',
      'Geography',
      'Literature',
      'Art',
      'Music',
      'Film',
      'Technology',
      'Nature',
      'Space',
    ]
    const topic = topics[(days + i) % topics.length]

    const schema = z.object({
      question: z.string(),
      correctAnswer: z.string(),
      wrongAnswers: z.array(z.string()).length(3),
      category: z.string(),
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema,
      prompt: `Generate a ${diff} multiple choice trivia question about ${topic}. Date seed: ${dateStr}-${i}. Give exactly 3 wrong answers.`,
      temperature: 0.7,
      maxTokens: 300,
    })

    const seed = days * 1000 + questions.length
    const options = seededShuffle(
      [result.object.correctAnswer, ...result.object.wrongAnswers],
      seed
    )

    questions.push({
      id: `ai-fallback-${dateStr}-${i}`,
      question: result.object.question,
      options,
      difficulty: diff,
      category: result.object.category,
      source: 'ai',
      correctAnswer: result.object.correctAnswer,
    })
  }

  return questions
}

export async function GET(request: NextRequest) {
  try {
    const today = getTodayPST()

    // Check cache first
    if (dailyCache.has(today)) {
      const cached = dailyCache.get(today)!
      const questions: TriviaQuestion[] = cached.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ correctAnswer, explanation, ...q }) => q
      )
      return NextResponse.json({ date: today, questions })
    }

    // PREFERRED: Load pre-generated questions from disk (static JSON files)
    const preGenerated = loadDailyQuestionsFromDisk(today)
    if (preGenerated && preGenerated.length > 0) {
      dailyCache.set(today, preGenerated)
      // Clean old cache entries
      for (const key of dailyCache.keys()) {
        if (key !== today) dailyCache.delete(key)
      }
      const questions: TriviaQuestion[] = preGenerated.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ correctAnswer, explanation, ...q }) => q
      )
      return NextResponse.json({ date: today, questions })
    }

    // FALLBACK: Generate questions on-the-fly if no pre-generated file exists
    console.warn(`No pre-generated questions for ${today}, falling back to live generation`)

    // Resolve API key for AI question
    let apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
    const headerApiKey = request.headers.get('x-openai-api-key')
    if (headerApiKey) apiKey = headerApiKey

    // Fetch OpenTDB questions
    let opentdbQuestions = await fetchOpenTDBQuestions(today)

    // If OpenTDB failed or returned too few, use AI fallback
    if (opentdbQuestions.length < 6 && apiKey) {
      const fallbacks = await generateFallbackQuestions(
        today,
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
          today,
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
    const seed = daysSinceEpoch(today)
    allQuestions = seededShuffle(allQuestions, seed)

    // Cache the full questions (with answers) server-side
    dailyCache.set(today, allQuestions)

    // Clean old cache entries
    for (const key of dailyCache.keys()) {
      if (key !== today) dailyCache.delete(key)
    }

    // Return questions WITHOUT answers
    const questions: TriviaQuestion[] = allQuestions.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ correctAnswer, explanation, ...q }) => q
    )
    return NextResponse.json({ date: today, questions })
  } catch (error) {
    console.error('Error fetching daily trivia:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily trivia questions. Please try again.' },
      { status: 500 }
    )
  }
}

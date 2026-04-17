import fs from 'fs'
import path from 'path'
import type { TriviaQuestionWithAnswer } from '@/app/trivia/models/questions'

/**
 * Load pre-generated questions for a given PST date from the static JSON files.
 * Returns null if no file exists for that date.
 */
export function loadDailyQuestionsFromDisk(date: string): TriviaQuestionWithAnswer[] | null {
  const filePath = path.join(process.cwd(), 'src/app/trivia/data/questions', `${date}.json`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw) as {
      date: string
      questions: Array<{
        id: string
        question: string
        options?: string[]
        difficulty: 'easy' | 'medium' | 'hard'
        category: string
        source: 'opentdb' | 'ai'
        correctAnswer: string
        explanation?: string
      }>
    }

    // Normalize: API type expects options: string[] | null, but JSON may omit for AI
    return data.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options ?? null,
      difficulty: q.difficulty,
      category: q.category,
      source: q.source,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }))
  } catch (err) {
    console.error(`Failed to load daily questions for ${date}:`, err)
    return null
  }
}

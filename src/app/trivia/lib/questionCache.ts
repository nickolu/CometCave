import type { TriviaQuestionWithAnswer } from '@/app/trivia/models/questions'

// Shared in-memory cache keyed by date
// Exported so both the daily and check-answer routes can share it
export const dailyCache = new Map<string, TriviaQuestionWithAnswer[]>()

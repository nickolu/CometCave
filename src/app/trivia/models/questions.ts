export interface TriviaQuestion {
  id: string
  question: string
  options: string[] | null // null for AI free-text questions
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  source: 'opentdb' | 'ai'
}

// Internal type — includes answers (never sent to client)
export interface TriviaQuestionWithAnswer extends TriviaQuestion {
  correctAnswer: string
  explanation?: string
}

export interface DailyQuestionsResponse {
  date: string
  questions: TriviaQuestion[]
}

export interface CheckAnswerRequest {
  questionId: string
  answer: string
  date: string
}

export interface CheckAnswerResponse {
  correct: boolean
  correctAnswer: string
  explanation?: string
}

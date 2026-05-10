export interface TriviaAnswer {
  questionIndex: number
  correct: boolean
  points: number
  timeMs: number
}

export interface TriviaGameResult {
  date: string // YYYY-MM-DD PST
  score: number
  correct: number
  total: number
  answers: TriviaAnswer[]
  category?: { id: number; name: string; icon: string }
  playedAt?: string // ISO timestamp of when the game was actually played
  isRetroactive?: boolean // true if played after the original date
}

export interface TriviaStats {
  gamesPlayed: number
  totalScore: number
  totalCorrect: number
  totalQuestions: number
  currentStreak: number
  bestStreak: number
}

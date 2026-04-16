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
}

export interface TriviaStats {
  gamesPlayed: number
  totalScore: number
  totalCorrect: number
  totalQuestions: number
  currentStreak: number
  bestStreak: number
  weeklyWins: number
}

export interface TriviaUserData {
  displayName: string | null
  stats: TriviaStats
  history: TriviaGameResult[]
  lastPlayedDate: string | null
}

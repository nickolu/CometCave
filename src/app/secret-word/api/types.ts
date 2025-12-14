export interface AIResponseRequest {
  playerMessage: string
  aiSecretWord: string
  gameMessages: Array<{
    playerId: 'player' | 'ai'
    content: string
    timestamp: number
  }>
  isPlayerTurn?: boolean
}

export interface AIResponseResponse {
  response: string
  isQuestion: boolean
  confidence: number
  violation?: {
    type: 'ai_said_own_word'
    winner: 'player'
    reason: string
  }
}

export interface GenerateWordRequest {
  difficulty?: 'easy' | 'medium' | 'hard'
  avoidWords?: string[]
}

export interface GenerateWordResponse {
  word: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  hint: string
}

export interface APIError {
  error: string
}

export interface ScoreWordRequest {
  word: string
}

export interface ScoreWordResponse {
  score: number
}

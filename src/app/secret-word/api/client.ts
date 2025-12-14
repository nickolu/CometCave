import type {
  AIResponseRequest,
  AIResponseResponse,
  GenerateWordRequest,
  GenerateWordResponse,
  APIError,
  ScoreWordRequest,
  ScoreWordResponse,
} from './types'

const API_BASE = '/api/v1/secret-word'

async function post<TResponse>(
  endpoint: string,
  data: Record<string, unknown> | object
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: APIError = await response.json().catch(() => ({
      error: `HTTP error! status: ${response.status}`,
    }))
    throw new Error(errorData.error)
  }

  return response.json()
}

export const secretWordApi = {
  ai: {
    generateResponse: (request: AIResponseRequest) =>
      post<AIResponseResponse>('/ai-response', request),
    generateWord: (request: GenerateWordRequest = {}) =>
      post<GenerateWordResponse>('/generate-word', request),
    scoreWord: (request: ScoreWordRequest) => post<ScoreWordResponse>('/score-word', request),
  },
}

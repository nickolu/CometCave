import { AIServiceConfig } from './types'

export function getAIServiceConfig(): AIServiceConfig {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 150,
  }
}

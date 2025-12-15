import { useMutation } from '@tanstack/react-query'

import { secretWordApi } from './client'

import type { AIResponseRequest, GenerateWordRequest, ScoreWordRequest } from './types'

export function useAIResponse() {
  return useMutation({
    mutationFn: (request: AIResponseRequest) => secretWordApi.ai.generateResponse(request),
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  })
}

export function useGenerateWord() {
  return useMutation({
    mutationFn: (request: GenerateWordRequest = {}) => secretWordApi.ai.generateWord(request),
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  })
}

export function useScoreWord() {
  return useMutation({
    mutationFn: (request: ScoreWordRequest) => secretWordApi.ai.scoreWord(request),
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  })
}

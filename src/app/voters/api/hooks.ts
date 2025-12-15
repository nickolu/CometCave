'use client'

import { useMutation } from '@tanstack/react-query'

import { Vote, Voter, VotingCriteria } from '@/app/voters/types/voting'

// Types for API responses
interface GenerateRandomVoterResponse {
  voter: Voter
}

interface GenerateRandomQuestionResponse {
  question: string
  suggestedOptions?: string[]
}

interface GenerateCriteriaResponse {
  options: string[]
  tips?: string[]
}

type CastVoteResponse = Vote

interface GenerateSummaryResponse {
  summary: string
}

// API functions
const generateRandomVoter = async (
  existingVoters: Voter[]
): Promise<GenerateRandomVoterResponse> => {
  const response = await fetch('/api/v1/voters/generate-random-voter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      existingVoters,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate random voter')
  }

  return response.json()
}

const generateRandomQuestion = async (): Promise<GenerateRandomQuestionResponse> => {
  const response = await fetch('/api/v1/voters/generate-random-question', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to generate random question')
  }

  return response.json()
}

const generateCriteria = async (params: {
  question: string
  existingOptions: string[]
}): Promise<GenerateCriteriaResponse> => {
  const response = await fetch('/api/v1/voters/generate-criteria', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error('Failed to generate criteria')
  }

  return response.json()
}

const castVote = async (params: {
  voter: Voter
  criteria: VotingCriteria
  instance: number
}): Promise<CastVoteResponse> => {
  const response = await fetch('/api/v1/voters/cast-vote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

const generateSummary = async (params: {
  voterGroup: Voter
  votes: Vote[]
  criteria: VotingCriteria
}): Promise<GenerateSummaryResponse> => {
  const response = await fetch('/api/v1/voters/generate-summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error('Failed to generate summary')
  }

  return response.json()
}

// React Query hooks
export const useGenerateRandomVoter = () => {
  return useMutation({
    mutationFn: generateRandomVoter,
  })
}

export const useGenerateRandomQuestion = () => {
  return useMutation({
    mutationFn: generateRandomQuestion,
  })
}

export const useGenerateCriteria = () => {
  return useMutation({
    mutationFn: generateCriteria,
  })
}

export const useCastVote = () => {
  return useMutation({
    mutationFn: castVote,
  })
}

export const useGenerateSummary = () => {
  return useMutation({
    mutationFn: generateSummary,
  })
}

export interface Voter {
  id: string
  name: string
  description: string
  count: number
  modelConfig: {
    model: string
    temperature: number
    maxTokens: number
  }
}

export interface VotingCriteria {
  question: string
  options: string[]
}

export interface Vote {
  voterId: string
  voterName: string
  voterDescription: string
  choice: string
  reasoning: string
  instanceId: string
}

export interface VotingResults {
  votes: Vote[]
  summary: {
    totalVotes: number
    distribution: Record<string, number>
    groupSummaries: Record<string, string>
  }
}

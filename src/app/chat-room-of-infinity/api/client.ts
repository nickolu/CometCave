import type {
  Character,
  CharacterGeneratorResponse,
  CharacterResponse,
  ChatMessage,
  ConversationManagerResponse,
  SafetyResponse,
} from './types'

const API_BASE = '/api/v1/agent'

async function post<TResponse>(
  endpoint: string,
  data: Record<string, unknown>
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export const agentApi = {
  safety: {
    checkMessage: (message: string) => post<SafetyResponse>('/safety', { message }),
  },
  character: {
    getResponse: (character: Character, chatMessages: ChatMessage[]) =>
      post<CharacterResponse>('/character', { character, chatMessages }),
  },
  conversationManager: {
    getRespondingCharacters: (
      chatMessages: ChatMessage[],
      characters: Character[],
      charactersRespondToEachOther?: boolean
    ) =>
      post<ConversationManagerResponse>('/conversationManager', {
        chatMessages,
        characters,
        charactersRespondToEachOther,
      }),
  },
  characterGenerator: {
    generateCharacters: (previousCharacters: Character[], criteria: string) =>
      post<CharacterGeneratorResponse>('/characterGenerator', { previousCharacters, criteria }),
  },
}

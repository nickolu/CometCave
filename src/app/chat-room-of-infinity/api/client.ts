import type { 
  SafetyResponse,
  CharacterResponse,
  ConversationManagerResponse,
  CharacterGeneratorResponse,
  Character,
  ChatMessage
} from './types';

const API_BASE = '/api/v1/agent';

async function post<TResponse>(endpoint: string, data: Record<string, unknown>): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const agentApi = {
  safety: {
    checkMessage: (message: string) => 
      post<SafetyResponse>('/safety', { message }),
  },
  character: {
    getResponse: (character: Character, chatMessages: ChatMessage[]) =>
      post<CharacterResponse>('/character', { character, chatMessages }),
  },
  conversationManager: {
    getRespondingCharacters: (chatMessages: ChatMessage[], characters: Character[]) =>
      post<ConversationManagerResponse>('/conversationManager', { chatMessages, characters }),
  },
  characterGenerator: {
    generateCharacters: (previousCharacters: Character[], criteria: string) =>
      post<CharacterGeneratorResponse>('/characterGenerator', { previousCharacters, criteria }),
  },
};

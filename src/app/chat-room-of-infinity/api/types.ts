export interface SafetyResponse {
  safe: boolean;
  isSafe?: boolean; // For backward compatibility
  reason: string;
}

export interface CharacterResponse {
  response: string;
}

export interface ConversationManagerResponse {
  respondingCharacters: Character[];
}

export interface CharacterGeneratorResponse {
  newCharacters: Character[];
}

export interface Character {
  id: string;
  name: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  character: Character;
  message: string;
  timestamp: number;
}

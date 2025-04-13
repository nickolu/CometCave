export interface SafetyResponse {
  safe: boolean;
  reason: string;
}

export interface CharacterResponse {
  response: string;
}

export interface ConversationManagerResponse {
  respondingCharacter: Character;
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

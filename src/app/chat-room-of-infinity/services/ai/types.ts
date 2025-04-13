import { Character } from '../../types';

export interface SafetyCheckResponse {
  safe: boolean;
  reason: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIServiceConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIService {
  checkMessageSafety(message: string): Promise<SafetyCheckResponse>;
  generateResponse(messages: Message[]): Promise<string>;
  generateCharacterResponse(character: Character, messages: Message[]): Promise<string>;
}

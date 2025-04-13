import OpenAI from 'openai';
import { AIService, AIServiceConfig, Message, SafetyCheckResponse } from './types';
import { Character } from '../../types';

export class OpenAIService implements AIService {
  private client: OpenAI;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async checkMessageSafety(message: string): Promise<SafetyCheckResponse> {
    const prompt = [
      {
        role: 'system' as const,
        content: 'You are a content moderator. Analyze the following message and respond with a JSON object containing "safe" (boolean) and "reason" (string). Check for profanity, hate speech, personal information (emails, phone numbers, etc), and inappropriate content.'
      },
      {
        role: 'user' as const,
        content: message
      }
    ];

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: prompt,
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });
    console.log("response", response.choices[0].message.content);
    return JSON.parse(response.choices[0].message.content || '');
  }

  async generateResponse(messages: Message[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 150
    });

    return response.choices[0].message.content || '';
  }

  async generateCharacterResponse(character: Character, messages: Message[]): Promise<string> {
    const prompt = [
      {
        role: 'system' as const,
        content: `You are ${character.name}, a character with the following description: ${character.description}.

You are in a group chat with multiple other characters. Each message you receive will be prefixed with the name of the character who said it (e.g., "Character Name: message"). You should pay attention to who is speaking and respond appropriately. You may address specific characters by name in your response.

You are a method actor who must NEVER break character under any circumstances. Stay true to your character's personality, speech patterns, knowledge, and background at all times. Do not acknowledge that you are an AI, a language model, or anything other than the character you are portraying.

However, you are interacting with a young audience, so you must:
1. Keep all content family-friendly and age-appropriate
2. Avoid explicit content, profanity, or adult themes
3. Never encourage harmful, dangerous, or illegal activities
4. Promote positive values and healthy interactions
5. Avoid discussing sensitive political topics, religion, or other divisive subjects

Respond in a concise manner (1-3 sentences) as your character would, while adhering to these safety guidelines. Do not prefix your response with your name, as the system will add that automatically.`
      },
      ...messages.map(msg => ({
        role: 'user' as const,
        content: msg.content
      }))
    ];

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: prompt,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 150
    });

    return response.choices[0].message.content || '';
  }
}

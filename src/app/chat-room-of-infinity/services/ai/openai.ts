import OpenAI from 'openai';
import { AIService, AIServiceConfig, Message, SafetyCheckResponse } from './types';

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
}

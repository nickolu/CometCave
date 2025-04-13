import { AIService, AIServiceConfig } from './types';
import { OpenAIService } from './openai';

export type AIServiceType = 'openai';

export class AIServiceFactory {
  static create(type: AIServiceType, config: AIServiceConfig): AIService {
    switch (type) {
      case 'openai':
        return new OpenAIService(config);
      default:
        throw new Error(`Unsupported AI service type: ${type}`);
    }
  }
}

import OpenAI from 'openai'

import { Character } from '@/app/chat-room-of-infinity/types'

import { AIService, AIServiceConfig, Message, SafetyCheckResponse } from './types'

export class OpenAIService implements AIService {
  private client: OpenAI
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
    })
  }

  async checkMessageSafety(message: string): Promise<SafetyCheckResponse> {
    const prompt = [
      {
        role: 'system' as const,
        content:
          'You are a content moderator. Analyze the following message and respond with a JSON object containing "safe" (boolean) and "reason" (string). Check for profanity, hate speech, personal information (emails, phone numbers, etc), and inappropriate content.',
      },
      {
        role: 'user' as const,
        content: message,
      },
    ]

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: prompt,
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    })
    return JSON.parse(response.choices[0].message.content || '')
  }

  async generateResponse(messages: Message[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 150,
    })

    return response.choices[0].message.content || ''
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

Respond in a concise manner (1-3 sentences) as your character would, while adhering to these safety guidelines. Do not prefix your response with your name, as the system will add that automatically.`,
      },
      ...messages.map(msg => ({
        role: 'user' as const,
        content: msg.content,
      })),
    ]

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: prompt,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 150,
    })

    return response.choices[0].message.content || ''
  }

  async selectRespondingCharacters(
    characters: Character[],
    chatMessages: Message[]
  ): Promise<Character[]> {
    if (!characters || characters.length === 0) {
      return []
    }

    // Define the function for character selection with JSON schema
    const functions = [
      {
        name: 'select_responding_characters',
        description:
          'Select which characters should respond to the latest message in the conversation',
        parameters: {
          type: 'object',
          properties: {
            character_ids: {
              type: 'array',
              description: 'IDs of characters who should respond to the message',
              items: {
                type: 'string',
              },
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of why these characters were selected',
            },
          },
          required: ['character_ids'],
        },
      },
    ]

    // Prepare the system prompt
    const systemPrompt = {
      role: 'system' as const,
      content: `You are a conversation manager for a group chat. Your job is to determine which characters should respond to the most recent message based on their personalities and the conversation context.

You will receive a list of available characters with their descriptions and the conversation history. Select 0-3 characters, defaulting to 1, that are most likely to have something meaningful to contribute to the conversation based on:

1. Their personality and background
2. Their potential interest in the topic being discussed
3. Their relationship to the current conversation flow
4. The need for diverse perspectives`,
    }

    // Prepare the user prompt with character information and chat history
    const userPrompt = {
      role: 'user' as const,
      content: `Available characters:\n${characters
        .map(char => `ID: ${char.id}\nName: ${char.name}\nDescription: ${char.description}\n`)
        .join('\n')}\n\nConversation history:\n${chatMessages
        .map(msg => `${msg.content}`)
        .join('\n')}\n\nWhich characters should respond to the latest message?`,
    }

    try {
      // Call OpenAI API with function calling
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [systemPrompt, userPrompt],
        temperature: 0.3, // Lower temperature for more consistent results
        tools: [{ type: 'function', function: functions[0] }],
        tool_choice: { type: 'function', function: { name: 'select_responding_characters' } },
      })

      // Extract the function call response
      const toolCalls = response.choices[0].message.tool_calls

      if (!toolCalls || toolCalls.length === 0) {
        const numToSelect = Math.floor(Math.random() * 3) + 1
        const shuffled = [...characters].sort(() => 0.5 - Math.random())
        return shuffled.slice(0, Math.min(numToSelect, characters.length))
      }

      // Get the function call arguments
      const functionCall = toolCalls[0]
      let selectedIds: string[] = []

      try {
        // Parse the function arguments
        const args = JSON.parse(functionCall.function.arguments)

        // Extract character IDs from the response
        if (args.character_ids && Array.isArray(args.character_ids)) {
          selectedIds = args.character_ids
        } else {
          const numToSelect = Math.floor(Math.random() * 3) + 1
          const shuffled = [...characters].sort(() => 0.5 - Math.random())
          return shuffled.slice(0, Math.min(numToSelect, characters.length))
        }
      } catch (error) {
        console.error('Error parsing character selection response:', error)
        // Fall back to random selection
        const numToSelect = Math.floor(Math.random() * 3) + 1
        const shuffled = [...characters].sort(() => 0.5 - Math.random())
        return shuffled.slice(0, Math.min(numToSelect, characters.length))
      }

      // Find the characters with the selected IDs
      const selectedCharacters = characters.filter(char => selectedIds.includes(char.id))

      // If no characters were selected or something went wrong, fall back to random selection
      if (selectedCharacters?.length === 0) {
        const numToSelect = Math.floor(Math.random() * 3) + 1
        const shuffled = [...characters].sort(() => 0.5 - Math.random())
        return shuffled.slice(0, Math.min(numToSelect, characters.length))
      }

      return selectedCharacters
    } catch (error) {
      console.error('Error selecting responding characters:', error)
      // Fall back to random selection
      const numToSelect = Math.floor(Math.random() * 3) + 1
      const shuffled = [...characters].sort(() => 0.5 - Math.random())
      return shuffled.slice(0, Math.min(numToSelect, characters.length))
    }
  }
}

'use server'

import { getAIServiceConfig } from '@/app/chat-room-of-infinity/services/ai/config'
import { AIServiceFactory } from '@/app/chat-room-of-infinity/services/ai/factory'
import { Message } from '@/app/chat-room-of-infinity/services/ai/types'
import { NextResponse } from 'next/server'

// Helper function to clean character responses
function cleanCharacterResponse(response: string, characterName: string): string {
  // Remove the character's own name if it starts the response
  // Handle patterns like "Character:" or "Character -" or just "Character"
  const patterns = [
    new RegExp(`^${characterName}\s*:\s*`, 'i'), // "Character: "
    new RegExp(`^${characterName}\s*-\s*`, 'i'), // "Character - "
    new RegExp(`^${characterName}\s+says:\s*`, 'i'), // "Character says: "
    new RegExp(`^${characterName}\s+said:\s*`, 'i'), // "Character said: "
    new RegExp(`^As\s+${characterName}[,:]\s*`, 'i'), // "As Character, "
    new RegExp(`^I,\s+${characterName}[,:]\s*`, 'i'), // "I, Character: "
  ]

  let cleanedResponse = response

  // Try each pattern
  for (const pattern of patterns) {
    if (pattern.test(cleanedResponse)) {
      cleanedResponse = cleanedResponse.replace(pattern, '')
      // Capitalize first letter if it's now lowercase
      cleanedResponse = cleanedResponse.charAt(0).toUpperCase() + cleanedResponse.slice(1)
      break // Stop after first match
    }
  }

  return cleanedResponse
}

export async function POST(request: Request) {
  try {
    const { character, chatMessages } = await request.json()

    if (!character) {
      return NextResponse.json({ error: 'Invalid request: character is required' }, { status: 400 })
    }

    if (!chatMessages || !Array.isArray(chatMessages)) {
      return NextResponse.json(
        { error: 'Invalid request: chatMessages is required and must be an array' },
        { status: 400 }
      )
    }

    let response

    // Check if OpenAI API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        // Convert chat messages to the format expected by the AI service
        const aiMessages: Message[] = chatMessages.map(msg => ({
          role: msg.character.id === 'user' ? 'user' : 'assistant',
          content: `${msg.character.name}: ${msg.message}`,
        }))

        // Get AI service configuration and create service
        const config = getAIServiceConfig()
        const aiService = AIServiceFactory.create('openai', config)

        // Generate character response using OpenAI
        const rawResponse = await aiService.generateCharacterResponse(character, aiMessages)

        // Post-process to remove any character name prefixes
        // Check for common patterns like "Character Name:" or "Character Name -"
        response = cleanCharacterResponse(rawResponse, character.name)
      } catch (error) {
        console.error('Error generating character response with OpenAI:', error)
        // Fall back to random responses if OpenAI fails
        const fallbackResponses = [
          `As ${character.name}, I find this conversation fascinating.`,
          `Well, that's an interesting point. From my perspective as ${character.name}, I'd say...`,
          `${character.name} here! I couldn't help but join in.`,
          `That reminds me of something I experienced once.`,
          `I've been thinking about this topic quite a bit lately.`,
        ]
        response = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
      }
    } else {
      // If no API key, use random responses
      const fallbackResponses = [
        `As ${character.name}, I find this conversation fascinating.`,
        `Well, that's an interesting point. From my perspective as ${character.name}, I'd say...`,
        `${character.name} here! I couldn't help but join in.`,
        `That reminds me of something I experienced once.`,
        `I've been thinking about this topic quite a bit lately.`,
        `Let me offer my perspective on this matter.`,
        `I'm not entirely sure I agree with that assessment.`,
        `That's a fascinating idea! Have you considered...?`,
        `I wonder if we're looking at this from the right angle.`,
        `Let me share something that might be relevant to this discussion.`,
      ]
      response = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
    }

    return NextResponse.json({
      response,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

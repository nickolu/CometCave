'use server';

import { NextResponse } from 'next/server';
import { AIServiceFactory } from '@/app/chat-room-of-infinity/services/ai/factory';
import { getAIServiceConfig } from '@/app/chat-room-of-infinity/services/ai/config';
import { Message } from '@/app/chat-room-of-infinity/services/ai/types';

export async function POST(request: Request) {
  try {
    const { chatMessages, characters } = await request.json();

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: chatMessages is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!characters || !Array.isArray(characters) || characters.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: characters is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    let respondingCharacters;
    
    // Check if OpenAI API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        // Convert chat messages to the format expected by the AI service
        const aiMessages: Message[] = chatMessages.map(msg => ({
          role: msg.character.id === 'user' ? 'user' : 'assistant',
          content: `${msg.character.name}: ${msg.message}`
        }));
        
        // Get AI service configuration and create service
        const config = getAIServiceConfig();
        const aiService = AIServiceFactory.create('openai', config);
        
        try {
          // Use AI to select which characters should respond
          respondingCharacters = await aiService.selectRespondingCharacters(characters, aiMessages);
          
          // Verify we got valid characters back
          if (!respondingCharacters || !Array.isArray(respondingCharacters) || respondingCharacters.length === 0) {
            console.log('No characters selected by AI, falling back to random selection');
            // Fall back to random selection
            const numberOfResponders = Math.floor(Math.random() * 3) + 1;
            const shuffledCharacters = [...characters].sort(() => 0.5 - Math.random());
            respondingCharacters = shuffledCharacters.slice(0, Math.min(numberOfResponders, characters.length));
          } else {
            console.log('AI selected responding characters:', respondingCharacters.map(c => c.name));
          }
        } catch (aiError) {
          console.error('Error in AI character selection:', aiError);
          // Fall back to random selection
          const numberOfResponders = Math.floor(Math.random() * 3) + 1;
          const shuffledCharacters = [...characters].sort(() => 0.5 - Math.random());
          respondingCharacters = shuffledCharacters.slice(0, Math.min(numberOfResponders, characters.length));
        }
      } catch (error) {
        console.error('Error selecting responding characters with AI:', error);
        // Fall back to random selection
        const numberOfResponders = Math.floor(Math.random() * 3) + 1;
        const shuffledCharacters = [...characters].sort(() => 0.5 - Math.random());
        respondingCharacters = shuffledCharacters.slice(0, Math.min(numberOfResponders, characters.length));
      }
    } else {
      // If no API key, use random selection
      const numberOfResponders = Math.floor(Math.random() * 3) + 1;
      const shuffledCharacters = [...characters].sort(() => 0.5 - Math.random());
      respondingCharacters = shuffledCharacters.slice(0, Math.min(numberOfResponders, characters.length));
    }

    return NextResponse.json({
      respondingCharacters
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

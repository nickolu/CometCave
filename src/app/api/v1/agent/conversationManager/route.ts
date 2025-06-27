'use server';

import { NextResponse } from 'next/server';
import { AIServiceFactory } from '@/app/chat-room-of-infinity/services/ai/factory';
import { getAIServiceConfig } from '@/app/chat-room-of-infinity/services/ai/config';
import { Message } from '@/app/chat-room-of-infinity/services/ai/types';
import { Character } from '@/app/chat-room-of-infinity/types';

interface ConversationManagerRequest {
  chatMessages: {
    id: string;
    character: {
      id: string;
      name: string;
    };
    message: string;
    timestamp: number;
  }[];
  characters: Character[];
  charactersRespondToEachOther?: boolean;
}

export async function POST(request: Request) {
  try {
    const { chatMessages, characters, charactersRespondToEachOther } =
      (await request.json()) as ConversationManagerRequest;

    // Check if the last message is from a character and if characters shouldn't respond to each other
    const lastMessage = chatMessages[chatMessages.length - 1];
    const isLastMessageFromCharacter = lastMessage && lastMessage.character.id !== 'user';

    // Count consecutive character messages at the end of the conversation
    let consecutiveCharacterMessages = 0;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].character.id !== 'user') {
        consecutiveCharacterMessages++;
      } else {
        // Found a user message, stop counting
        break;
      }
    }

    // Get the last 3 messages to check for recent responders
    const recentMessages = chatMessages.slice(-3);
    const recentResponderIds = recentMessages
      .filter(msg => msg.character.id !== 'user')
      .map(msg => msg.character.id);

    // Calculate number of consecutive character messages at the end of the conversation
    let consecutiveCharacterResponses = 0;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.character.id === 'user') {
        // Found a user message, stop counting
        break;
      }
      consecutiveCharacterResponses++;
    }

    // STRICT ENFORCEMENT: Hard limit - never allow more than one character response in a row
    // regardless of charactersRespondToEachOther setting
    if (consecutiveCharacterResponses >= 1) {
      return new Response(JSON.stringify({ respondingCharacters: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Skip character responses if the last message was from a character and we don't want characters to respond to each other
    if (isLastMessageFromCharacter && !charactersRespondToEachOther) {
      return new Response(JSON.stringify({ respondingCharacters: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
          content: `${msg.character.name}: ${msg.message}`,
        }));

        // Get AI service configuration and create service
        const config = getAIServiceConfig();
        const aiService = AIServiceFactory.create('openai', config);

        try {
          // Filter out characters who have recently responded
          const eligibleCharacters = characters.filter(
            char => !recentResponderIds.includes(char.id)
          );

          // If no eligible characters (all have recently responded), use all characters
          const charactersToConsider =
            eligibleCharacters.length > 0 ? eligibleCharacters : characters;

          // Use AI to select which characters should respond from eligible characters
          respondingCharacters = await aiService.selectRespondingCharacters(
            charactersToConsider,
            aiMessages
          );

          // Verify we got valid characters back
          if (
            !respondingCharacters ||
            !Array.isArray(respondingCharacters) ||
            respondingCharacters.length === 0
          ) {
            // Fall back to random selection
            const shuffledCharacters = [...charactersToConsider].sort(() => 0.5 - Math.random());
            respondingCharacters = shuffledCharacters;
          }
        } catch (aiError) {
          console.error('Error in AI character selection:', aiError);
          // Filter out characters who have recently responded
          const eligibleCharacters = characters.filter(
            char => !recentResponderIds.includes(char.id)
          );

          // If no eligible characters (all have recently responded), use all characters
          const charactersToConsider =
            eligibleCharacters.length > 0 ? eligibleCharacters : characters;

          // Fall back to random selection
          const shuffledCharacters = [...charactersToConsider].sort(() => 0.5 - Math.random());
          respondingCharacters = shuffledCharacters;
        }
      } catch (error) {
        console.error('Error selecting responding characters with AI:', error);
        // Fall back to random selection
        const shuffledCharacters = [...characters].sort(() => 0.5 - Math.random());
        respondingCharacters = shuffledCharacters;
      }
    } else {
      // Filter out characters who have recently responded
      const eligibleCharacters = characters.filter(char => !recentResponderIds.includes(char.id));

      // If no eligible characters (all have recently responded), use all characters
      const charactersToConsider = eligibleCharacters.length > 0 ? eligibleCharacters : characters;

      // If no API key, use random selection
      const shuffledCharacters = [...charactersToConsider].sort(() => 0.5 - Math.random());
      respondingCharacters = shuffledCharacters;
    }

    return NextResponse.json({
      respondingCharacters,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

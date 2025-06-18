import { type NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const AIResponseSchema = z.object({
  response: z.string().describe('The AI response to the player message or question'),
  isQuestion: z.boolean().describe('Whether this response is a question or a statement'),
  confidence: z.number().min(0).max(1).describe('AI confidence in its response (0-1)'),
});

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment variable or request header
    let apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
    const headerApiKey = request.headers.get('x-openai-api-key');

    if (headerApiKey) {
      apiKey = headerApiKey;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please provide an API key.' },
        { status: 500 }
      );
    }

    const { playerMessage, aiSecretWord, gameMessages } = await request.json();

    if (!playerMessage || typeof playerMessage !== 'string') {
      return NextResponse.json(
        { error: 'playerMessage is required and must be a string' },
        { status: 400 }
      );
    }

    if (!aiSecretWord || typeof aiSecretWord !== 'string') {
      return NextResponse.json(
        { error: 'aiSecretWord is required and must be a string' },
        { status: 400 }
      );
    }

    // Build conversation context
    const conversationHistory = Array.isArray(gameMessages)
      ? gameMessages
          .map(
            (msg: { playerId: string; content: string }) =>
              `${msg.playerId === 'player' ? 'Player' : 'AI'}: ${msg.content}`
          )
          .join('\n')
      : '';

    const prompt = `You are playing the Secret Word game with a human player. Here are the rules:

CRITICAL RULES:
1. Your secret word is: "${aiSecretWord}"
2. You must NEVER say your secret word "${aiSecretWord}" in any response
3. Try to get the player to say your secret word "${aiSecretWord}"
4. You must answer all questions truthfully 
5. You can ask questions to try to get the player to say their secret word, the player must answer them truthfully
6. You can make statements or give answers
7. Try your hardest to win

GAME CONTEXT:
- This is a turn-based word guessing game
- The player is trying to make you say their secret word
- You are trying to make the player say your secret word
- If you say your own word "${aiSecretWord}" or the players word,you lose immediately
- If the player says your secret word "${aiSecretWord}", you win immediately
- You must be truthful in all answers

CONVERSATION SO FAR:
${conversationHistory}

PLAYER'S LATEST MESSAGE: "${playerMessage}"

Your task: Respond to the player's message. You can either:
1. Answer their question truthfully (without saying "${aiSecretWord}")
2. Ask a strategic question to learn about their secret word
3. Make a statement that might trick them

Be clever and strategic, but always truthful. About 60% of the time, ask a question back. 40% of the time, give a direct answer or statement.

REMEMBER: Do not include the word "${aiSecretWord}" anywhere in your response!`;

    const openaiClient = createOpenAI({
      apiKey,
    });

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: AIResponseSchema,
      prompt,
      temperature: 0.8, // Higher temperature for more varied/creative responses
      maxTokens: 200,
    });

    // Double-check that the AI didn't include its secret word
    const responseText = result.object.response.toLowerCase();
    const secretWordLower = aiSecretWord.toLowerCase();

    if (responseText.includes(secretWordLower)) {
      // AI accidentally said its secret word - player wins
      return NextResponse.json({
        response: result.object.response,
        isQuestion: result.object.isQuestion,
        confidence: result.object.confidence,
        violation: {
          type: 'ai_said_own_word',
          winner: 'player',
          reason: `AI said its own word: "${aiSecretWord}"`,
        },
      });
    }

    return NextResponse.json({
      response: result.object.response,
      isQuestion: result.object.isQuestion,
      confidence: result.object.confidence,
    });
  } catch (error) {
    console.error('Error generating AI response:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API key is invalid or missing. Please check your API key.' },
          { status: 401 }
        );
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded. Please check your OpenAI account.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate AI response. Please try again.' },
      { status: 500 }
    );
  }
}

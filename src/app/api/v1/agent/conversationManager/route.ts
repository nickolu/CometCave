'use server';

import { NextResponse } from 'next/server';

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

    // Select 1-3 random characters to respond
    const numberOfResponders = Math.floor(Math.random() * 3) + 1;
    const shuffledCharacters = [...characters].sort(() => 0.5 - Math.random());
    const respondingCharacters = shuffledCharacters.slice(0, Math.min(numberOfResponders, characters.length));
    
    // Note: In the future, we'll implement OpenAI integration here to make smarter character selection
    // This will involve:
    // 1. Creating an AI prompt with character information and conversation history
    // 2. Using the OpenAI API to determine which characters should respond
    // 3. Parsing the response to get character IDs
    // 4. Filtering the characters list to return only those characters

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

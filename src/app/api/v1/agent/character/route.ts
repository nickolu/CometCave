'use server';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { character, chatMessages } = await request.json();

    if (!character) {
      return NextResponse.json(
        { error: 'Invalid request: character is required' },
        { status: 400 }
      );
    }

    if (!chatMessages || !Array.isArray(chatMessages)) {
      return NextResponse.json(
        { error: 'Invalid request: chatMessages is required and must be an array' },
        { status: 400 }
      );
    }

    // Generate a realistic response based on the character's personality
    // For now, this is just a placeholder - in the future we'll use AI
    const responses = [
      `As ${character.name}, I find this conversation fascinating.`,
      `Well, that's an interesting point. From my perspective as ${character.name}, I'd say...`,
      `${character.name} here! I couldn't help but join in.`,
      `That reminds me of something I experienced once.`,
      `I've been thinking about this topic quite a bit lately.`,
      `Let me offer my perspective on this matter.`,
      `I'm not entirely sure I agree with that assessment.`,
      `That's a fascinating idea! Have you considered...?`,
      `I wonder if we're looking at this from the right angle.`,
      `Let me share something that might be relevant to this discussion.`
    ];

    const randomIndex = Math.floor(Math.random() * responses.length);
    const response = responses[randomIndex];

    return NextResponse.json({
      response
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

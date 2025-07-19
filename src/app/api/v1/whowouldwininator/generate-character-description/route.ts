import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { READING_LEVEL } from '../constants';

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Character name is required' }, { status: 400 });
    }

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await generateText({
      model: openaiClient('gpt-4o-mini'),
      prompt: `Who is "${name}"?

The description should:
- Be 1-2 sentences long
- Include their appearance, abilities, and personality traits
- Be engaging and vivid
- Keep the writing at a ${READING_LEVEL} reading level.

Generate a compelling description for "${name}":`,
      temperature: 0.8,
      maxTokens: 200,
    });

    return NextResponse.json({ description: result.text });
  } catch (error) {
    console.error('Error generating character description:', error);
    return NextResponse.json(
      { error: 'Failed to generate character description' },
      { status: 500 }
    );
  }
}

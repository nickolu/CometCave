import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await generateText({
      model: openaiClient('gpt-4o-mini'),
      prompt: `Generate a detailed backstory for a character named "${name}" with the following description: ${description}

The backstory should:
- Be 2-3 paragraphs long
- Explain their origin and how they gained their abilities
- Include key events that shaped their personality
- Make them compelling for a battle scenario
- Be consistent with their description`,
      temperature: 0.8,
      maxTokens: 400,
    });

    return NextResponse.json({ backstory: result.text });
  } catch (error) {
    console.error('Error generating character backstory:', error);
    return NextResponse.json({ error: 'Failed to generate character backstory' }, { status: 500 });
  }
}

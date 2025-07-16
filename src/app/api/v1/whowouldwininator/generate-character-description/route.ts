import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

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
      prompt: `Generate a detailed character description for a character named "${name}".

The description should:
- Be 2-3 sentences long
- Include their appearance, abilities, and personality traits
- Make them suitable for a battle scenario
- Be engaging and vivid
- Focus on combat-relevant characteristics
- Avoid being too generic - make them unique and interesting

Examples of good descriptions:
- "A towering warrior clad in ancient dragon-scale armor, wielding a flaming sword that burns with the fury of a thousand suns. His eyes glow with mystical power, and his battle-scarred face tells of countless victories against impossible odds."
- "A nimble assassin who moves like liquid shadow, her twin daggers dripping with paralyzing venom. She can phase through solid matter at will and strikes with deadly precision from the darkness."
- "A brilliant scientist mutated by his own experiments, now possessing four mechanical arms and a genius-level intellect. His body crackles with electrical energy, and he can manipulate technology with his mind."

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

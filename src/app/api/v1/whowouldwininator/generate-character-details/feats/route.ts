import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { CharacterFeatsSchema } from '../../types';

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: CharacterFeatsSchema,
      prompt: `Generate a list of notable feats and accomplishments for a character named "${name}" with the following description: ${description}

Requirements:
- Generate 3-5 impressive feats that demonstrate the character's capabilities
- Each feat should be a specific accomplishment or demonstrated ability
- Each feat should be associated with one of the following character stats: strength, speed, durability, intelligence, special abilities, fighting
- Feats should be consistent with the character's description and power level
- Include both combat and non-combat achievements where appropriate
- Make feats concrete and measurable when possible
- Avoid vague statements like "very strong" - be specific

Examples of good feats:
- "Defeated an army of 1,000 soldiers single-handedly"
- "Lifted a 50-ton boulder with one hand"
- "Survived a direct nuclear blast"
- "Traveled faster than light across galaxies"
- "Mastered 47 different martial arts"
- "Solved the Riddle of the Sphinx"
- "Resurrected from complete disintegration"`,
      temperature: 0.8,
      maxTokens: 250,
    });

    return NextResponse.json({ feats: result.object.feats });
  } catch (error) {
    console.error('Error generating character feats:', error);
    return NextResponse.json({ error: 'Failed to generate character feats' }, { status: 500 });
  }
}

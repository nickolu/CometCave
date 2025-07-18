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
      prompt: `Generate a list of notable feats and accomplishments performed by "${name}" (${description}))

Requirements:
- Each feat should be related to one of the following character stats: strength, speed, durability, intelligence, special abilities, fighting
- Use feats that occurred in the canon of the character
- Choose feats that are relevant for determining the character's likelikhood of winning a fight or other contest

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

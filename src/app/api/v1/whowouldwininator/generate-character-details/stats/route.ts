import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { CharacterStatsSchema } from '../../types';

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: CharacterStatsSchema,
      prompt: `Generate combat stats for a character named "${name}" with the following description: ${description}

Rate each stat on a 1-10 scale where:
- 1-2: Below Average/Weak
- 3-4: Average Human Level
- 5-6: Enhanced/Above Average
- 7-8: Superhuman/Exceptional
- 9-10: Godlike/Cosmic Level

Stats to evaluate:
- Strength: Physical power and lifting capacity
- Speed: Movement speed, reflexes, and agility
- Durability: Resistance to damage, healing, and endurance
- Intelligence: Strategic thinking, problem-solving, and knowledge
- Energy: Magical power, energy projection, and supernatural abilities
- Fighting: Combat skills, martial arts, and battle experience

Consider the character's description carefully and rate them realistically. A normal human would typically have 3-4 in most stats, while cosmic beings might have 9-10.`,
      temperature: 0.5, // Lower temperature for more consistent stat generation
      maxTokens: 150,
    });

    return NextResponse.json({ stats: result.object });
  } catch (error) {
    console.error('Error generating character stats:', error);
    return NextResponse.json({ error: 'Failed to generate character stats' }, { status: 500 });
  }
}

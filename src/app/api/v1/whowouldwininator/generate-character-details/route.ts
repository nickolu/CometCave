import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { CharacterDetailsSchema } from '../types';

export async function POST(request: Request) {
  const openaiClient = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const result = await generateObject({
    model: openaiClient('gpt-4o-mini'),
    schema: CharacterDetailsSchema,
    prompt: `Generate a name and description for a character.`,
    temperature: 0.8, // Higher temperature for more varied/creative responses
    maxTokens: 200,
  });
  return NextResponse.json({ result });
}

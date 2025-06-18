import { type NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Schema describing the expected structure of the LLM response
const WordFrequencySchema = z.object({
  score: z.number().min(0).max(100).describe('Frequency score for the provided word (0–100)'),
  label: z
    .string()
    .describe('Short label describing the frequency band (e.g., "Ultra-common function words")'),
});

export async function POST(request: NextRequest) {
  try {
    // Resolve OpenAI API key – prefer header over env for per-request overrides
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

    const { word } = await request.json();

    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'The request body must include a "word" field of type string.' },
        { status: 400 }
      );
    }

    // Prompt instructing the LLM to assign a frequency band score and label
    const prompt = `You are tasked with evaluating the approximate frequency of English words in everyday usage. Use the frequency bands below to score the provided word. Output must strictly follow the provided JSON schema.

FREQUENCY BANDS:
0–9   → Ultra-common function words  (e.g., the · of · and · to · a · in)
10–19 → Very common helpers & pronouns (e.g., you · that · have · this · they · will)
20–29 → Everyday concrete content words (e.g., people · time · make · go · good · get)
30–39 → Common descriptive words (e.g., family · story · break · decide · bright · carry)
40–49 → Moderately common "general academic" words (e.g., concept · improve · request · perform · assume · typical)
50–59 → Mid-frequency workplace/college words (e.g., maintain · strategy · context · visible · precise · survey)
60–69 → Somewhat uncommon specialist words (e.g., catalyst · allocate · foliage · rigorous · turbulent · diminish)
70–79 → Uncommon advanced vocabulary (e.g., benevolent · succinct · myriad · perilous · obsolete · eloquent)
80–89 → Rare literary / technical terms (e.g., cacophony · fulcrum · ephemeral · obfuscate · galvanize · ideogram)
90–100 → Very rare, archaic, or esoteric words (e.g., perspicacious · apocryphal · effulgent · uxorious · oneirocritic · floccinaucinihilipilification)

WORD TO SCORE: "${word}"

For the given word, return an object with:
- "score": an integer from 0–100 that falls into one of the bands above
- "label": the exact rough frequency label from the table (e.g., "Ultra-common function words")

Respond ONLY with a JSON object matching the schema.`;

    const openaiClient = createOpenAI({ apiKey });

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: WordFrequencySchema,
      prompt,
      temperature: 0.2, // Low temperature to keep answers deterministic
      maxTokens: 100,
    });

    return NextResponse.json({
      score: result.object.score,
      label: result.object.label,
    });
  } catch (error) {
    console.error('Error scoring word frequency:', error);

    // Provide clearer error messaging where possible
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
      { error: 'Failed to score the word. Please try again later.' },
      { status: 500 }
    );
  }
}

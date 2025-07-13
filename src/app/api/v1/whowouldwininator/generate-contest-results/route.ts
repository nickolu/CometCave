import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { ContestResultsSchema } from '../types';

export async function POST(request: Request) {
  try {
    // Check content length before parsing to prevent large payloads
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 4000000) {
      // 4MB limit
      return NextResponse.json(
        { error: 'Request too large. Please reduce character descriptions and details.' },
        { status: 413 }
      );
    }

    const body = await request.json();

    // Validate and extract data
    const {
      candidate1Name,
      candidate1Description,
      candidate2Name,
      candidate2Description,
      battleScenario,
    } = body;

    // Validate required fields
    if (!candidate1Name || !candidate2Name) {
      return NextResponse.json({ error: 'Both character names are required' }, { status: 400 });
    }

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build concise scenario description
    const scenarioSummary =
      battleScenario?.setting || battleScenario?.rules || battleScenario?.additionalContext
        ? `Scenario: ${[
            battleScenario.setting,
            battleScenario.rules,
            battleScenario.obstacles,
            battleScenario.limitations,
            battleScenario.additionalContext,
          ]
            .filter(Boolean)
            .join(' | ')}`
        : 'Standard battle scenario';

    // Concise prompt to avoid payload limits
    const prompt = `Analyze this battle and determine the winner:

CHARACTER 1:
name: ${candidate1Name}
description: ${candidate1Description}

CHARACTER 2:
name: ${candidate2Name}
description: ${candidate2Description}

${scenarioSummary}

Instructions:
- Analyze abilities, stats, and context
- Determine winner: "candidate1", "candidate2", or "tie"
- Provide confidence (1-10): 1-3=uncertain, 4-6=moderate, 7-8=high, 9-10=certain
- Give brief reasoning (max 200 words)

Examples:
- Superman vs human in combat = candidate1 wins, confidence 10
- Evenly matched opponents = tie, confidence 8-10`;

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: ContestResultsSchema,
      prompt,
      temperature: 0.3,
      maxTokens: 300, // Reduced to keep response concise
    });

    return NextResponse.json({
      winner: result.object.winner,
      confidence: result.object.confidence,
      reasoning: result.object.reasoning,
    });
  } catch (error) {
    console.error('Error generating contest results:', error);

    // Handle specific payload errors
    if (error instanceof Error && error.message.includes('413')) {
      return NextResponse.json(
        {
          error:
            'Character data too large. Please reduce the length of descriptions, backstories, and lists.',
        },
        { status: 413 }
      );
    }

    return NextResponse.json({ error: 'Failed to generate contest results' }, { status: 500 });
  }
}

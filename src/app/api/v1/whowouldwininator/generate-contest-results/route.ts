import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { ContestResultsSchema } from '../types';

// Helper function to truncate text to prevent payload overflow
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper function to truncate arrays
function truncateArray<T>(arr: T[], maxItems: number): T[] {
  return arr.slice(0, maxItems);
}

// Helper function to build a concise character summary
function buildCharacterSummary(
  name: string,
  description: string,
  details: Record<string, unknown>
): string {
  const summary = [`${name}: ${truncateText(description, 200)}`];

  if (details.backstory && typeof details.backstory === 'string') {
    summary.push(`Background: ${truncateText(details.backstory, 300)}`);
  }

  if (details.powers && Array.isArray(details.powers)) {
    const powers = truncateArray(details.powers, 5).map(p => truncateText(String(p), 50));
    summary.push(`Powers: ${powers.join(', ')}`);
  }

  if (details.stats && typeof details.stats === 'object' && details.stats !== null) {
    const stats = details.stats as Record<string, unknown>;
    const statsStr = `Stats: STR:${stats.strength} SPD:${stats.speed} DUR:${stats.durability} INT:${stats.intelligence} SPC:${stats.specialAbilities} FGT:${stats.fighting}`;
    summary.push(statsStr);
  }

  if (details.feats && Array.isArray(details.feats)) {
    const feats = truncateArray(details.feats, 3).map(f => truncateText(String(f), 100));
    summary.push(`Key Feats: ${feats.join(', ')}`);
  }

  return summary.join('\n');
}

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
      candidate1Details,
      candidate2Name,
      candidate2Description,
      candidate2Details,
      battleScenario,
    } = body;

    // Validate required fields
    if (!candidate1Name || !candidate2Name) {
      return NextResponse.json({ error: 'Both character names are required' }, { status: 400 });
    }

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build concise character summaries to avoid payload limits
    const char1Summary = buildCharacterSummary(
      candidate1Name,
      candidate1Description || 'No description provided',
      candidate1Details || {}
    );

    const char2Summary = buildCharacterSummary(
      candidate2Name,
      candidate2Description || 'No description provided',
      candidate2Details || {}
    );

    // Build concise scenario description
    const scenarioSummary =
      battleScenario?.setting || battleScenario?.rules || battleScenario?.additionalContext
        ? `Scenario: ${truncateText(
            [
              battleScenario.setting,
              battleScenario.rules,
              battleScenario.obstacles,
              battleScenario.limitations,
              battleScenario.additionalContext,
            ]
              .filter(Boolean)
              .join(' | '),
            400
          )}`
        : 'Standard battle scenario';

    // Concise prompt to avoid payload limits
    const prompt = `Analyze this battle and determine the winner:

CHARACTER 1:
${char1Summary}

CHARACTER 2:
${char2Summary}

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

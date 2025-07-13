import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const {
      candidate1Name,
      candidate1Description,
      candidate2Name,
      candidate2Description,
      battleScenario,
      contestResults,
    } = await request.json();

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build scenario description
    const scenarioDescription =
      battleScenario.setting ||
      battleScenario.rules ||
      battleScenario.obstacles ||
      battleScenario.limitations ||
      battleScenario.additionalContext
        ? `Battle Scenario:
        Setting: ${battleScenario.setting || 'Open field with no obstacles'}
        Rules: ${battleScenario.rules || 'Standard combat, fight until one character is knocked out or unable to continue'}
        Obstacles: ${battleScenario.obstacles || 'None'}
        Limitations: ${battleScenario.limitations || 'None'}
        Additional Context: ${battleScenario.additionalContext || 'Both characters are at peak abilities from their respective canon'}`
        : `Battle Scenario: Standard TKO battle in an open field with both characters at peak abilities from their respective canon`;

    // Build character profiles
    const candidate1Profile = `
Character 1: ${candidate1Name}
Description: ${candidate1Description}
    `;

    const candidate2Profile = `
Character 2: ${candidate2Name}
Description: ${candidate2Description}
    `;

    // Determine winner name for story consistency
    let winnerName = '';
    if (contestResults.winner === 'candidate1') {
      winnerName = candidate1Name;
    } else if (contestResults.winner === 'candidate2') {
      winnerName = candidate2Name;
    }

    const result = await generateText({
      model: openaiClient('gpt-4o-mini'),
      prompt: `Write a cinematic description of the battle/contest between these two characters. The story should be consistent with the predetermined outcome.

${candidate1Profile}

${candidate2Profile}

${scenarioDescription}

Contest Outcome:
- Winner: ${contestResults.winner === 'tie' ? 'Tie - both characters are evenly matched' : `${winnerName} wins`}
- Confidence: ${contestResults.confidence}/10
- Reasoning: ${contestResults.reasoning}

Instructions:
- Write a dramatic, cinematic story of 3-4 paragraphs
- Show both characters using their abilities and powers
- Make the story consistent with the predetermined outcome
- Include vivid action sequences and descriptions
- Build tension and excitement
- Show the decisive moment that leads to the outcome
- If it's a tie, show how both characters reach their limits simultaneously
- Keep the tone exciting and engaging like a movie scene

The story should read like an epic battle scene from a movie or book, with detailed descriptions of the action, the environment, and the characters' abilities in use.`,
      temperature: 0.8, // Higher temperature for more creative storytelling
      maxTokens: 800,
    });

    return NextResponse.json({
      story: result.text,
    });
  } catch (error) {
    console.error('Error generating contest story:', error);
    return NextResponse.json({ error: 'Failed to generate contest story' }, { status: 500 });
  }
}

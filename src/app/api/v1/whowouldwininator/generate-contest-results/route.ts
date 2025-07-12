import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { ContestResultsSchema } from '../types';

export async function POST(request: Request) {
  try {
    const {
      candidate1Name,
      candidate1Description,
      candidate1Details,
      candidate2Name,
      candidate2Description,
      candidate2Details,
      battleScenario,
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
${candidate1Details.backstory ? `Backstory: ${candidate1Details.backstory}` : ''}
${candidate1Details.powers ? `Powers: ${candidate1Details.powers.join(', ')}` : ''}
${candidate1Details.stats ? `Stats (1-100 scale): Strength: ${candidate1Details.stats.strength}, Speed: ${candidate1Details.stats.speed}, Durability: ${candidate1Details.stats.durability}, Intelligence: ${candidate1Details.stats.intelligence}, Special Abilities: ${candidate1Details.stats.specialAbilities}, Fighting: ${candidate1Details.stats.fighting}` : ''}
${candidate1Details.feats ? `Notable Feats: ${candidate1Details.feats.join(', ')}` : ''}
    `;

    const candidate2Profile = `
Character 2: ${candidate2Name}
Description: ${candidate2Description}
${candidate2Details.backstory ? `Backstory: ${candidate2Details.backstory}` : ''}
${candidate2Details.powers ? `Powers: ${candidate2Details.powers.join(', ')}` : ''}
${candidate2Details.stats ? `Stats (1-100 scale): Strength: ${candidate2Details.stats.strength}, Speed: ${candidate2Details.stats.speed}, Durability: ${candidate2Details.stats.durability}, Intelligence: ${candidate2Details.stats.intelligence}, Special Abilities: ${candidate2Details.stats.specialAbilities}, Fighting: ${candidate2Details.stats.fighting}` : ''}
${candidate2Details.feats ? `Notable Feats: ${candidate2Details.feats.join(', ')}` : ''}
    `;

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: ContestResultsSchema,
      prompt: `Analyze this battle scenario and determine the winner with a confidence score:

${candidate1Profile}

${candidate2Profile}

${scenarioDescription}

Instructions:
- Carefully analyze each character's abilities, stats, powers, and feats
- Consider how the specific scenario affects the outcome
- Determine if one character would clearly win, or if it would be a tie
- Provide a confidence score from 1-10 where:
  - 1-3: Very uncertain, could go either way
  - 4-6: Moderate confidence, slight advantage
  - 7-8: High confidence, clear advantage
  - 9-10: Almost certain, overwhelming advantage
- A tie is possible if the characters are extremely evenly matched
- Provide detailed reasoning for your decision

Examples:
- Superman vs ordinary human in combat = candidate1 wins, confidence 10
- Superman vs ordinary human in chess = could be candidate2 wins, confidence 5
- Two identical characters = tie, confidence 10

Winner should be:
- "candidate1" if the first character wins
- "candidate2" if the second character wins  
- "tie" if they are evenly matched`,
      temperature: 0.3, // Lower temperature for more consistent analysis
      maxTokens: 500,
    });

    return NextResponse.json({
      winner: result.object.winner,
      confidence: result.object.confidence,
      reasoning: result.object.reasoning,
    });
  } catch (error) {
    console.error('Error generating contest results:', error);
    return NextResponse.json({ error: 'Failed to generate contest results' }, { status: 500 });
  }
}

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const config = {
  maxDuration: 300, // 5 minutes in seconds
};

export const runtime = 'nodejs';

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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build scenario description for image prompt
    const scenarioDescription = battleScenario.setting || 'open field';

    // Determine winner for image composition
    let winnerName = '';
    if (contestResults.winner === 'candidate1') {
      winnerName = candidate1Name;
    } else if (contestResults.winner === 'candidate2') {
      winnerName = candidate2Name;
    }

    // Initial image generation prompt
    let imagePrompt = '';
    if (contestResults.winner === 'tie') {
      imagePrompt = `An epic battle scene showing two powerful characters locked in combat in ${scenarioDescription}. Character 1: ${candidate1Description}. Character 2: ${candidate2Description}. Both characters are evenly matched, showing equal power and determination. The scene should be dramatic and cinematic, with dynamic action, energy effects, and dramatic lighting. The composition should show both characters as equals in the frame.`;
    } else {
      imagePrompt = `An epic battle scene showing the decisive moment where ${winnerName} defeats their opponent in ${scenarioDescription}. Winner: ${contestResults.winner === 'candidate1' ? candidate1Description : candidate2Description}. Opponent: ${contestResults.winner === 'candidate1' ? candidate2Description : candidate1Description}. The scene should be dramatic and cinematic, showing the winner in a triumphant pose while the opponent is clearly defeated.`;
    }

    console.log(
      `Contest image generation attempt 1 for ${candidate1Name} vs ${candidate2Name}:`,
      imagePrompt
    );

    // Progressive safety easing - try up to 5 times with increasingly safe prompts
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Generate the actual image using GPT-Image-1
        const imageResponse = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024',
        });

        const imageB64 = imageResponse.data?.[0]?.b64_json;

        if (!imageB64) {
          throw new Error('No image data returned from OpenAI');
        }

        // Convert base64 to data URL
        const imageUrl = `data:image/png;base64,${imageB64}`;

        // Generate alt text description
        const altTextResult = await generateText({
          model: openaiClient('gpt-4o-mini'),
          prompt: `Create a detailed alt text description for a contest image showing: ${imagePrompt}

Return a concise but descriptive alt text that would help someone understand what the image shows, focusing on:
- The two characters and their appearance
- The action taking place
- The setting and environment
- The outcome (winner/tie)
- Key visual elements

Keep it under 200 characters.`,
          temperature: 0.7,
          maxTokens: 100,
        });

        return NextResponse.json({
          imageUrl: imageUrl,
          altText: altTextResult.text,
          prompt: imagePrompt,
          attempt: attempt,
        });
      } catch (error: unknown) {
        console.error(`Contest image generation attempt ${attempt} failed:`, error);

        if (attempt < 3) {
          // Generate a safer prompt for the next attempt
          try {
            const errorMessage = error instanceof Error ? error.message : 'a safety error';
            const safetyResult = await generateText({
              model: openaiClient('gpt-4o-mini'),
              prompt: `This image generation prompt failed due to ${errorMessage}. Please respond with a new prompt that addresses the concerns of the previous failure, but remains as close to what the user is asking for as possible. If the user was asking for a generation of a copyrighted character, for example, try describing that character in vague terms that are not specific to that character, or describing details that allude to the character without saying it outright. e.g. "left webbing behind", "a lean but muscular young man in a tight fitting superhero costume, swinging from a white rope", etc.

Original prompt: ${imagePrompt}

New safer prompt:`,
              temperature: 0.5,
              maxTokens: 200,
            });

            imagePrompt = safetyResult.text;
            console.log(`Retrying with safer prompt (attempt ${attempt + 1}):`, imagePrompt);
          } catch (safetyError) {
            console.error('Failed to generate safer prompt:', safetyError);
            // If we can't generate a safer prompt, make a generic one
            imagePrompt = `A generic fantasy battle scene between two warriors in ${scenarioDescription}, with dramatic lighting and cinematic composition`;
          }
        } else {
          // Final fallback after 3 attempts
          console.log('All contest image generation attempts failed, using default image');
          return NextResponse.json({
            imageUrl: '/placeholder.jpg',
            altText: `A contest scene between ${candidate1Name} and ${candidate2Name} in ${scenarioDescription}`,
            prompt: 'Default fallback image',
            attempt: attempt,
            fallback: true,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error generating contest results image:', error);
    return NextResponse.json(
      { error: 'Failed to generate contest results image' },
      { status: 500 }
    );
  }
}

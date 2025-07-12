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
    const { name, description } = await request.json();

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initial image generation prompt
    let imagePrompt = `A detailed portrait of a character named "${name}" with the following description: ${description}

The portrait should:
- Show the character in a heroic pose
- Capture their unique features and abilities
- Be suitable for a battle scenario context
- Have dramatic lighting and composition
- Be in a realistic art style`;

    // Progressive safety easing - try up to 3 times with increasingly safe prompts
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Portrait generation attempt ${attempt} for ${name}:`, imagePrompt);

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
          prompt: `Create a detailed alt text description for an image of: ${imagePrompt}

Return a concise but descriptive alt text that would help someone understand what the image shows, focusing on:
- Physical appearance and distinctive features
- Pose and expression
- Key visual elements
- Overall mood

Keep it under 200 characters.`,
          temperature: 0.7,
          maxTokens: 100,
        });

        return NextResponse.json({
          portrait: {
            imageUrl: imageUrl,
            altText: altTextResult.text,
            prompt: imagePrompt,
            attempt: attempt,
          },
        });
      } catch (error: unknown) {
        console.error(`Portrait generation attempt ${attempt} failed:`, error);

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
            imagePrompt = `A generic fantasy character portrait in a heroic pose, suitable for a battle scenario, with dramatic lighting and realistic art style`;
          }
        } else {
          // Final fallback after 3 attempts
          console.log('All image generation attempts failed, using default image');
          return NextResponse.json({
            portrait: {
              imageUrl: '/placeholder-user.jpg',
              altText: `A generic portrait of a character named "${name}". ${description}`,
              prompt: 'Default fallback image',
              attempt: attempt,
              fallback: true,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error generating character portrait:', error);
    return NextResponse.json({ error: 'Failed to generate character portrait' }, { status: 500 });
  }
}

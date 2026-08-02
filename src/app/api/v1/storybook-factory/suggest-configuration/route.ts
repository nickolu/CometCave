import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SuggestionSchema = z.object({
  storyType: z.enum(['comic', 'storybook', 'fairy-tale', 'adventure']),
  artStyle: z.enum(['cartoon', 'anime', 'watercolor', 'pixel-art', 'realistic']),
  pageCount: z.number().min(4).max(24),
  tone: z.enum(['funny', 'dramatic', 'scary', 'heartwarming']),
  panelsPerPage: z.number().min(2).max(6),
  dialogueStyle: z.enum(['speech-bubbles', 'narration-boxes', 'mixed']),
  reasoning: z.string().describe('Brief explanation of why these settings suit the story'),
})

export async function POST(request: Request) {
  try {
    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const { caption1, caption2, storyDirectionPrompt } = await request.json()

    if (caption1 && caption1.length > 500) {
      return NextResponse.json({ error: 'caption1 must be 500 characters or fewer.' }, { status: 400 })
    }
    if (caption2 && caption2.length > 500) {
      return NextResponse.json({ error: 'caption2 must be 500 characters or fewer.' }, { status: 400 })
    }
    if (storyDirectionPrompt && storyDirectionPrompt.length > 1000) {
      return NextResponse.json({ error: 'storyDirectionPrompt must be 1000 characters or fewer.' }, { status: 400 })
    }

    const imageDescriptions = [
      caption1 ? `Image 1: "${caption1}"` : 'Image 1: (no caption provided)',
      caption2 ? `Image 2: "${caption2}"` : 'Image 2: (no caption provided)',
    ].join('\n')

    const directionNote = storyDirectionPrompt
      ? `Story direction: "${storyDirectionPrompt}"`
      : 'Story direction: (none provided)'

    const prompt = `You are a creative story advisor helping someone create an illustrated story from their personal photos.

Based on the image descriptions and story direction below, suggest the best configuration for their story. Comic book format is your default recommendation unless the content clearly calls for something else.

${imageDescriptions}
${directionNote}

Choose settings that best suit the content and mood of the images. For example:
- Pets or playful subjects → comic, cartoon, funny
- Nature or landscapes → storybook or fairy-tale, watercolor, heartwarming
- Action or adventure themes → comic or adventure, cartoon or anime, dramatic
- Cute/wholesome subjects → storybook, watercolor or cartoon, heartwarming

Suggest a page count appropriate for a personal illustrated story (8 is a good default; 4-6 for short stories, 12-16 for longer ones).

Provide a brief, friendly reasoning (1-2 sentences) explaining your choices.`

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: SuggestionSchema,
      prompt,
      temperature: 0.7,
      maxTokens: 300,
    })

    return NextResponse.json({
      storyType: result.object.storyType,
      artStyle: result.object.artStyle,
      pageCount: result.object.pageCount,
      tone: result.object.tone,
      panelsPerPage: result.object.panelsPerPage,
      dialogueStyle: result.object.dialogueStyle,
      reasoning: result.object.reasoning,
    })
  } catch (error) {
    console.error('Error generating story configuration suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions. Using default settings.' },
      { status: 500 }
    )
  }
}

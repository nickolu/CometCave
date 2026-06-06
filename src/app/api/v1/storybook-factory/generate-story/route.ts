import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const maxDuration = 300

const StoryPanelSchema = z.object({
  type: z.enum(['illustration', 'text', 'speech-bubble', 'narration-box', 'sound-effect']),
  content: z
    .string()
    .describe(
      'For illustrations: detailed image generation prompt. For text/speech/narration: the actual text content.'
    ),
  character: z
    .string()
    .optional()
    .describe('For speech bubbles: the name of the character speaking'),
  position: z.object({
    x: z.number().min(0).max(100).describe('Horizontal position as percentage'),
    y: z.number().min(0).max(100).describe('Vertical position as percentage'),
    width: z.number().min(0).max(100).describe('Width as percentage'),
    height: z.number().min(0).max(100).describe('Height as percentage'),
  }),
})

const StoryPageSchema = z.object({
  pageNumber: z.number(),
  layout: z.enum([
    'full-image',
    'image-left-text-right',
    'text-over-image',
    'comic-grid',
    'split',
  ]),
  panels: z.array(StoryPanelSchema),
  backgroundColor: z.string().optional(),
})

const StoryLayoutSchema = z.object({
  title: z.string().describe('The title of the story'),
  type: z.enum(['comic', 'storybook', 'fairy-tale', 'adventure']),
  pages: z.array(StoryPageSchema),
})

export async function POST(request: Request) {
  try {
    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const { caption1, caption2, storyDirectionPrompt, storyConfig } = await request.json()

    const imageDescriptions = [
      caption1 ? `Image 1: "${caption1}"` : 'Image 1: (no caption provided)',
      caption2 ? `Image 2: "${caption2}"` : 'Image 2: (no caption provided)',
    ].join('\n')

    const directionNote = storyDirectionPrompt
      ? `Story direction: "${storyDirectionPrompt}"`
      : 'Story direction: (none provided)'

    const configSummary = storyConfig
      ? `Story configuration:
- Story type: ${storyConfig.storyType}
- Art style: ${storyConfig.artStyle}
- Page count: ${storyConfig.pageCount}
- Tone: ${storyConfig.tone}
- Panels per page: ${storyConfig.panelsPerPage}
- Dialogue style: ${storyConfig.dialogueStyle}
${storyConfig.additionalNotes ? `- Additional notes: ${storyConfig.additionalNotes}` : ''}`
      : 'Story configuration: (use defaults)'

    const prompt = `You are a creative story writer and layout artist. Generate a complete illustrated story broken into pages with detailed panel layouts.

${imageDescriptions}
${directionNote}

${configSummary}

Generate exactly ${storyConfig?.pageCount ?? 8} pages.

LAYOUT RULES by story type:
- comic: Use comic-grid layout. Include speech-bubble panels with character attribution, narration-box panels for scene setting, and sound-effect panels for action moments. Each page should have ${storyConfig?.panelsPerPage ?? 4} panels arranged in a grid.
- storybook: Use full-image or image-left-text-right layouts. Include illustration panels (full or half page) with narration-box panels for storytelling text.
- fairy-tale: Use text-over-image layouts. Include large illustration panels with elegant narration text overlaid or beneath.
- adventure: Use split or image-left-text-right layouts. Mix illustration panels with text panels, occasional speech bubbles for key moments.

DIALOGUE STYLE RULES:
- speech-bubbles: Prefer speech-bubble type panels for character dialogue
- narration-boxes: Prefer narration-box type panels for story text
- mixed: Use both speech-bubble and narration-box panels

PANEL RULES:
- Each panel has a position with x, y, width, height as 0-100 percentages of the page
- Panels should not overlap (or minimally for intentional layering effects)
- illustration panel content must be a detailed image generation prompt that includes the art style: ${storyConfig?.artStyle ?? 'cartoon'}. Describe scene, characters, mood, lighting.
- text/speech/narration/sound-effect panel content is the actual text to display

TONE: ${storyConfig?.tone ?? 'funny'} — let this affect the story mood, dialogue, and illustration descriptions.

Create a cohesive story with a beginning, middle, and end. Characters should be consistent across pages. The story should incorporate both subjects from the image descriptions.`

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: StoryLayoutSchema,
      prompt,
      temperature: 0.8,
      maxTokens: 4096,
    })

    return NextResponse.json({
      layout: result.object,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating story layout:', error)
    return NextResponse.json({ error: 'Failed to generate story. Please try again.' }, { status: 500 })
  }
}

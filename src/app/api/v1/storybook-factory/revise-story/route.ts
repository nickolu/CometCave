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

    const { revisionPrompt, currentLayout, storyConfig } = await request.json()

    if (revisionPrompt && revisionPrompt.length > 1000) {
      return NextResponse.json({ error: 'revisionPrompt must be 1000 characters or fewer.' }, { status: 400 })
    }

    if (!revisionPrompt || !currentLayout) {
      return NextResponse.json(
        { error: 'revisionPrompt and currentLayout are required' },
        { status: 400 }
      )
    }

    const configSummary = storyConfig
      ? `Story configuration:
- Story type: ${storyConfig.storyType}
- Art style: ${storyConfig.artStyle}
- Tone: ${storyConfig.tone}
- Dialogue style: ${storyConfig.dialogueStyle}`
      : ''

    const currentLayoutJson = JSON.stringify(currentLayout, null, 2)

    const prompt = `You are a creative story editor. You have a story layout in JSON format, and the user wants to revise it.

Current story layout:
${currentLayoutJson}

${configSummary}

User's revision request: "${revisionPrompt}"

Instructions:
- Apply the user's revision intelligently to the story
- If the revision targets a specific page or character, focus changes there and keep other pages unchanged
- If the revision is global (e.g., "make it funnier", "change the tone"), apply it throughout
- Maintain the same story type, art style, and panel structure unless the revision explicitly requests changes
- For illustration panels, update the image generation prompt to reflect the revision
- For text panels, update the actual text content
- Keep the same number of pages and panels unless revision explicitly asks for more/fewer
- Return the COMPLETE revised story layout — all pages, all panels
- Maintain story consistency: characters should remain consistent, narrative should flow

Return the complete revised StoryLayout.`

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: StoryLayoutSchema,
      prompt,
      temperature: 0.7,
      maxTokens: 4096,
    })

    return NextResponse.json({
      layout: result.object,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error revising story layout:', error)
    return NextResponse.json({ error: 'Failed to revise story. Please try again.' }, { status: 500 })
  }
}

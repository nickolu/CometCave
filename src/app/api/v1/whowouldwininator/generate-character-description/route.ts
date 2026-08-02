import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { READING_LEVEL } from '@/app/api/v1/whowouldwininator/constants'

const RequestSchema = z.object({
  name: z.string().min(1, 'Character name is required').max(200),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parseResult = RequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.errors[0]?.message ?? 'Invalid request' }, { status: 400 })
    }

    const { name } = parseResult.data

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result = await generateText({
      model: openaiClient('gpt-4o-mini'),
      prompt: `Who is "${name}"?

The description should:
- Be 1-2 sentences long
- Include their appearance, abilities, and personality traits
- Be engaging and vivid
- Keep the writing at a ${READING_LEVEL} reading level.

Generate a compelling description for "${name}":`,
      temperature: 0.8,
      maxTokens: 200,
    })

    return NextResponse.json({ description: result.text })
  } catch (error) {
    console.error('Error generating character description:', error)
    return NextResponse.json({ error: 'Failed to generate character description' }, { status: 500 })
  }
}

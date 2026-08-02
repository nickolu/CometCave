import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'

import { READING_LEVEL } from '@/app/api/v1/whowouldwininator/constants'
import { CharacterFeatsSchema } from '@/app/api/v1/whowouldwininator/types'

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }
    if (name.length > 200) {
      return NextResponse.json({ error: 'name must be 200 characters or fewer.' }, { status: 400 })
    }
    if (description && description.length > 1000) {
      return NextResponse.json({ error: 'description must be 1000 characters or fewer.' }, { status: 400 })
    }

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: CharacterFeatsSchema,
      prompt: `Generate a list of notable feats and accomplishments performed by "${name}" (${description}))

Requirements:
- Each feat should be related to one of the following character stats: strength, speed, durability, intelligence, special abilities, fighting
- Use feats that occurred in the canon of the character

Examples:
- "Fell 30 feet onto concrete and stood up unharmed"
- "Lifted a 50-ton boulder with one hand"
- "Survived a direct nuclear blast"
- "Traveled faster than light across galaxies"
- "Mastered 47 different martial arts"
- "Solved the Riddle of the Sphinx"
- "Resurrected from complete disintegration"

Keep the writing at a ${READING_LEVEL} reading level.
`,
      temperature: 0.8,
      maxTokens: 250,
    })

    return NextResponse.json({ feats: result.object.feats })
  } catch (error) {
    console.error('Error generating character feats:', error)
    return NextResponse.json({ error: 'Failed to generate character feats' }, { status: 500 })
  }
}

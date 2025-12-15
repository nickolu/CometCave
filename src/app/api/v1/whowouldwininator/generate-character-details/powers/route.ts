import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'

import { CharacterPowersSchema } from '../../types'

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json()

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: CharacterPowersSchema,
      prompt: `Generate a list of powers and abilities for a character named "${name}" with the following description: ${description}

Requirements:
- Generate 3-10 specific powers/abilities
- Each power should be concise but descriptive (1-2 words or short phrase)
- Powers should be consistent with the character's description
- Make powers suitable for combat scenarios
- Only include powers the character has in their canon

Examples of good powers:
- "Flame Manipulation"
- "Telepathic Reading"
- "Expert Survival Skills"
- "Teleportation"
- "Time Manipulation"
- "Healing Factor"
- "Invincibility"
- "Flight"
- "Energy Absorption"
- "Super Strength"
- "Super Speed"
- "Omniscience"
- "Spell Casting"`,
      temperature: 0.7,
      maxTokens: 200,
    })

    return NextResponse.json({ powers: result.object.powers })
  } catch (error) {
    console.error('Error generating character powers:', error)
    return NextResponse.json({ error: 'Failed to generate character powers' }, { status: 500 })
  }
}

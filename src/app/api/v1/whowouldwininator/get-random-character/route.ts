import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { READING_LEVEL } from '../constants'

const RandomCharacterSchema = z.object({
  name: z.string().describe('The name of the character'),
  description: z.string().describe('A detailed description of the character'),
})

// Large list of character categories to choose from
const CHARACTER_CATEGORIES = [
  'ancient mythology god',
  'post-apocalyptic survivor',
  'superhero',
  'supervillain',
  'anime protagonist',
  'horror monster',
  'pirate captain',
  'wild west gunslinger',
  'mad scientist',
  'robot/android',
  'alien species',
  'vampire',
  'wizard or sorcerer',
  'angel',
  'time traveler',
  'undead creature',
  'shapeshifter',
  'detective',
  'spy/secret agent',
  'bounty hunter',
  'samurai',
  'street fighter',
  'martial artist',
  'professional wrestler',
  'boxer',
  'fairy tale character',
  'mythical beast',
  'legendary hero',
  'fallen hero',
  'anti-hero',
  'trickster god',
  'deity',
  'god',
  'demigod',
  'mythological figure',
  'american hero',
  'american president',
  'war deity',
  'love deity',
  'death deity',
  'nature deity',
  'sea creature',
  'desert nomad',
  'arctic survivor',
  'urban vigilante',
  'cult leader',
  'religious figure',
  'entertainer',
  'athlete',
  'general',
  'emperor/empress',
  'king/queen',
  'prince/princess',
  'noble',
  'healer',
  'teacher',
  'student',
  'child prodigy',
  'elderly sage',
  'fortune teller',
  'gladiator',
  'sailor',
  'explorer',
  'random character',
  'random character',
  'movie character',
  'comic book character',
  'video game character',
  'cartoon character',
  'anime character',
  'manga character',
  'video game character',
  'animal',
  'mutated animal',
]

const obscureOrWellKnown = () => {
  return Math.random() < 0.5 ? 'obscure but well-known' : 'well-known'
}

export async function POST(request: Request) {
  try {
    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Get excluded characters from request body to avoid repeats
    const body = await request.json()
    const excludedCharacters = body?.excludedCharacters || []

    // Choose a random category
    const randomCategory =
      CHARACTER_CATEGORIES[Math.floor(Math.random() * CHARACTER_CATEGORIES.length)]

    // Generate character based on the category
    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: RandomCharacterSchema,
      prompt: `Please tell me the name of an ${obscureOrWellKnown()} ${randomCategory}.

The description should:
- Be 1-2 sentences long
- Include their appearance, abilities, and personality traits
- Be engaging and vivid
- Keep the writing at a ${READING_LEVEL} reading level.

${excludedCharacters.length > 0 ? `Do not create any of these characters that have already been generated: ${excludedCharacters.join(', ')}` : ''}`,
      temperature: 0.9, // High temperature for creative variety
      maxTokens: 300,
    })

    return NextResponse.json({
      name: result.object.name,
      description: result.object.description,
      category: randomCategory,
    })
  } catch (error) {
    console.error('Error generating random character:', error)
    return NextResponse.json({ error: 'Failed to generate random character' }, { status: 500 })
  }
}

import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { CharacterStatsSchema } from '../../types'

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json()

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: CharacterStatsSchema,
      prompt: `Generate combat stats for a character named "${name}" with the following description: ${description}

Rate each stat on a 1-100 scale where:
- 1-19: Below Average/Weak 
- 20-39: Average Human Level 
- 40-59: Enhanced/Above Average
- 60-79: Superhuman/Exceptional
- 80-100: Godlike/Cosmic Level

Stats to evaluate:
- Strength: Physical power and lifting capacity
  examples:
  - ant 1
  - human baby 2
  - average human male 29
  - spiderman 69 
  - superman 88
  - the hulk 98
  - one punch man 99

- Speed: Movement speed, reflexes, and agility
  examples:
  - snail 1
  - human baby 2
  - average human male 21
  - spiderman 68 
  - superman 71
  - the flash 91

- Durability: Resistance to damage, healing, and endurance
  examples:
  - ant 1
  - human baby 2
  - average human male 21
  - spiderman 68 
  - superman 71
  - the hulk 98
  - one punch man 99

- Intelligence: Strategic thinking, problem-solving, and knowledge
  examples:
  - ant 1
  - human baby 2
  - average human male 21
  - sherlock holmes 59
  - megamind 79
  - deep thought 99

- Special Abilities: Magical power, energy projection, and supernatural abilities
  examples:
  - ant 0
  - human baby 0
  - average human male 0
  - the hulk 38
  - spiderman 68 
  - superman 71
  - dr strange 83
  - god 100

- Fighting: Combat skills, martial arts, and battle experience
  examples:
  - ant 1
  - human baby 1
  - average human male 21
  - jet li 53
  - bruce lee 59
  - goku 94

Consider the character's description carefully and rate them realistically. A normal human would typically have 21-40 in most stats, while cosmic beings might have 81-100.`,
      temperature: 0.5, // Lower temperature for more consistent stat generation
      maxTokens: 150,
    })

    return NextResponse.json({ stats: result.object })
  } catch (error) {
    console.error('Error generating character stats:', error)
    return NextResponse.json({ error: 'Failed to generate character stats' }, { status: 500 })
  }
}

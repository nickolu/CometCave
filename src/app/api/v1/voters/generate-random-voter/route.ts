import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VOTER_CATEGORIES = [
  'Dog Lovers',
  'Cat Enthusiasts',
  'Bird Watchers',
  'Tech Entrepreneurs',
  'Coffee Connoisseurs',
  'Book Lovers',
  'Fitness Enthusiasts',
  'Travel Bloggers',
  'Food Critics',
  'Art Collectors',
  'Music Producers',
  'Film Directors',
  'Environmental Activists',
  'Urban Planners',
  'Teachers',
  'Medical Professionals',
  'Financial Advisors',
  'Real Estate Agents',
  'Fashion Designers',
  'Gamers',
  'Photographers',
  'Writers',
  'Scientists',
  'Engineers',
  'Lawyers',
  'Chefs',
  'Gardeners',
  'Cyclists',
  'Hikers',
  'Surfers',
  'Skiers',
  'Dancers',
  'Yoga Instructors',
  'Martial Artists',
  'Parents',
  'College Students',
  'Retirees',
  'Millennials',
  'Gen Z',
  'Baby Boomers',
  'City Dwellers',
  'Rural Residents',
  'Suburban Families',
  'Single Professionals',
  'Remote Workers',
  'Small Business Owners',
  'Non-Profit Volunteers',
  'Religious Communities',
  'Sports Fans',
  'Historians',
]

const VoterSchema = z.object({
  name: z.string().describe('A unique, creative name for this voter type'),
  description: z
    .string()
    .describe("Detailed description of this voter's characteristics, preferences, and background"),
  count: z.number().min(1).max(100).describe('Number of voters of this type (between 1-100)'),
  modelConfig: z.object({
    model: z
      .enum(['gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-4'])
      .describe('AI model to use'),
    temperature: z.number().min(0).max(2).describe('Temperature for AI responses (0-2)'),
    maxTokens: z.number().min(50).max(500).describe('Maximum tokens for AI responses (50-500)'),
  }),
})

const VotersListSchema = z.object({
  voters: z.array(VoterSchema).length(10).describe('Array of exactly 10 different voter types'),
})

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment variable or request header
    let apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
    const headerApiKey = request.headers.get('x-openai-api-key')

    if (headerApiKey) {
      apiKey = headerApiKey
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please provide an API key.' },
        { status: 500 }
      )
    }

    // Get existing voters from request body
    const { existingVoters = [] } = await request.json()

    // Pick a random category
    const randomCategory = VOTER_CATEGORIES[Math.floor(Math.random() * VOTER_CATEGORIES.length)]

    // Create list of existing voter names to avoid duplicates
    const existingVoterNames = existingVoters.map((voter: { name: string }) => voter.name)
    const existingVotersText =
      existingVoters.length > 0
        ? `\n\nEXISTING VOTERS TO AVOID DUPLICATING:\n${existingVoterNames.join(', ')}\n\nMake sure the generated voters are as different as possible from the existing ones listed above.`
        : ''

    const prompt = `Generate exactly 10 unique and diverse voter types within the category "${randomCategory}".${existingVotersText}

Each voter should have:
- A unique, creative name that reflects their specific characteristics within the ${randomCategory} category
- A detailed description (2-3 sentences) of their background, preferences, and voting tendencies
- A realistic count between 1-100 representing how many voters of this type exist
- Appropriate AI model configuration (model, temperature 0-2, maxTokens 50-500)

Make each voter distinct and interesting within the ${randomCategory} theme. Vary their personalities, backgrounds, and characteristics significantly. For example, if the category is "Dog Lovers", include different types like "Competitive Dog Show Judges", "Rescue Dog Advocates", "Working Dog Trainers", "Puppy Mill Opponents", etc.

Ensure variety in:
- Names (creative and descriptive)
- Descriptions (different backgrounds, ages, perspectives)
- Count numbers (mix of small and large groups)
- Model configurations (different models, temperatures, token limits)`

    const openaiClient = createOpenAI({
      apiKey,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: VotersListSchema,
      prompt,
      temperature: 0.8, // Higher temperature for more creativity
      maxTokens: 4000,
    })

    // Pick one random voter from the 50 generated
    const randomVoter =
      result.object.voters[Math.floor(Math.random() * result.object.voters.length)]

    // Add a unique ID and return the voter
    const voterWithId = {
      ...randomVoter,
      id: Date.now().toString(),
    }

    return NextResponse.json({
      voter: voterWithId,
      category: randomCategory,
    })
  } catch (error) {
    console.error('Error generating random voter:', error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API key is invalid or missing. Please check your API key.' },
          { status: 401 }
        )
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded. Please check your OpenAI account.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate random voter. Please try again.' },
      { status: 500 }
    )
  }
}

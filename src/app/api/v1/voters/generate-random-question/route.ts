import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const QUESTION_CATEGORIES = [
  'Food & Dining',
  'Technology & Innovation',
  'Entertainment & Media',
  'Travel & Adventure',
  'Health & Fitness',
  'Environment & Sustainability',
  'Education & Learning',
  'Work & Career',
  'Art & Culture',
  'Sports & Recreation',
  'Fashion & Style',
  'Home & Living',
  'Transportation',
  'Social Issues',
  'Science & Discovery',
  'Relationships & Family',
  'Finance & Economics',
  'Politics & Governance',
  'Philosophy & Ethics',
  'Hobbies & Interests',
]

const QuestionSchema = z.object({
  question: z
    .string()
    .describe('A thought-provoking voting question that would generate interesting debate'),
  category: z.string().describe('The category this question belongs to'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('The complexity level of the question'),
  expectedOptions: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe('2-6 potential answer options for this question'),
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

    // Pick a random category
    const randomCategory =
      QUESTION_CATEGORIES[Math.floor(Math.random() * QUESTION_CATEGORIES.length)]

    const prompt = `Generate a unique and engaging voting question in the "${randomCategory}" category.

The question should be:
- Thought-provoking and likely to generate interesting debate
- Clear and easy to understand
- Suitable for a diverse group of AI voters with different backgrounds
- Not too controversial or offensive
- Specific enough to have clear answer options

Provide 2-6 potential answer options that:
- Cover the main perspectives people might have
- Are mutually exclusive
- Are specific and actionable rather than vague
- Would allow for interesting reasoning from different voter types

Examples of good questions:
- "What's the most important factor when choosing a vacation destination?" (Options: Cost, Weather, Culture, Activities, Food, Safety)
- "Which skill should be mandatory in schools?" (Options: Financial literacy, Critical thinking, Coding, Communication, Time management)
- "What's the best approach to morning productivity?" (Options: Exercise first, Plan the day, Check emails, Meditate, Eat a good breakfast)

Make the question engaging and the options comprehensive but not overwhelming.`

    const openaiClient = createOpenAI({
      apiKey,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: QuestionSchema,
      prompt,
      temperature: 0.8, // Higher temperature for more creativity
      maxTokens: 800,
    })

    return NextResponse.json({
      question: result.object.question,
      category: result.object.category,
      difficulty: result.object.difficulty,
      suggestedOptions: result.object.expectedOptions,
    })
  } catch (error) {
    console.error('Error generating random question:', error)

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
      { error: 'Failed to generate random question. Please try again.' },
      { status: 500 }
    )
  }
}

import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CriteriaSchema = z.object({
  options: z
    .array(z.string())
    .min(2)
    .max(8)
    .describe('2-8 well-crafted answer options for the question'),
  reasoning: z.string().describe('Brief explanation of why these options were chosen'),
  tips: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('2-4 tips for improving the question or options'),
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

    const { question, existingOptions = [] } = await request.json()

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required and must be a non-empty string.' },
        { status: 400 }
      )
    }

    const existingOptionsText =
      existingOptions.length > 0
        ? `\n\nCurrent options: ${existingOptions.join(', ')}\n\nYou can improve upon these or suggest completely different options.`
        : ''

    const prompt = `Analyze this voting question and generate optimal answer options:

Question: "${question}"${existingOptionsText}

Generate 2-8 comprehensive answer options that:
- Cover the main perspectives people would have on this question
- Are mutually exclusive (voters can only pick one)
- Are specific and actionable rather than vague
- Would generate interesting reasoning from different types of voters
- Are balanced and fair (no obviously "correct" answer)
- Are concise but descriptive

Consider:
- What are the key dimensions or factors people consider for this question?
- What different approaches or philosophies might people have?
- How can we ensure diverse voter types will have good options to choose from?
- What would make for the most interesting debate and discussion?

Also provide:
- Brief reasoning for why these options work well together
- Tips for potentially improving the question or options further

Example good option sets:
- For "Best way to learn a new skill": "Online courses", "Hands-on practice", "Find a mentor", "Read books/guides", "Join a community"
- For "Most important in a leader": "Vision and strategy", "Communication skills", "Empathy and listening", "Decision-making ability", "Technical expertise"`

    const openaiClient = createOpenAI({
      apiKey,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: CriteriaSchema,
      prompt,
      temperature: 0.7, // Moderate temperature for balance of creativity and consistency
      maxTokens: 1000,
    })

    return NextResponse.json({
      options: result.object.options,
      reasoning: result.object.reasoning,
      tips: result.object.tips,
    })
  } catch (error) {
    console.error('Error generating criteria:', error)

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
      { error: 'Failed to generate criteria. Please try again.' },
      { status: 500 }
    )
  }
}

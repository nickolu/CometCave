import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CastVoteRequestSchema = z.object({
  voter: z.object({
    id: z.string(),
    name: z.string().max(200),
    description: z.string().max(1000),
    modelConfig: z.object({
      model: z.string(),
      temperature: z.number(),
      maxTokens: z.number(),
    }),
  }),
  criteria: z.object({
    question: z.string().max(1000),
    options: z.array(z.string().max(500)).min(1).max(20),
  }),
  instance: z.number().optional(),
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

    const parseResult = CastVoteRequestSchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }
    const { voter, criteria, instance = 0 } = parseResult.data

    // Create dynamic schema based on voting criteria
    const voteSchema = z.object({
      choice: z.enum(criteria.options as [string, ...string[]]),
      reasoning: z.string().describe('Brief explanation for the choice'),
    })

    const prompt = `You are a voter with the following characteristics:
Name: ${voter.name}
Description: ${voter.description}

Please vote on the following question: ${criteria.question}

Available options: ${criteria.options.join(', ')}

Based on your characteristics and preferences, choose one option and provide a brief reasoning for your choice. Stay in character and make your decision based on the description provided.`

    // Correctly initialize OpenAI client with API key
    const openaiClient = createOpenAI({
      apiKey,
    })

    const result = await generateObject({
      model: openaiClient(voter.modelConfig.model),
      schema: voteSchema,
      prompt,
      temperature: voter.modelConfig.temperature,
      maxTokens: voter.modelConfig.maxTokens,
    })

    const vote = {
      voterId: voter.id,
      voterName: voter.name,
      voterDescription: voter.description,
      choice: result.object.choice,
      reasoning: result.object.reasoning,
      instanceId: `${voter.name}-${instance + 1}`,
    }

    return NextResponse.json(vote)
  } catch (error) {
    console.error('Error casting vote:', error)

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

    return NextResponse.json({ error: 'Failed to cast vote. Please try again.' }, { status: 500 })
  }
}

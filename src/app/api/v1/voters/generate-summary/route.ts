import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const GenerateSummaryRequestSchema = z.object({
  voterGroup: z.object({
    name: z.string().max(200),
    description: z.string().max(1000),
  }),
  votes: z.array(z.object({
    choice: z.string().max(500),
    reasoning: z.string().max(1000),
  })).min(1).max(100),
  criteria: z.object({
    question: z.string().max(1000),
    options: z.array(z.string().max(500)).max(20),
  }),
})

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment variable or request header
    let apiKey = process.env.OPENAI_API_KEY
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

    const parseResult = GenerateSummaryRequestSchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }
    const { voterGroup, votes, criteria } = parseResult.data

    // Create a summary of the voting patterns and reasoning
    const votingData = votes.map(vote => ({
      choice: vote.choice,
      reasoning: vote.reasoning,
    }))

    const choiceDistribution = votes.reduce(
      (acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const prompt = `Analyze the voting patterns for a group of AI voters and provide a concise summary.

Voter Group: ${voterGroup.name}
Group Description: ${voterGroup.description}
Total Votes: ${votes.length}

Voting Question: ${criteria.question}
Available Options: ${criteria.options.join(', ')}

Vote Distribution:
${Object.entries(choiceDistribution)
  .map(
    ([choice, count]) =>
      `- ${choice}: ${count} votes (${Math.round(((count as number) / votes.length) * 100)}%)`
  )
  .join('\n')}

Sample Reasoning from Voters:
${votingData
  .slice(0, 10) // Limit to first 10 to avoid token limits
  .map((vote, index) => `${index + 1}. Choice: ${vote.choice} - Reasoning: ${vote.reasoning}`)
  .join('\n')}

Please provide a brief 2-3 sentence summary that explains:
1. The overall voting pattern for this group
2. The main themes or reasoning patterns observed
3. Any notable insights about how this voter group's characteristics influenced their choices

Keep the summary analytical and focused on voting behavior patterns.`

    const openaiClient = createOpenAI({
      apiKey,
    })

    const result = await generateText({
      model: openaiClient('gpt-4o-mini'),
      prompt,
      temperature: 0.3, // Lower temperature for more consistent summaries
      maxTokens: 200,
    })

    return NextResponse.json({ summary: result.text })
  } catch (error) {
    console.error('Error generating summary:', error)

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
      { error: 'Failed to generate summary. Please try again.' },
      { status: 500 }
    )
  }
}

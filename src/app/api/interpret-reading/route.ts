import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

import { hexagramDescriptions } from '@/app/oracle/library'
import { getHexagramTrigrams } from '@/app/oracle/trigrams'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface InterpretationRequest {
  question: string
  context?: string
  presentHexagram: {
    number: number
    name: string
    hexagram: boolean[]
  }
  futureHexagram: {
    number: number
    name: string
    hexagram: boolean[]
  }
  changingLines: Array<{
    lineNumber: number
    direction: string
    description: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: InterpretationRequest = await request.json()
    const { question, context, presentHexagram, futureHexagram, changingLines } = body

    // Get trigram information
    const presentTrigrams = getHexagramTrigrams(presentHexagram.hexagram)
    const futureTrigrams = getHexagramTrigrams(futureHexagram.hexagram)

    // Build the prompt
    const prompt = `You are a wise and insightful I-Ching interpreter with deep knowledge of Chinese philosophy, symbolism, and divination. Please provide a thoughtful, nuanced interpretation of this I-Ching reading.

**Question:** ${question}

${context ? `**Additional Context:** ${context}` : ''}

**Reading Results:**

**Present Hexagram:** ${presentHexagram.name} (#${presentHexagram.number})
- Upper Trigram: ${presentTrigrams.upperTrigram.name} (${presentTrigrams.upperTrigram.chinese}) - ${presentTrigrams.upperTrigram.attribute}
- Lower Trigram: ${presentTrigrams.lowerTrigram.name} (${presentTrigrams.lowerTrigram.chinese}) - ${presentTrigrams.lowerTrigram.attribute}

${hexagramDescriptions[presentHexagram.number]}

${changingLines.length > 0 ? `**Changing Lines:**\n${changingLines.map(line => `Line ${line.lineNumber} (${line.direction}):\n${line.description}`).join('\n\n')}` : '**No changing lines in this reading.**'}

**Future Hexagram:** ${futureHexagram.name} (#${futureHexagram.number})
- Upper Trigram: ${futureTrigrams.upperTrigram.name} (${futureTrigrams.upperTrigram.chinese}) - ${futureTrigrams.upperTrigram.attribute}
- Lower Trigram: ${futureTrigrams.lowerTrigram.name} (${futureTrigrams.lowerTrigram.chinese}) - ${futureTrigrams.lowerTrigram.attribute}

${hexagramDescriptions[futureHexagram.number]}

---

Please provide a comprehensive interpretation that:
1. Addresses the specific question and context provided
2. Explains what the present hexagram reveals about the current situation
3. Interprets the significance of the changing lines (if any) and what they indicate about the dynamics at play
4. Explains what the future hexagram suggests about how the situation may evolve
5. Offers practical wisdom and guidance for how to approach this situation

Write in a warm, wise, and accessible tone. Be specific to the question and context, weaving together the symbolism, traditional meanings, and practical guidance. Aim for 3-5 paragraphs.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a wise I-Ching interpreter who provides thoughtful, nuanced readings that blend ancient wisdom with practical modern guidance.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const interpretation = completion.choices[0]?.message?.content || 'Unable to generate interpretation.'

    return NextResponse.json({ interpretation })
  } catch (error) {
    console.error('Error generating interpretation:', error)
    return NextResponse.json({ error: 'Failed to generate interpretation' }, { status: 500 })
  }
}

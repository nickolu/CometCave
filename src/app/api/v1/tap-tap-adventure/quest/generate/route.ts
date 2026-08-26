import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { FantasyCharacterSchema } from '@/app/tap-tap-adventure/models/character'
import { generateTimedQuest } from '@/app/tap-tap-adventure/lib/questGenerator'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  let character: unknown

  try {
    const body = await request.json()
    character = body.character

    const parseResult = FantasyCharacterSchema.safeParse(character)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid character data' }, { status: 400 })
    }

    const validatedCharacter = parseResult.data

    // Generate mechanical quest (synchronous, no LLM)
    const quest = generateTimedQuest(validatedCharacter)

    // Enhance with LLM narrative
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      // No API key configured — return static quest
      return NextResponse.json(quest)
    }

    const openaiClient = createOpenAI({ apiKey })

    const region = validatedCharacter.currentRegion ?? 'unknown lands'
    const className = validatedCharacter.class ?? 'adventurer'

    const QuestNarrativeSchema = z.object({
      title: z.string().max(60).describe('Short atmospheric quest title (max 8 words)'),
      description: z.string().max(200).describe('1-2 sentence quest description in cosmic-narrator voice'),
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: QuestNarrativeSchema,
      prompt: `You are the cosmic narrator of a surreal fantasy adventure game. Rewrite this quest notice board posting in your voice — mysterious, poetic, intelligent.

Character: Level ${validatedCharacter.level} ${className} in ${region}
Quest type: ${quest.type}
Mechanical goal: ${quest.description}

Write a short title (max 8 words) and 1-2 sentence description that:
- Captures the essence of the quest mechanically (the player needs to know WHAT to do)
- Uses cosmic-narrator voice (surreal, specific, evocative — not generic fantasy clichés)
- Feels like it came from the notice board of a strange, knowing universe
- Does NOT say "cosmic" or "surreal" or break the fourth wall

Examples of the voice:
- "The road demands km 300. The road remembers every step."
- "Seven lairs. Seven endings. The cave is keeping score."
- "Gold doesn't care who holds it, but the merchants here remember faces."`,
      temperature: 0.8,
      maxTokens: 200,
    })

    return NextResponse.json({
      ...quest,
      title: result.object.title,
      description: result.object.description,
    })
  } catch (error) {
    console.error('[quest/generate] Failed:', error)

    // Fallback: return a synchronously-generated quest (no LLM) on error
    try {
      const parseResult = FantasyCharacterSchema.safeParse(character)
      if (parseResult.success) {
        const fallbackQuest = generateTimedQuest(parseResult.data)
        return NextResponse.json(fallbackQuest)
      }
    } catch {
      // ignore nested error
    }

    return NextResponse.json({ error: 'Failed to generate quest' }, { status: 500 })
  }
}

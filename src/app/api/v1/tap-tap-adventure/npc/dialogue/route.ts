import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { z } from 'zod'

import { getNPCById } from '@/app/tap-tap-adventure/config/npcs'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'

const DialogueRequestSchema = z.object({
  npcId: z.string(),
  characterName: z.string(),
  characterClass: z.string(),
  characterLevel: z.number(),
  reputation: z.number(),
  region: z.string(),
  message: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
})

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parseResult = DialogueRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error },
        { status: 400 }
      )
    }

    const { npcId, characterName, characterClass, characterLevel, reputation, region, message, conversationHistory } = parseResult.data

    const npc = getNPCById(npcId)
    if (!npc) {
      return NextResponse.json({ error: 'NPC not found' }, { status: 404 })
    }

    const regionData = getRegion(region)
    const regionName = regionData?.name ?? region

    const systemPrompt = `You are ${npc.name}, ${npc.role} in ${regionName}. Personality: ${npc.personality}. Respond in character. Keep responses under 3 sentences. Occasionally offer a small reward (a gold tip, a reputation boost, or a useful hint about the area). End with a natural conversation hook or question. If you choose to offer a reward, include a JSON block at the very end of your response in this exact format: [REWARD:{"gold":N}] or [REWARD:{"reputation":N}] or [REWARD:{"gold":N,"reputation":N}] where N is a small number (gold: 5-25, reputation: 1-5). Only offer rewards occasionally, not every message.`

    const characterContext = `The adventurer ${characterName} (Level ${characterLevel} ${characterClass}, Reputation: ${reputation}) approaches.`

    const userMessage = message
      ? `${characterContext}\n\nPlayer says: "${message}"`
      : `${characterContext}\n\nThe adventurer approaches you for the first time.`

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = conversationHistory ?? []

    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userMessage },
        ],
        temperature: 0.85,
        max_tokens: 200,
      })

      const raw = response.choices[0]?.message?.content?.trim() ?? npc.greeting

      // Parse optional reward block
      const rewardMatch = raw.match(/\[REWARD:(\{[^}]+\})\]/)
      let reward: { gold?: number; reputation?: number } | undefined
      let dialogue = raw

      if (rewardMatch) {
        try {
          reward = JSON.parse(rewardMatch[1]) as { gold?: number; reputation?: number }
          // Remove the reward block from dialogue text
          dialogue = raw.replace(/\s*\[REWARD:[^\]]+\]/, '').trim()
        } catch {
          // Ignore malformed reward block
          dialogue = raw.replace(/\s*\[REWARD:[^\]]+\]/, '').trim()
        }
      }

      return NextResponse.json({ dialogue, reward })
    } catch (err) {
      console.error('NPC dialogue LLM call failed', err)
      return NextResponse.json({ dialogue: npc.greeting })
    }
  } catch (err) {
    console.error('Error in NPC dialogue route', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

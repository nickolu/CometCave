import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { z } from 'zod'

import { getNPCById, getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'

const DialogueRequestSchema = z.object({
  npcId: z.string(),
  characterName: z.string(),
  characterClass: z.string(),
  characterLevel: z.number(),
  reputation: z.number(),
  region: z.string(),
  characterCharisma: z.number().optional(),
  message: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  disposition: z.number().optional(),
  exchangeCount: z.number().optional(),
  hiddenLandmarkName: z.string().optional(),
  hiddenLandmarkType: z.string().optional(),
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

    const {
      npcId,
      characterName,
      characterClass,
      characterLevel,
      reputation,
      region,
      characterCharisma,
      message,
      conversationHistory,
      disposition = 0,
      exchangeCount = 1,
      hiddenLandmarkName,
      hiddenLandmarkType,
    } = parseResult.data

    const charisma = characterCharisma ?? 5

    const npc = getNPCById(npcId)
    if (!npc) {
      return NextResponse.json({ error: 'NPC not found' }, { status: 404 })
    }

    const regionData = getRegion(region)
    const regionName = regionData?.name ?? region

    const tier = getRelationshipTier(disposition)
    const weightsDescription = npc.personalityWeights
      ? Object.entries(npc.personalityWeights)
          .map(([intent, weight]) => `${intent}: ${weight && weight > 0 ? '+' : ''}${weight}`)
          .join(', ')
      : 'balanced'

    const landmarkHint = hiddenLandmarkName
      ? `\n\nHIDDEN LANDMARK: There is a hidden landmark nearby called "${hiddenLandmarkName}" (${hiddenLandmarkType ?? 'location'}). If the player has good rapport with you (disposition > 30) and it feels narratively natural, you may share a rumor or hint about this place. When you do, set "revealLandmark": true in your response. Only reveal it occasionally — not every conversation.`
      : ''

    const combatContext = npc.combatRole === 'combatant'
      ? `\nYou are a skilled fighter. If the player has earned your trust (disposition > 30), you may occasionally express interest in joining their adventures.`
      : `\nYou are a non-combatant — you don't fight. You serve through trade, lore, or guidance.`
    const systemPrompt = `You are ${npc.name}, ${npc.role} in ${regionName}. Personality: ${npc.personality}${combatContext}

RELATIONSHIP: The player's current disposition toward you is ${disposition} (${tier.label}). Adjust your warmth and willingness accordingly.

PLAYER: ${characterName}, Level ${characterLevel} ${characterClass}. Reputation: ${reputation}. Charisma: ${charisma}.

CONVERSATION: This is exchange ${exchangeCount}.

Evaluate the player's message for intent. Choose one of: flatter, charm, threaten, inquire, offend, lie, bore, neutral.
Your personality preferences (how much you like each intent): ${weightsDescription}

Respond in character. Keep responses under 4 sentences.${landmarkHint}

RESPOND WITH ONLY THIS JSON (no markdown, no code fences):
{
  "dialogue": "Your in-character response here",
  "intent": "detected intent",
  "dispositionDelta": <integer from -10 to 8>,
  "conversationComplete": <true if exchange >= 3 and conversation feels naturally concluded, otherwise false>,
  "reward": { "gold": <integer 0-25>, "reputation": <integer 0-5> } or null,
  "revealLandmark": <true if you are revealing the hidden landmark to the player, otherwise omit>
}`

    const userMessage = message
      ? `${characterName} says: "${message}"`
      : `${characterName} (Level ${characterLevel} ${characterClass}) approaches you.`

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = conversationHistory ?? []

    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      })

      const raw = response.choices[0]?.message?.content?.trim() ?? ''

      let parsed: {
        dialogue?: string
        intent?: string
        dispositionDelta?: number
        conversationComplete?: boolean
        reward?: { gold?: number; reputation?: number } | null
        revealLandmark?: boolean
      } = {}

      try {
        parsed = JSON.parse(raw) as typeof parsed
      } catch {
        // Fallback: try to extract dialogue from partial JSON
        const dialogueMatch = raw.match(/"dialogue"\s*:\s*"([^"]+)"/)
        parsed = { dialogue: dialogueMatch ? dialogueMatch[1] : npc.greeting, dispositionDelta: 0 }
      }

      const dialogue = parsed.dialogue ?? npc.greeting
      const rawDelta = typeof parsed.dispositionDelta === 'number' ? parsed.dispositionDelta : 0

      // Apply CHA modifier: CHA 7 = baseline 1.0; each point adds/subtracts 0.1
      const chaModifier = 1 + (charisma - 7) * 0.1
      const adjustedDelta = Math.round(rawDelta * chaModifier)
      // Clamp to [-15, +12]
      const dispositionDelta = Math.max(-15, Math.min(12, adjustedDelta))

      const reward = parsed.reward && (parsed.reward.gold || parsed.reward.reputation) ? parsed.reward : undefined

      return NextResponse.json({
        dialogue,
        intent: parsed.intent ?? 'neutral',
        dispositionDelta,
        conversationComplete: parsed.conversationComplete ?? false,
        reward,
        revealLandmark: parsed.revealLandmark === true ? true : undefined,
      })
    } catch (err) {
      console.error('NPC dialogue LLM call failed', err)
      return NextResponse.json({ dialogue: npc.greeting, intent: 'neutral', dispositionDelta: 0, conversationComplete: false })
    }
  } catch (err) {
    console.error('Error in NPC dialogue route', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

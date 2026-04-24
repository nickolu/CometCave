import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { z } from 'zod'

import { getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'

const PERSONALITY_WEIGHTS: Record<string, Record<string, number>> = {
  brave:      { flatter: 0, charm: -1, threaten: 1, inquire: 1, offend: -1 },
  cautious:   { flatter: 1, charm: 1, threaten: -2, inquire: 1, offend: -2 },
  aggressive: { flatter: -1, charm: -1, threaten: 1, inquire: 0, offend: 0 },
  loyal:      { flatter: 1, charm: 1, threaten: -1, inquire: 1, offend: -2 },
  cunning:    { flatter: -1, charm: 1, threaten: 0, inquire: 2, offend: -1 },
  reckless:   { flatter: 0, charm: 0, threaten: 0, inquire: -1, offend: 1 },
}

const DialogueRequestSchema = z.object({
  memberName: z.string(),
  memberClassName: z.string(),
  memberPersonality: z.string().optional(),
  characterName: z.string(),
  characterClass: z.string(),
  characterLevel: z.number(),
  characterCharisma: z.number().optional(),
  message: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  disposition: z.number().optional(),
  exchangeCount: z.number().optional(),
})

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parseResult = DialogueRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request', details: parseResult.error }, { status: 400 })
    }

    const {
      memberName,
      memberClassName,
      memberPersonality = 'loyal',
      characterName,
      characterClass,
      characterLevel,
      characterCharisma,
      message,
      conversationHistory,
      disposition = 0,
      exchangeCount = 1,
    } = parseResult.data

    const charisma = characterCharisma ?? 5
    const tier = getRelationshipTier(disposition)
    const weights = PERSONALITY_WEIGHTS[memberPersonality] ?? PERSONALITY_WEIGHTS.loyal
    const weightsDescription = Object.entries(weights)
      .map(([intent, weight]) => `${intent}: ${weight > 0 ? '+' : ''}${weight}`)
      .join(', ')

    const systemPrompt = `You are ${memberName}, a ${memberClassName} traveling with the player as a party member.
Your personality: ${memberPersonality}.

RELATIONSHIP: Your current disposition toward the player is ${disposition} (${tier.label}). You travel together and share camp.
${disposition >= 50 ? 'You trust this person deeply and speak openly.' : disposition >= 20 ? 'You are getting comfortable with this person.' : disposition >= 0 ? 'You are still getting to know this person.' : 'You are wary of this person.'}

PLAYER: ${characterName}, Level ${characterLevel} ${characterClass}. Charisma: ${charisma}.

CONVERSATION: This is exchange ${exchangeCount}.

Evaluate the player's message for intent. Choose one of: flatter, charm, threaten, inquire, offend, lie, bore, neutral.
Your personality preferences (how much you like each intent): ${weightsDescription}

Respond in character as a traveling companion, not a stranger. Keep responses under 4 sentences.

RESPOND WITH ONLY THIS JSON (no markdown, no code fences):
{
  "dialogue": "Your in-character response here",
  "intent": "detected intent",
  "dispositionDelta": <integer from -10 to 8>,
  "conversationComplete": <true if exchange >= 3 and conversation feels naturally concluded, otherwise false>
}`

    const userMessage = message
      ? `${characterName} says: "${message}"`
      : `${characterName} turns to you during travel.`

    const historyMessages = conversationHistory ?? []

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = {}
      try {
        parsed = JSON.parse(raw)
      } catch {
        const dialogueMatch = raw.match(/"dialogue"\s*:\s*"([^"]+)"/)
        parsed = { dialogue: dialogueMatch?.[1] ?? `*${memberName} nods quietly*`, dispositionDelta: 0 }
      }

      const dialogue = parsed.dialogue ?? `*${memberName} nods quietly*`
      const rawDelta = typeof parsed.dispositionDelta === 'number' ? parsed.dispositionDelta : 0
      const chaModifier = 1 + (charisma - 7) * 0.1
      const adjustedDelta = Math.round(rawDelta * chaModifier)
      const dispositionDelta = Math.max(-15, Math.min(12, adjustedDelta))

      return NextResponse.json({
        dialogue,
        intent: parsed.intent ?? 'neutral',
        dispositionDelta,
        conversationComplete: parsed.conversationComplete ?? false,
      })
    } catch (err) {
      console.error('Party dialogue LLM call failed', err)
      return NextResponse.json({
        dialogue: `*${memberName} nods quietly*`,
        intent: 'neutral',
        dispositionDelta: 0,
        conversationComplete: false,
      })
    }
  } catch (err) {
    console.error('Error in party dialogue route', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

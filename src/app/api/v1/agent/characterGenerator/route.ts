'use server'

import crypto from 'crypto'

import { NextResponse } from 'next/server'
import OpenAI from 'openai'

import { Character } from '@/app/chat-room-of-infinity/types'

const FALLBACK_CHARACTERS: Omit<Character, 'id'>[] = [
  {
    name: 'Zara the Wanderer',
    description: 'A seasoned traveler who has seen every corner of the known world and loves sharing tales of adventure.',
  },
  {
    name: 'Professor Quill',
    description: 'An eccentric academic obsessed with obscure historical facts and forgotten languages.',
  },
  {
    name: 'Byte',
    description: 'A friendly AI entity curious about human customs and emotions, always asking thoughtful questions.',
  },
  {
    name: 'Captain Ember',
    description: 'A bold ship captain with a love for dramatic storytelling and nautical metaphors.',
  },
  {
    name: 'Luna the Dreamer',
    description: 'A whimsical artist who sees beauty in everything and speaks in vivid metaphors.',
  },
]

export async function POST(request: Request) {
  try {
    const { previousCharacters, criteria } = await request.json()

    if (!Array.isArray(previousCharacters)) {
      return NextResponse.json(
        { error: 'Invalid request: previousCharacters must be an array' },
        { status: 400 }
      )
    }

    if (previousCharacters.length > 50) {
      return NextResponse.json(
        { error: 'previousCharacters must have 50 or fewer entries' },
        { status: 400 }
      )
    }

    if (criteria && criteria.length > 500) {
      return NextResponse.json(
        { error: 'criteria must be 500 characters or fewer.' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      // No API key — return fallback characters that don't conflict with existing ones
      const existingNames = new Set((previousCharacters as Character[]).map(c => c.name))
      const available = FALLBACK_CHARACTERS.filter(c => !existingNames.has(c.name))
      const pool = available.length >= 3 ? available : FALLBACK_CHARACTERS
      const newCharacters: Character[] = pool.slice(0, 3).map(c => ({
        id: crypto.randomUUID(),
        ...c,
      }))
      return NextResponse.json({ newCharacters })
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const existingNames = (previousCharacters as Character[]).map(c => c.name).join(', ')
    const criteriaText = criteria?.trim()
      ? `The user wants characters that match this description: "${criteria}".`
      : 'The user wants interesting, diverse characters suitable for a group chat.'

    const prompt = `You are creating fictional characters for a group chat experience. Generate exactly 3 new characters.

${criteriaText}

${existingNames ? `Existing characters (do not repeat these): ${existingNames}` : ''}

Respond with a JSON object in this exact format:
{
  "characters": [
    { "name": "Character Name", "description": "A 1-2 sentence description of their personality and background." },
    { "name": "Character Name", "description": "A 1-2 sentence description of their personality and background." },
    { "name": "Character Name", "description": "A 1-2 sentence description of their personality and background." }
  ]
}

Keep descriptions family-friendly and suitable for all ages.`

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content || ''
    const parsed = JSON.parse(content)

    if (!parsed.characters || !Array.isArray(parsed.characters)) {
      throw new Error('Invalid response format from AI')
    }

    const newCharacters: Character[] = parsed.characters.slice(0, 3).map(
      (c: { name: string; description: string }) => ({
        id: crypto.randomUUID(),
        name: c.name,
        description: c.description,
      })
    )

    return NextResponse.json({ newCharacters })
  } catch (error) {
    console.error('[characterGenerator] Unhandled error:', error)
    // Fall back to default characters on any error
    const fallback: Character[] = FALLBACK_CHARACTERS.slice(0, 3).map(c => ({
      id: crypto.randomUUID(),
      ...c,
    }))
    return NextResponse.json({ newCharacters: fallback })
  }
}

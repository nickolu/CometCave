'use server'

import { NextResponse } from 'next/server'

import { getAIServiceConfig } from '@/app/chat-room-of-infinity/services/ai/config'
import { AIServiceFactory } from '@/app/chat-room-of-infinity/services/ai/factory'

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: message is required and must be a string' },
        { status: 400 }
      )
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'message must be 2000 characters or fewer.' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      // No API key available — assume message is safe rather than blocking all messages
      return NextResponse.json({ safe: true, reason: '' })
    }

    const config = getAIServiceConfig()
    const aiService = AIServiceFactory.create('openai', config)

    const result = await aiService.checkMessageSafety(message)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[safety] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

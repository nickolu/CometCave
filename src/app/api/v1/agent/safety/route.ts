'use server'

import { NextResponse } from 'next/server'
import { AIServiceFactory } from '@/app/chat-room-of-infinity/services/ai/factory'
import { getAIServiceConfig } from '@/app/chat-room-of-infinity/services/ai/config'

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: message is required and must be a string' },
        { status: 400 }
      )
    }

    const config = getAIServiceConfig()
    const aiService = AIServiceFactory.create('openai', config)

    const result = await aiService.checkMessageSafety(message)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

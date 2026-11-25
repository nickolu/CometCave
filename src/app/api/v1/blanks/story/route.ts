import { type NextRequest, NextResponse } from 'next/server'

import { requireAiAccess } from '@/lib/api/ai-gate'
import { generateBlanksStory } from '@/lib/blanks/generate'
import { cleanTopic } from '@/lib/blanks/story'

export const maxDuration = 60

/**
 * POST { topic?: string } → StoryTemplate
 *
 * One model call behind the AI gate. The topic is optional and trimmed to a
 * line; the response is already parsed into segments, so the client never
 * handles the model's markers.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAiAccess(request, 'blanks-story')
  if ('error' in gate) return gate.error

  let topic = ''
  try {
    const body = (await request.json()) as { topic?: unknown }
    topic = cleanTopic(body?.topic)
  } catch {
    // No body or not JSON: treat as no topic.
  }

  try {
    const template = await generateBlanksStory(topic)
    return NextResponse.json(template)
  } catch (error) {
    console.error('[blanks] story generation failed', { topic, error })
    return NextResponse.json({ error: 'Could not write that story. Try again.' }, { status: 502 })
  }
}

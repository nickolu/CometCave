import { NextResponse } from 'next/server'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyLocation } from '@/app/tap-tap-adventure/models/location'
import { FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'

// Minimal empty state for SSR or placeholder
const emptyGameState = {
  character: null as FantasyCharacter | null,
  locations: [] as FantasyLocation[],
  storyEvents: [] as FantasyStoryEvent[],
}

export async function GET() {
  // Always returns empty state (browser handles real storage)
  return NextResponse.json(emptyGameState)
}

import { NextResponse } from 'next/server';
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character';
import { FantasyLocation } from '@/app/fantasy-tycoon/models/location';
import { FantasyStoryEvent } from '@/app/fantasy-tycoon/models/story';

// Minimal empty state for SSR or placeholder
const emptyGameState = {
  character: null as FantasyCharacter | null,
  locations: [] as FantasyLocation[],
  storyEvents: [] as FantasyStoryEvent[],
};

export async function GET() {
  // Always returns empty state (browser handles real storage)
  return NextResponse.json(emptyGameState);
}

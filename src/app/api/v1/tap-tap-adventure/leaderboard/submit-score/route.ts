import { type NextRequest, NextResponse } from 'next/server'
import { getTodayPST } from '@/app/trivia/lib/triviaUtils'
import { submitAdventureScore } from '@/app/tap-tap-adventure/lib/adventureLeaderboardStore'

const MAX_NAME_LENGTH = 20
const MAX_CHAR_NAME_LENGTH = 50
const MAX_REGIONS = 20

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      playerName,
      characterId,
      characterName,
      characterClass,
      distance,
      level,
      gold,
      regionsConquered,
      date,
    } = body

    // Validate playerName
    if (!playerName || typeof playerName !== 'string') {
      return NextResponse.json({ error: 'playerName is required.' }, { status: 400 })
    }
    const trimmedName = playerName.trim()
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `playerName must be 1-${MAX_NAME_LENGTH} characters.` },
        { status: 400 }
      )
    }

    // Validate characterId
    if (!characterId || typeof characterId !== 'string') {
      return NextResponse.json({ error: 'characterId is required.' }, { status: 400 })
    }

    // Validate characterName
    if (!characterName || typeof characterName !== 'string') {
      return NextResponse.json({ error: 'characterName is required.' }, { status: 400 })
    }
    const trimmedCharName = characterName.trim()
    if (trimmedCharName.length === 0 || trimmedCharName.length > MAX_CHAR_NAME_LENGTH) {
      return NextResponse.json(
        { error: `characterName must be 1-${MAX_CHAR_NAME_LENGTH} characters.` },
        { status: 400 }
      )
    }

    // Validate characterClass
    if (!characterClass || typeof characterClass !== 'string') {
      return NextResponse.json({ error: 'characterClass is required.' }, { status: 400 })
    }

    // Validate distance
    if (typeof distance !== 'number' || distance < 0) {
      return NextResponse.json({ error: 'distance must be a number >= 0.' }, { status: 400 })
    }

    // Validate level
    if (typeof level !== 'number' || level < 1) {
      return NextResponse.json({ error: 'level must be a number >= 1.' }, { status: 400 })
    }

    // Validate gold
    if (typeof gold !== 'number' || gold < 0) {
      return NextResponse.json({ error: 'gold must be a number >= 0.' }, { status: 400 })
    }

    // Validate regionsConquered
    if (typeof regionsConquered !== 'number' || regionsConquered < 0 || regionsConquered > MAX_REGIONS) {
      return NextResponse.json(
        { error: `regionsConquered must be a number between 0 and ${MAX_REGIONS}.` },
        { status: 400 }
      )
    }

    // Validate date
    if (date !== getTodayPST()) {
      return NextResponse.json(
        { error: 'Can only submit scores for today.' },
        { status: 400 }
      )
    }

    const result = await submitAdventureScore({
      playerName: trimmedName,
      characterId,
      characterName: trimmedCharName,
      characterClass,
      distance,
      level,
      gold,
      regionsConquered,
      date,
      submittedAt: Date.now(),
    })

    return NextResponse.json({ stored: result.stored })
  } catch (error: unknown) {
    console.error('Error submitting adventure score:', error)
    // Don't block the user if Firestore is temporarily unavailable
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('FAILED_PRECONDITION') || errMsg.includes('index')) {
      return NextResponse.json({
        stored: false,
        notice: 'Leaderboard is initializing.',
      })
    }
    return NextResponse.json({ error: 'Failed to submit score.' }, { status: 500 })
  }
}

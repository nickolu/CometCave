import { type NextRequest, NextResponse } from 'next/server'

import { GROUP_SIZE } from '@/app/clusters/models/clusters'
import { verifyRequestAuth } from '@/lib/api/auth'
import { resolvePlayDate } from '@/lib/clusters/dateMap'
import { getPuzzle } from '@/lib/clusters/puzzleDb'
import { submitGuess } from '@/lib/clusters/session'
import { getTodayPST } from '@/lib/dates'
import { getOrCreateProfile } from '@/lib/users/profile'

interface Body {
  date?: unknown
  words?: unknown
  guessId?: unknown
}

const REJECTION_MESSAGE: Record<string, string> = {
  'wrong-size': `Select exactly ${GROUP_SIZE} words.`,
  'duplicate-words': 'That selection contains the same word twice.',
  'unknown-word': 'That selection contains a word that is not on this board.',
  'already-solved': 'That selection includes a group you have already found.',
  finished: "You've already finished this puzzle.",
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const today = getTodayPST()
  const resolved = resolvePlayDate(typeof body.date === 'string' ? body.date : null, today)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  if (!Array.isArray(body.words) || body.words.some((w) => typeof w !== 'string')) {
    return NextResponse.json({ error: 'words must be an array of strings.' }, { status: 400 })
  }
  // The client mints this so a retried request replays instead of charging a
  // second mistake. Without one we cannot make the write idempotent.
  if (typeof body.guessId !== 'string' || !body.guessId.trim()) {
    return NextResponse.json({ error: 'guessId is required.' }, { status: 400 })
  }

  try {
    const puzzle = await getPuzzle(resolved.date)
    if (!puzzle) {
      return NextResponse.json({ error: 'No puzzle for this day.' }, { status: 404 })
    }

    // Makes sure users/{uid} exists before the profile subcollection is written.
    await getOrCreateProfile(auth.claims)

    const result = await submitGuess({
      claims: auth.claims,
      puzzle,
      words: body.words as string[],
      guessId: body.guessId.trim(),
      today,
    })

    if (!result.ok) {
      const message = REJECTION_MESSAGE[result.rejection] ?? 'That guess could not be accepted.'
      return NextResponse.json(
        { error: message, rejection: result.rejection },
        { status: result.rejection === 'finished' ? 409 : 400 }
      )
    }

    return NextResponse.json(result.response)
  } catch (err) {
    console.error('Failed to record Clusters guess:', err)
    return NextResponse.json({ error: 'Could not submit that guess.' }, { status: 500 })
  }
}

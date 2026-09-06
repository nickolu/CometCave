import { type NextRequest, NextResponse } from 'next/server'

import type { ArchiveDay, ArchiveResponse, SessionStatus } from '@/app/clusters/models/clusters'
import { verifyRequestAuth } from '@/lib/api/auth'
import { LAUNCH_DATE, puzzleNumberFor } from '@/lib/clusters/dateMap'
import { getStoredDates } from '@/lib/clusters/puzzleDb'
import { getTodayPST } from '@/lib/dates'
import { getFirestoreDb } from '@/lib/firebase/server'

/**
 * Which days exist and what this player did on each.
 *
 * A day the player has not finished reports `unplayed` with no result —
 * showing the outcome of a puzzle they can still play would spoil it.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const today = getTodayPST()
  const uid = auth.claims.uid

  try {
    const db = getFirestoreDb()
    const [stored, gamesSnap, sessionsSnap] = await Promise.all([
      getStoredDates(LAUNCH_DATE, today),
      db
        .collection(`users/${uid}/clustersGames`)
        .where('date', '>=', LAUNCH_DATE)
        .where('date', '<=', today)
        .get(),
      db
        .collection(`users/${uid}/clustersSessions`)
        .where('date', '>=', LAUNCH_DATE)
        .where('date', '<=', today)
        .get(),
    ])

    const played = new Map<string, { status: SessionStatus; mistakes: number }>()
    for (const doc of gamesSnap.docs) {
      const data = doc.data() as { status?: SessionStatus; mistakes?: number }
      played.set(doc.id, {
        status: data.status === 'lost' ? 'lost' : 'won',
        mistakes: typeof data.mistakes === 'number' ? data.mistakes : 0,
      })
    }

    const started = new Set(
      sessionsSnap.docs.filter((d) => d.data().status === 'in_progress').map((d) => d.id)
    )

    const days: ArchiveDay[] = stored.map((date) => {
      const result = played.get(date)
      if (result) {
        return {
          date,
          puzzleNumber: puzzleNumberFor(date),
          status: result.status,
          mistakes: result.mistakes,
        }
      }
      return {
        date,
        puzzleNumber: puzzleNumberFor(date),
        status: started.has(date) ? 'in_progress' : 'unplayed',
        mistakes: null,
      }
    })

    const body: ArchiveResponse = { today, launchDate: LAUNCH_DATE, days }
    return NextResponse.json(body)
  } catch (err) {
    console.error('Failed to load Clusters archive:', err)
    return NextResponse.json({ error: 'Could not load the archive.' }, { status: 500 })
  }
}

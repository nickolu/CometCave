import { type NextRequest, NextResponse } from 'next/server'
import {
  getLeaderboardByCategory,
  type LeaderboardCategory,
  type LeaderboardPeriod,
} from '@/app/tap-tap-adventure/lib/adventureLeaderboardStore'

const VALID_PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'alltime']
const VALID_CATEGORIES: LeaderboardCategory[] = ['distance', 'level', 'gold', 'regionsConquered']

export async function GET(request: NextRequest) {
  try {
    const periodParam = request.nextUrl.searchParams.get('period') ?? 'daily'
    const categoryParam = request.nextUrl.searchParams.get('category') ?? 'distance'

    if (!VALID_PERIODS.includes(periodParam as LeaderboardPeriod)) {
      return NextResponse.json(
        { error: 'Invalid period. Use daily, weekly, or alltime.' },
        { status: 400 }
      )
    }

    if (!VALID_CATEGORIES.includes(categoryParam as LeaderboardCategory)) {
      return NextResponse.json(
        { error: 'Invalid category. Use distance, level, gold, or regionsConquered.' },
        { status: 400 }
      )
    }

    const period = periodParam as LeaderboardPeriod
    const category = categoryParam as LeaderboardCategory

    const entries = await getLeaderboardByCategory(category, period, 20)

    return NextResponse.json({ period, category, entries })
  } catch (error: unknown) {
    console.error('Error fetching adventure leaderboard:', error)

    // Firestore index errors — return empty results with a helpful message
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('index') || errMsg.includes('FAILED_PRECONDITION') || errMsg.includes('requires an index')) {
      console.error('Firestore index missing. Create composite index: collection=adventure-scores, fields: date ASC + category DESC')
      const urlMatch = errMsg.match(/(https:\/\/console\.firebase\.google\.com\S+)/)
      if (urlMatch) {
        console.error('Create index here:', urlMatch[1])
      }
      return NextResponse.json({
        period: 'daily',
        category: 'distance',
        entries: [],
        notice: 'Leaderboard is initializing. Please try again in a few minutes.',
      })
    }

    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
  }
}

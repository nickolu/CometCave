import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentWeekRange, getTodayPST } from '@/lib/dates'
import {
  getDailyLeaderboard,
  getWeeklyLeaderboard,
  getAllTimeLeaderboard,
} from '@/app/trivia/lib/leaderboardStore'

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') || 'daily'

    if (period === 'daily') {
      const today = getTodayPST()
      const entries = await getDailyLeaderboard(today, 20)
      return NextResponse.json({ period: 'daily', date: today, entries })
    }

    if (period === 'weekly') {
      const { start, end } = getCurrentWeekRange()
      const entries = await getWeeklyLeaderboard(start, end, 20)
      return NextResponse.json({ period: 'weekly', weekStart: start, weekEnd: end, entries })
    }

    if (period === 'alltime') {
      const entries = await getAllTimeLeaderboard(20)
      return NextResponse.json({ period: 'alltime', entries })
    }

    return NextResponse.json(
      { error: 'Invalid period. Use daily, weekly, or alltime.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('Error fetching leaderboard:', error)

    // Firestore index errors — return empty results with a helpful message
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('index') || errMsg.includes('FAILED_PRECONDITION') || errMsg.includes('requires an index')) {
      console.error('Firestore index missing. Create composite index: collection=trivia-scores, fields: date ASC + score DESC')
      // Log the index creation URL if present
      const urlMatch = errMsg.match(/(https:\/\/console\.firebase\.google\.com\S+)/)
      if (urlMatch) {
        console.error('Create index here:', urlMatch[1])
      }
      return NextResponse.json({
        period: 'daily',
        entries: [],
        notice: 'Leaderboard is initializing. Please try again in a few minutes.',
      })
    }

    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
  }
}

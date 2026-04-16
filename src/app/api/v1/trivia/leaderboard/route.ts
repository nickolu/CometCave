import { type NextRequest, NextResponse } from 'next/server'
import { getTodayPST } from '@/app/trivia/lib/triviaUtils'
import {
  getDailyLeaderboard,
  getWeeklyLeaderboard,
  getAllTimeLeaderboard,
  getCurrentWeekRange,
} from '@/app/trivia/lib/leaderboardStore'

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') || 'daily'

    if (period === 'daily') {
      const today = getTodayPST()
      const entries = getDailyLeaderboard(today, 20)
      return NextResponse.json({ period: 'daily', date: today, entries })
    }

    if (period === 'weekly') {
      const { start, end } = getCurrentWeekRange()
      const entries = getWeeklyLeaderboard(start, end, 20)
      return NextResponse.json({ period: 'weekly', weekStart: start, weekEnd: end, entries })
    }

    if (period === 'alltime') {
      const entries = getAllTimeLeaderboard(20)
      return NextResponse.json({ period: 'alltime', entries })
    }

    return NextResponse.json(
      { error: 'Invalid period. Use daily, weekly, or alltime.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
  }
}

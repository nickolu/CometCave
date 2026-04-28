import { type NextRequest, NextResponse } from 'next/server'

import { getTodayPST, getWeekKey } from '@/lib/dates'
import { getAllTimeTop, getDailyTop, getWeeklyTop } from '@/lib/trivia/queries'

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') || 'daily'

  try {
    if (period === 'daily') {
      const today = getTodayPST()
      const entries = await getDailyTop(today, 20)
      return NextResponse.json({ period: 'daily', date: today, entries })
    }

    if (period === 'weekly') {
      const weekKey = getWeekKey(getTodayPST())
      const entries = await getWeeklyTop(weekKey, 20)
      return NextResponse.json({ period: 'weekly', weekKey, entries })
    }

    if (period === 'alltime') {
      const entries = await getAllTimeTop(20)
      return NextResponse.json({ period: 'alltime', entries })
    }

    return NextResponse.json(
      { error: 'Invalid period. Use daily, weekly, or alltime.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('Error fetching leaderboard:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (
      errMsg.includes('index') ||
      errMsg.includes('FAILED_PRECONDITION') ||
      errMsg.includes('requires an index')
    ) {
      const urlMatch = errMsg.match(/(https:\/\/console\.firebase\.google\.com\S+)/)
      if (urlMatch) console.error('Create index here:', urlMatch[1])
      return NextResponse.json({
        period,
        entries: [],
        notice: 'Leaderboard is initializing. Please try again in a few minutes.',
      })
    }
    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
  }
}

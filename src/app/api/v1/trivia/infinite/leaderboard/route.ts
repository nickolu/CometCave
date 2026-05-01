import { type NextRequest, NextResponse } from 'next/server'

import { CATEGORY_META } from '@/lib/trivia/categories'
import { getInfiniteTopByCategory } from '@/lib/trivia/categoryMedals'
import { getInfiniteTopByScore, getInfiniteTopByStreak } from '@/lib/trivia/infiniteRuns'

export async function GET(request: NextRequest) {
  const sort = request.nextUrl.searchParams.get('sort') || 'score'
  const categoryIdParam = request.nextUrl.searchParams.get('categoryId')

  try {
    if (sort === 'score') {
      const entries = await getInfiniteTopByScore(20)
      return NextResponse.json({ sort: 'score', entries })
    }

    if (sort === 'streak') {
      const entries = await getInfiniteTopByStreak(20)
      return NextResponse.json({ sort: 'streak', entries })
    }

    if (sort === 'category') {
      const categoryId = categoryIdParam !== null ? parseInt(categoryIdParam, 10) : NaN
      if (isNaN(categoryId) || !(categoryId in CATEGORY_META)) {
        return NextResponse.json(
          { error: 'sort=category requires a valid categoryId.' },
          { status: 400 }
        )
      }
      const entries = await getInfiniteTopByCategory(categoryId, 20)
      return NextResponse.json({ sort: 'category', categoryId, entries })
    }

    return NextResponse.json(
      { error: 'Invalid sort. Use score, streak, or category.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('Error fetching infinite leaderboard:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (
      errMsg.includes('index') ||
      errMsg.includes('FAILED_PRECONDITION') ||
      errMsg.includes('requires an index')
    ) {
      const urlMatch = errMsg.match(/(https:\/\/console\.firebase\.google\.com\S+)/)
      if (urlMatch) console.error('Create index here:', urlMatch[1])
      return NextResponse.json({
        sort,
        entries: [],
        notice: 'Leaderboard is initializing. Please try again in a few minutes.',
      })
    }
    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
  }
}

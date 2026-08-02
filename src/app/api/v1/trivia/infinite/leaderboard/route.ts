import { type NextRequest, NextResponse } from 'next/server'

import { CATEGORY_META } from '@/lib/trivia/categories'
import {
  getInfiniteLeaderboardAllCategories,
  getInfiniteTopByCategory,
} from '@/lib/trivia/categoryMedals'
import {
  getCustomTopByScore,
  getCustomTopByStreak,
  getInfiniteTopByScore,
  getInfiniteTopByStreak,
} from '@/lib/trivia/infiniteRuns'

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
      // Single-category mode (kept for backward compat / direct linking).
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

    if (sort === 'allCategories') {
      const sections = await getInfiniteLeaderboardAllCategories(5)
      return NextResponse.json({ sort: 'allCategories', sections })
    }

    if (sort === 'custom') {
      const customSort = request.nextUrl.searchParams.get('customSort') ?? 'score'
      const entries = customSort === 'streak'
        ? await getCustomTopByStreak(20)
        : await getCustomTopByScore(20)
      return NextResponse.json({ sort: 'custom', customSort, entries })
    }

    return NextResponse.json(
      { error: 'Invalid sort. Use score, streak, category, allCategories, or custom.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('Error fetching infinite leaderboard:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (
      errMsg.includes('FAILED_PRECONDITION') ||
      errMsg.includes('requires an index')
    ) {
      const urlMatch = errMsg.match(/(https:\/\/console\.firebase\.google\.com\S+)/)
      if (urlMatch) console.error('Create index here:', urlMatch[1])
      const initializingNotice = 'Leaderboard is initializing. Please try again in a few minutes.'
      if (sort === 'allCategories') {
        return NextResponse.json({ sort, sections: [], notice: initializingNotice })
      }
      return NextResponse.json({ sort, entries: [], notice: initializingNotice })
    }
    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
  }
}

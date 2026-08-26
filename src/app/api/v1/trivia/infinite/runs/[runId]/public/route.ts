import { NextResponse } from 'next/server'
import { getRunByIdPublic } from '@/lib/trivia/infiniteRuns'
import { CATEGORY_META } from '@/lib/trivia/categories'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const result = await getRunByIdPublic(runId)
  if (!result) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const { run } = result
  // Build a category label
  let categoryLabel = 'All Categories'
  if (run.customCategory) {
    categoryLabel = run.customCategory
  } else if (run.categoryFilters && run.categoryFilters.length === 1) {
    categoryLabel = CATEGORY_META[run.categoryFilters[0]]?.name ?? 'Custom'
  } else if (run.categoryFilters && run.categoryFilters.length > 1) {
    categoryLabel = `${run.categoryFilters.length} Categories`
  }

  return NextResponse.json({
    score: run.score,
    longestStreak: run.longestStreak,
    questionsAnswered: run.answers?.length ?? 0,
    mode: run.mode,
    categoryLabel,
  })
}

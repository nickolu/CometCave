import { NextResponse } from 'next/server'

import { computeQuestionStats } from '@/lib/trivia/questionStats'

// GET /api/v1/trivia/questions/stats
// Returns aggregate statistics about the active question pool.
// No auth required — public endpoint.
export async function GET() {
  try {
    const stats = await computeQuestionStats()

    const response = NextResponse.json({
      ...stats,
      cachedAt: new Date().toISOString(),
    })

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=1800'
    )

    return response
  } catch (err) {
    console.error('[trivia/questions/stats] Failed to compute stats:', err)
    return NextResponse.json({ error: 'Failed to compute question stats.' }, { status: 500 })
  }
}

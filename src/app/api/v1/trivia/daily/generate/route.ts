// POST /api/v1/trivia/daily/generate?lookahead=N
// Protected by Authorization: Bearer DAILY_TRIVIA_CRON_SECRET env var
// Generates questions for today + next N days, skipping dates already in Firestore
// Returns { generated: string[], skipped: string[], failed: string[] }

import { type NextRequest, NextResponse } from 'next/server'

import { getTodayPST } from '@/lib/dates'
import { getDailyQuestions, setDailyQuestions } from '@/lib/trivia/dailyQuestionsDb'
import { daysSinceEpoch, generateQuestionsForDate } from '@/lib/trivia/generateDailyQuestions'

export const maxDuration = 300 // generation can take a while

export async function POST(request: NextRequest) {
  // Auth: Bearer token from env var
  const secret = process.env.DAILY_TRIVIA_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'DAILY_TRIVIA_CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const lookahead = Math.min(parseInt(searchParams.get('lookahead') ?? '2', 10), 7)

  const today = getTodayPST()
  const dates = Array.from({ length: lookahead + 1 }, (_, i) => {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })

  const generated: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  for (const dateStr of dates) {
    const existing = await getDailyQuestions(dateStr)
    if (existing && existing.questions.length > 0) {
      skipped.push(dateStr)
      continue
    }
    try {
      const questions = await generateQuestionsForDate(dateStr)
      if (questions.length === 0) throw new Error('No questions generated')
      const days = daysSinceEpoch(dateStr)
      const categoryId = 9 + (days % 24)
      await setDailyQuestions(dateStr, {
        date: dateStr,
        categoryId,
        categoryName: questions[0]?.category ?? 'General Knowledge',
        questions,
      })
      generated.push(dateStr)
    } catch (err) {
      console.error(`[trivia/daily/generate] Failed for ${dateStr}:`, err)
      failed.push(dateStr)
    }
  }

  console.log('[trivia/daily/generate] completed', { generated, skipped, failed })
  return NextResponse.json({ generated, skipped, failed })
}

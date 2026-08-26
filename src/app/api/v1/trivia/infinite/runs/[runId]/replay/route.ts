import { verifyRequestAuth } from '@/lib/api/auth'
import { NextResponse } from 'next/server'
import { getRunByIdPublic, startRun } from '@/lib/trivia/infiniteRuns'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await verifyRequestAuth(request as import('next/server').NextRequest)
  if ('error' in auth) return auth.error

  const { runId } = await params
  const result = await getRunByIdPublic(runId)
  if (!result) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const { run } = result
  // Need at least 1 answered question to replay
  if (!run.answers || run.answers.length === 0) {
    return NextResponse.json({ error: 'Run has no questions to replay' }, { status: 400 })
  }

  const questionIds = run.answers.map((a) => a.questionId)

  try {
    const newRun = await startRun(
      auth.claims.uid,
      run.mode,
      run.categoryFilters ?? [],
      run.customCategory ?? null,
      { challengeSourceRunId: runId, replayQuestionIds: questionIds }
    )
    return NextResponse.json({ replayRunId: newRun.runId, questionsCount: questionIds.length })
  } catch (err) {
    console.error('[replay] Failed to create replay run:', err)
    return NextResponse.json({ error: 'Failed to create replay run' }, { status: 500 })
  }
}

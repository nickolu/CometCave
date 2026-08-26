'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { InfiniteGame } from '@/app/trivia/components/InfiniteGame'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'

function InfiniteTriviaPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode')
  const mode: InfiniteMode = modeParam === 'practice' ? 'practice' : 'scored'

  // Optional custom-category launch from the question library.
  // ?customCategory=<topic>&existing=1 means "play existing questions for this topic".
  const customCategoryParam = searchParams.get('customCategory')
  const initialCustomCategory = customCategoryParam && customCategoryParam.trim().length >= 3
    ? customCategoryParam.trim()
    : null
  const sampleExistingOnly = searchParams.get('existing') === '1'

  const replayRunIdParam = searchParams.get('replayRunId')
  const replayRunId = replayRunIdParam && replayRunIdParam.trim() ? replayRunIdParam.trim() : null
  const replaySourceRunIdParam = searchParams.get('replaySourceRunId')
  const replaySourceRunId = replaySourceRunIdParam && replaySourceRunIdParam.trim() ? replaySourceRunIdParam.trim() : null

  return (
    <InfiniteGame
      onBack={() => router.push('/trivia')}
      onViewStats={() => router.push('/trivia/stats?tab=infinite')}
      onViewLeaderboard={() => router.push('/trivia/leaderboard?tab=infinite')}
      mode={mode}
      initialCustomCategory={initialCustomCategory}
      sampleExistingOnly={sampleExistingOnly}
      replayRunId={replayRunId}
      replaySourceRunId={replaySourceRunId}
    />
  )
}

export default function InfiniteTriviaPage() {
  return (
    <Suspense fallback={null}>
      <InfiniteTriviaPageInner />
    </Suspense>
  )
}

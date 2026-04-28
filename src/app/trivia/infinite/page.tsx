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
  return <InfiniteGame onBack={() => router.push('/trivia')} mode={mode} />
}

export default function InfiniteTriviaPage() {
  return (
    <Suspense fallback={null}>
      <InfiniteTriviaPageInner />
    </Suspense>
  )
}

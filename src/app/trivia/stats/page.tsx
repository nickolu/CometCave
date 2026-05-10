'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { UnifiedStats } from '@/app/trivia/components/UnifiedStats'

function TriviaStatsPageInner() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const defaultTab = tab === 'infinite' ? 'infinite' : 'daily'

  return <UnifiedStats defaultTab={defaultTab} />
}

export default function TriviaStatsPage() {
  return (
    <Suspense fallback={null}>
      <TriviaStatsPageInner />
    </Suspense>
  )
}

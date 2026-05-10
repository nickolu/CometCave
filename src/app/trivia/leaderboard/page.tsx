'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { InfiniteLeaderboard } from '@/app/trivia/components/InfiniteLeaderboard'
import { TriviaLeaderboard } from '@/app/trivia/components/TriviaLeaderboard'
import { ChunkyButton } from '@/components/ui/chunky-button'

function TriviaLeaderboardPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const isInfinite = tab === 'infinite'

  function handleBack() {
    router.push('/trivia')
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto pt-6">
      {/* Tab toggle */}
      <div className="grid grid-cols-2 gap-2 px-4">
        <ChunkyButton
          variant={!isInfinite ? 'primary' : 'secondary'}
          onClick={() => router.push('/trivia/leaderboard')}
        >
          Daily
        </ChunkyButton>
        <ChunkyButton
          variant={isInfinite ? 'primary' : 'secondary'}
          onClick={() => router.push('/trivia/leaderboard?tab=infinite')}
        >
          Infinite
        </ChunkyButton>
      </div>

      {isInfinite ? (
        <InfiniteLeaderboard onBack={handleBack} />
      ) : (
        <TriviaLeaderboard onBack={handleBack} />
      )}
    </div>
  )
}

export default function TriviaLeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <TriviaLeaderboardPageInner />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { InfiniteStats } from './InfiniteStats'
import { TriviaFooter } from './TriviaFooter'
import { TriviaStats } from './TriviaStats'

type StatsTab = 'daily' | 'infinite'

export function UnifiedStats({
  defaultTab = 'daily',
}: {
  defaultTab?: StatsTab
}) {
  const [tab, setTab] = useState<StatsTab>(defaultTab)
  const currentTarget = tab === 'daily' ? 'stats' : 'infinite-stats'

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto pt-6">
      {/* Back link */}
      <div className="px-4">
        <Link
          href="/trivia"
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors text-sm underline-offset-4 hover:underline"
        >
          ← Back
        </Link>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 px-4">
        <ChunkyButton
          variant={tab === 'daily' ? 'primary' : 'secondary'}
          onClick={() => setTab('daily')}
        >
          Daily
        </ChunkyButton>
        <ChunkyButton
          variant={tab === 'infinite' ? 'primary' : 'secondary'}
          onClick={() => setTab('infinite')}
        >
          Infinite
        </ChunkyButton>
      </div>

      {/* Tab content */}
      {tab === 'daily' ? (
        <TriviaStats />
      ) : (
        <InfiniteStats />
      )}

      <div className="px-4 pb-6">
        <TriviaFooter current={currentTarget} />
      </div>
    </div>
  )
}

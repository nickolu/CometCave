'use client'

import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { InfiniteStats } from './InfiniteStats'
import { TriviaFooter, type TriviaNav } from './TriviaFooter'
import { TriviaStats } from './TriviaStats'

type StatsTab = 'daily' | 'infinite'

export function UnifiedStats({
  onBack,
  defaultTab = 'daily',
  nav,
}: {
  onBack: () => void
  defaultTab?: StatsTab
  nav?: TriviaNav
}) {
  const [tab, setTab] = useState<StatsTab>(defaultTab)
  const currentTarget = tab === 'daily' ? 'stats' : 'infinite-stats'

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto pt-6">
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
        <TriviaStats onBack={onBack} />
      ) : (
        <InfiniteStats onBack={onBack} />
      )}

      {nav && (
        <div className="px-4 pb-6">
          <TriviaFooter current={currentTarget} {...nav} />
        </div>
      )}
    </div>
  )
}

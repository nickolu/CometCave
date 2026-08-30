'use client'
import './badge-run.css'
import { useEffect } from 'react'
import { useBlitzStore } from './store'
import { DraftScreen } from './components/DraftScreen'
import { BattleScreen } from './components/BattleScreen'
import { SummaryScreen } from './components/SummaryScreen'
import { NarratorScreen } from './components/NarratorScreen'
import { ErrorBoundary } from './components/ErrorBoundary'

function BadgeRunInner() {
  const { run, alreadyPlayedToday, startDailyRun, playAgain } = useBlitzStore()

  useEffect(() => {
    if (!run && !alreadyPlayedToday) startDailyRun()
  }, [run, alreadyPlayedToday, startDailyRun])

  if (alreadyPlayedToday && !run) {
    return (
      <NarratorScreen
        headline="You already played today"
        body="Come back tomorrow to play again."
        action={{ label: 'play again anyway', onClick: playAgain }}
      />
    )
  }

  if (!run || run.phase === 'idle') {
    return (
      <NarratorScreen
        headline="Setting up your run..."
        body="Loading..."
        dim
      />
    )
  }

  if (run.phase === 'draft') return <DraftScreen />
  if (run.phase === 'battle' || run.phase === 'evolve') return <BattleScreen />
  if (run.phase === 'summary') return <SummaryScreen />

  return null
}

export default function BadgeRunPage() {
  return (
    <ErrorBoundary>
      <BadgeRunInner />
    </ErrorBoundary>
  )
}

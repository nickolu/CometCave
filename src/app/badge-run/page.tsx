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
        headline="the cave remembers you"
        body="you already faced the gauntlet today. the arena rests until tomorrow — but the stars never fully sleep."
        action={{ label: 'play again anyway', onClick: playAgain }}
      />
    )
  }

  if (!run || run.phase === 'idle') {
    return (
      <NarratorScreen
        headline="summoning the arena"
        body="the constellations are aligning. your opponents are already waiting."
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

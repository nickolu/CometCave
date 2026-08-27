'use client'
import './badge-run.css'
import { useEffect } from 'react'
import { useBlitzStore } from './store'
import { DraftScreen } from './components/DraftScreen'
import { BattleScreen } from './components/BattleScreen'
import { SummaryScreen } from './components/SummaryScreen'

export default function BadgeRunPage() {
  const { run, startDailyRun } = useBlitzStore()

  useEffect(() => {
    if (!run) startDailyRun()
  }, [run, startDailyRun])

  if (!run || run.phase === 'idle') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, letterSpacing: 1 }}>
          Summoning the arena…
        </p>
      </div>
    )
  }

  if (run.phase === 'draft') return <DraftScreen />
  if (run.phase === 'battle' || run.phase === 'evolve') return <BattleScreen />
  if (run.phase === 'summary') return <SummaryScreen />

  return null
}

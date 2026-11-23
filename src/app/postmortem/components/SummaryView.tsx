'use client'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { CARDS_BY_ID } from '@/app/postmortem/data/cards'
import { RUN_LENGTH } from '@/app/postmortem/lib/rules'
import { useStoredData } from '@/app/postmortem/useStoredData'

import { PostmortemCard } from './PostmortemCard'

import type { FinishedRun } from '@/app/postmortem/usePostmortem'

function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SummaryView({
  finished,
  onPlayAgain,
  onCollection,
}: {
  finished: FinishedRun
  onPlayAgain: () => void
  onCollection: () => void
}) {
  const data = useStoredData()
  const { stats } = finished

  return (
    <div className="pm-page">
      <div className="pm-summary">
        <h1 className="pm-title">Run complete</h1>

        {finished.isNewHighScore && <div className="pm-callout" role="status">New high score</div>}

        <div className="pm-panel">
          <h3>Your score</h3>
          <div className="pm-bigscore">{finished.score}</div>
          <div>
            {finished.previousBest === null
              ? 'This is your first saved run.'
              : finished.isNewHighScore
                ? `You beat your old best of ${finished.previousBest}.`
                : `High score to beat: ${finished.previousBest}.`}
          </div>
        </div>

        <div className="pm-panel">
          <h3>Incidents fully solved</h3>
          <span className="pm-points">
            {stats.fullySolved} of {RUN_LENGTH}
          </span>{' '}
          (every factor found, no wrong cards)
        </div>

        <div className="pm-panel">
          <h3>Top 5 runs</h3>
          <table className="pm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Score</th>
                <th>Solved</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.topRuns.map((r, i) => (
                <tr key={`${r.date}-${i}`} data-current={r.date === finished.dateIso}>
                  <td>{i + 1}</td>
                  <td>{r.score}</td>
                  <td>{r.solved}</td>
                  <td>{formatDate(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pm-panel">
          <h3>Cards you got wrong or missed most this run</h3>
          {stats.mostMissed.length === 0 ? (
            'None. Every card was right.'
          ) : (
            <div className="pm-missed-row">
              {stats.mostMissed.map(m => (
                <div key={m.id} className="pm-cell">
                  <PostmortemCard card={CARDS_BY_ID[m.id]} />
                  <span className="pm-acc">{m.count === 1 ? '1 time' : `${m.count} times`}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pm-actions">
          <ChunkyButton size="lg" data-pm-native onClick={onPlayAgain}>
            Play again
          </ChunkyButton>
          <ChunkyButton variant="secondary" size="lg" data-pm-native onClick={onCollection}>
            View collection
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

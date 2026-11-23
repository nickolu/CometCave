'use client'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { CARDS_BY_ID } from '@/app/postmortem/data/cards'
import { CLUE_COUNT, classifyHand } from '@/app/postmortem/lib/rules'
import { highScore } from '@/app/postmortem/lib/storage'
import { useStoredData } from '@/app/postmortem/useStoredData'

import { PostmortemCard } from './PostmortemCard'
import { Timeline } from './Timeline'
import { TopBar } from './TopBar'

import type { usePostmortem } from '@/app/postmortem/usePostmortem'

type Game = ReturnType<typeof usePostmortem>

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function PlayView({ game, onCollection }: { game: Game; onCollection: () => void }) {
  const { run, multiplier, notice } = game
  const data = useStoredData()
  const incident = run.incidents[run.index]
  const hand = run.hands[run.index]
  const outcome = run.outcome
  const marks = outcome ? classifyHand(incident, hand, run.selected) : null
  const isLast = run.index + 1 === run.incidents.length

  return (
    <>
      <TopBar
        incidentNumber={run.index + 1}
        total={run.incidents.length}
        score={run.totalScore}
        best={highScore(data)}
        multiplier={outcome ? outcome.multiplier : multiplier}
        onCollection={onCollection}
      />

      <div className="pm-middle">
        <h1 className="pm-title">{incident.title}</h1>
        <Timeline incident={incident} cluesRevealed={run.cluesRevealed} />

        {outcome && (
          <>
            <div className="pm-panel" aria-live="polite">
              <h3>Result</h3>
              <span className={`pm-points ${outcome.points >= 0 ? 'pm-points--pos' : 'pm-points--neg'}`}>
                {outcome.points >= 0 ? '+' : ''}
                {outcome.points} points
              </span>{' '}
              ({plural(outcome.correct.length, 'correct card')} at ×{outcome.multiplier}, {plural(outcome.wrong.length, 'wrong card')},{' '}
              {plural(outcome.missed.length, 'missed card')})
            </div>
            <div className="pm-panel">
              <h3>What happened</h3>
              {incident.explanation}
            </div>
            {incident.decoys.some(d => run.selected.includes(d.id)) && (
              <div className="pm-panel">
                <h3>Why those were wrong</h3>
                <ul>
                  {incident.decoys
                    .filter(d => run.selected.includes(d.id))
                    .map(d => (
                      <li key={d.id}>
                        <strong>{CARDS_BY_ID[d.id].nickname}:</strong> {d.whyNot}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {incident.decoys.some(d => !run.selected.includes(d.id)) && (
              <div className="pm-panel">
                <h3>Look-alikes you skipped</h3>
                <ul>
                  {incident.decoys
                    .filter(d => !run.selected.includes(d.id))
                    .map(d => (
                      <li key={d.id}>
                        <strong>{CARDS_BY_ID[d.id].nickname}:</strong> {d.whyNot}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pm-controls">
        {outcome ? (
          <ChunkyButton size="lg" onClick={game.next}>
            {isLast ? 'See results' : 'Next incident'}
          </ChunkyButton>
        ) : (
          <>
            <ChunkyButton variant="secondary" size="lg" disabled={run.cluesRevealed >= CLUE_COUNT} onClick={game.revealNext}>
              Reveal next clue
            </ChunkyButton>
            <ChunkyButton size="lg" onClick={game.commit}>
              Commit
            </ChunkyButton>
            {notice && (
              <span className="pm-notice" role="alert">
                {notice}
              </span>
            )}
          </>
        )}
      </div>

      <div className="pm-hand" role="group" aria-label="Your hand">
        {hand.map((id, i) => (
          <PostmortemCard
            key={id}
            card={CARDS_BY_ID[id]}
            keyHint={i + 1}
            selected={run.selected.includes(id)}
            result={marks?.[id]}
            onClick={outcome ? undefined : () => game.toggleIndex(i)}
          />
        ))}
      </div>
      <div className="pm-hint">Keys: 1 to 8 pick a card, Space reveals the next clue, Enter commits{outcome ? ' or moves on' : ''}.</div>
    </>
  )
}

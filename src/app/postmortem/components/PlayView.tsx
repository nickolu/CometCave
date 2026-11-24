'use client'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { CARDS_BY_ID } from '@/app/postmortem/data/cards'
import { tellApart } from '@/app/postmortem/data/card-info'
import { classifyHand } from '@/app/postmortem/lib/rules'
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

export function PlayView({
  game,
  onCollection,
  onInfo,
}: {
  game: Game
  onCollection: () => void
  onInfo: (cardId: string, trigger: HTMLElement) => void
}) {
  const { run, multiplier, notice, cluesRevealed, eliminationsLeft } = game
  const data = useStoredData()
  const incident = run.incidents[run.index]
  const hand = run.hands[run.index]
  const outcome = run.outcome
  const marks = outcome ? classifyHand(incident, hand, run.played) : null
  const isLast = run.index + 1 === run.incidents.length
  const wrongOrMissed = outcome ? [...outcome.wrong, ...outcome.missed] : []
  const mixups = wrongOrMissed.flatMap(id => {
    // Prefer the pair that actually happened in this incident.
    const others = outcome?.wrong.includes(id) ? incident.factors : outcome?.wrong ?? []
    const tell = tellApart(id, others)
    return tell ? [{ id, tell }] : []
  })
  const nextMultiplier = Math.max(1, multiplier - 1)
  const lifelineNote =
    eliminationsLeft <= 0
      ? 'No lifelines left: the multiplier is already at ×1'
      : run.armed
        ? 'Unselect your card to use the lifeline'
        : `Removes one random wrong card · costs ×1 multiplier (×${multiplier} → ×${nextMultiplier}) · ${eliminationsLeft} left`
  const playedNames = run.played.map(id => CARDS_BY_ID[id].nickname)

  return (
    <>
      <TopBar
        incidentNumber={run.index + 1}
        total={run.incidents.length}
        score={run.totalScore}
        best={highScore(data)}
        multiplier={outcome ? outcome.multiplier : multiplier}
        eliminationsLeft={eliminationsLeft}
        onCollection={onCollection}
      />

      <div className="pm-middle">
        <h1 className="pm-title">{incident.title}</h1>
        <Timeline incident={incident} cluesRevealed={cluesRevealed} />

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
            {incident.decoys.some(d => run.played.includes(d.id)) && (
              <div className="pm-panel">
                <h3>Why those were wrong</h3>
                <ul>
                  {incident.decoys
                    .filter(d => run.played.includes(d.id))
                    .map(d => (
                      <li key={d.id}>
                        <strong>{CARDS_BY_ID[d.id].nickname}:</strong> {d.whyNot}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {incident.decoys.some(d => !run.played.includes(d.id)) && (
              <div className="pm-panel">
                <h3>Look-alikes you skipped</h3>
                <ul>
                  {incident.decoys
                    .filter(d => !run.played.includes(d.id))
                    .map(d => (
                      <li key={d.id}>
                        <strong>{CARDS_BY_ID[d.id].nickname}:</strong> {d.whyNot}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {mixups.length > 0 && (
              <div className="pm-panel">
                <h3>How to tell them apart</h3>
                <ul>
                  {mixups.map(m => (
                    <li key={m.id}>
                      <strong>
                        {CARDS_BY_ID[m.id].nickname} ({outcome?.wrong.includes(m.id) ? 'wrong' : 'missed'}):
                      </strong>{' '}
                      {m.tell.howToTell}
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
            <ChunkyButton size="lg" disabled={!run.armed} onClick={game.lockIn}>
              Lock in (L)
            </ChunkyButton>
            <ChunkyButton
              variant="secondary"
              size="lg"
              className="pm-lifeline"
              disabled={eliminationsLeft <= 0 || !!run.armed}
              title={lifelineNote}
              aria-describedby="pm-lifeline-note"
              onClick={game.eliminate}
            >
              <span className="pm-lifeline__label">Lifeline: eliminate a wrong card (E)</span>
              <span id="pm-lifeline-note" className="pm-lifeline__note" aria-hidden>
                {lifelineNote}
              </span>
            </ChunkyButton>
            <ChunkyButton size="lg" disabled={run.played.length === 0} onClick={game.commit}>
              Close the case
            </ChunkyButton>
            <span className="pm-played" aria-live="polite">
              {playedNames.length === 0 ? 'Nothing played yet.' : `Played: ${playedNames.join(', ')}.`}
            </span>
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
            armed={run.armed === id}
            played={run.played.includes(id)}
            eliminated={run.eliminated.includes(id)}
            result={marks?.[id]}
            onClick={outcome ? undefined : () => game.pressCard(i)}
            onInfo={onInfo}
          />
        ))}
      </div>
      <div className="pm-hint">
        {outcome
          ? 'Enter moves on.'
          : 'Keys: 1 to 8 select a card (press again to unselect), L locks it in, Esc clears. E uses the lifeline: removes a random wrong card for one multiplier step. ? shows info for the selected card. Enter closes the case.'}
      </div>
    </>
  )
}

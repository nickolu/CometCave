'use client'

import type { Incident } from '@/app/postmortem/data/incidents'

export function Timeline({ incident, cluesRevealed }: { incident: Incident; cluesRevealed: number }) {
  return (
    <>
      <p className="pm-background">{incident.background}</p>
      <ol className="pm-timeline" aria-label="Timeline">
        {incident.clues.map((clue, i) =>
          i < cluesRevealed ? (
            <li key={i} className="pm-clue">
              <span className="pm-clue__n">Clue {i + 1}</span>
              {clue}
            </li>
          ) : (
            <li key={i} className="pm-clue pm-clue--locked">
              <span className="pm-clue__n">Clue {i + 1}</span>
              Locked. Play {i === 1 ? 'a card' : 'a second card'} to reveal it.
            </li>
          )
        )}
      </ol>
    </>
  )
}

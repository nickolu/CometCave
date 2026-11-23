'use client'

import type { Incident } from '@/app/postmortem/data/incidents'

export function Timeline({ incident, cluesRevealed }: { incident: Incident; cluesRevealed: number }) {
  return (
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
            Locked. Reveal it to read it, but your multiplier drops.
          </li>
        )
      )}
    </ol>
  )
}

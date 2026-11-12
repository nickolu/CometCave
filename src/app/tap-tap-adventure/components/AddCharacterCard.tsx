'use client'
import React from 'react'

interface AddCharacterCardProps {
  onClick: () => void
}

/** An empty poster frame on the foyer wall, waiting for a new bill. */
export default function AddCharacterCard({ onClick }: AddCharacterCardProps) {
  return (
    <button
      className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-[3px] border-2 border-dashed border-ps-brass p-4 text-ps-brass-light transition-colors hover:bg-ps-lacquer-ink/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
      onClick={onClick}
      tabIndex={0}
      aria-label="Print a new character"
      type="button"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ps-brass font-playbill text-3xl leading-none" aria-hidden>
        +
      </span>
      <span className="font-playbill text-base uppercase tracking-widest">Print a new character</span>
    </button>
  )
}

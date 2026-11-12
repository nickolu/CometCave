'use client'
import React from 'react'

import { getDifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { BrassPlate, PaperButton, PlaybillCaption, PlaybillSheet, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface CharacterCardProps {
  character: FantasyCharacter
  selected?: boolean
  onSelect?: (character: FantasyCharacter) => void
  onDelete?: (e: React.MouseEvent, id: string) => void
  onRetire?: (e: React.MouseEvent, id: string) => void
}

const DIFF_TONE: Record<string, StampTone> = {
  hard: 'red',
  ironman: 'red',
  casual: 'green',
}

/** One engraved figure on the poster's brass strip. */
function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1 py-1.5 text-center">
      <span className="font-playbill text-base leading-none tabular-nums">{value}</span>
      <span className="mt-1 font-label text-xs font-bold uppercase leading-none tracking-widest text-ps-ink/80">{label}</span>
    </div>
  )
}

export default function CharacterCard({
  character,
  selected,
  onSelect,
  onDelete,
  onRetire,
}: CharacterCardProps) {
  const canRetire = character.status === 'active' && (character.distance ?? 0) >= 100
  const diffMode = getDifficultyMode(character.difficultyMode ?? 'normal')
  const ended = character.status === 'retired' || character.status === 'dead'

  return (
    <PlaybillSheet
      className={cn(
        'flex min-h-[300px] cursor-pointer select-none flex-col px-4 pb-4 pt-5 text-ps-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary',
        selected && 'outline outline-4 outline-offset-2 outline-ps-brass'
      )}
      onClick={() => onSelect?.(character)}
      tabIndex={0}
      aria-label={`${character.name}, level ${character.level} ${character.race} ${character.class}${ended ? `, ${character.status}` : ''}`}
    >
      {/* the bill's head */}
      <div className={cn('text-center', ended && 'opacity-70')}>
        <PlaybillCaption>
          Lv {character.level} · {character.race} · {character.class}
        </PlaybillCaption>
        <h3 className="mt-1 break-words border-y-2 border-ps-ink px-2 py-1.5 font-playbill text-xl uppercase leading-tight tracking-wide sm:text-2xl">
          {character.name}
        </h3>
      </div>

      {/* stamps the printer added */}
      {(diffMode.id !== 'normal' || (character.deathCount ?? 0) > 0) && (
        <div className={cn('mt-3 flex flex-wrap items-center justify-center gap-2', ended && 'opacity-70')}>
          {diffMode.id !== 'normal' && (
            <Stamp tone={DIFF_TONE[diffMode.id] ?? 'ink'} title={diffMode.description}>
              {diffMode.name}
            </Stamp>
          )}
          {(character.deathCount ?? 0) > 0 && (
            <Stamp tone="red" tilt={false}>
              {character.deathCount} {character.deathCount === 1 ? 'death' : 'deaths'}
            </Stamp>
          )}
        </div>
      )}

      {/* the figures */}
      <BrassPlate className={cn('mt-auto pt-3', ended && 'opacity-80')} aria-label={`${character.name}'s figures`}>
        <div className="grid grid-cols-2 divide-x-2 divide-ps-brass-deep/60 border-b-2 border-ps-brass-deep/60">
          <Figure label="Gold" value={character.gold} />
          <Figure label="Repute" value={character.reputation} />
        </div>
        <div className="grid grid-cols-4 divide-x-2 divide-ps-brass-deep/60">
          <Figure label="Str" value={character.strength} />
          <Figure label="Int" value={character.intelligence} />
          <Figure label="Lck" value={character.luck} />
          <Figure label="Cha" value={character.charisma} />
        </div>
      </BrassPlate>

      {onRetire && canRetire && (
        <PaperButton
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={e => {
            e.stopPropagation()
            onRetire(e, character.id)
          }}
          aria-label={`Retire ${character.name}`}
        >
          Retire
        </PaperButton>
      )}

      {/* the big stamp across a finished poster */}
      {character.status === 'retired' && (
        <Stamp
          tone="gold"
          tilt={false}
          className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 -rotate-12 border-[3px] px-3 py-1 font-playbill text-2xl tracking-widest"
          aria-hidden
        >
          Retired
        </Stamp>
      )}
      {character.status === 'dead' && (
        <Stamp
          tone="red"
          tilt={false}
          className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 -rotate-12 border-[3px] px-3 py-1 font-playbill text-2xl tracking-widest"
          aria-hidden
        >
          Dead
        </Stamp>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDelete(e, character.id)
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ps-ink/50 text-ps-ink-soft transition-colors hover:border-ps-stamp-red hover:bg-ps-stamp-red hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          aria-label={`Delete ${character.name}`}
        >
          <CloseIcon size={14} />
        </button>
      )}
    </PlaybillSheet>
  )
}

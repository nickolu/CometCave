'use client'

import { useRef, useState } from 'react'

import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'

interface StatAllocationScreenProps {
  character: FantasyCharacter
  onConfirm: (strength: number, intelligence: number, luck: number, charisma: number) => void
}

const STAT_DESCRIPTIONS: Record<string, string> = {
  strength: 'Attack power, max HP',
  intelligence: 'Defense, mana pool',
  luck: 'Crit chance, loot drops, flee chance',
  charisma: 'Shop discounts, NPC dialogue',
}

const STAT_LABELS: Record<string, string> = {
  strength: 'STR',
  intelligence: 'INT',
  luck: 'LCK',
  charisma: 'CHA',
}

export function StatAllocationScreen({ character, onConfirm }: StatAllocationScreenProps) {
  const [allocation, setAllocation] = useState({ strength: 0, intelligence: 0, luck: 0, charisma: 0 })
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  const totalAllocated = allocation.strength + allocation.intelligence + allocation.luck + allocation.charisma
  const remaining = (character.pendingStatPoints ?? 0) - totalAllocated
  const allSpent = remaining === 0

  const addPoint = (stat: keyof typeof allocation) => {
    if (remaining <= 0) return
    setAllocation(prev => ({ ...prev, [stat]: prev[stat] + 1 }))
  }

  const removePoint = (stat: keyof typeof allocation) => {
    if (allocation[stat] <= 0) return
    setAllocation(prev => ({ ...prev, [stat]: prev[stat] - 1 }))
  }

  const handleConfirm = () => {
    if (!allSpent) return
    onConfirm(allocation.strength, allocation.intelligence, allocation.luck, allocation.charisma)
  }

  const stats = ['strength', 'intelligence', 'luck', 'charisma'] as const

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Allocate stat points">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ps-house/70" />

      {/* Content */}
      <div className="relative mx-4 w-full max-w-sm">
        <PlaybillSheet className="ps-print-in px-5 pb-5 pt-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <Stamp tone="gold" animate className="border-[3px] px-3 py-1 font-playbill text-2xl tracking-widest">
              Level {character.level}
            </Stamp>
            <PlaybillTitle size="sm" className="w-full">Spend your points</PlaybillTitle>
          </div>

          {/* Remaining points on brass */}
          <BrassPlate className="mx-auto mt-4 w-fit min-w-[140px]">
            <BrassFigure label={remaining === 1 ? 'point left' : 'points left'} value={remaining} />
          </BrassPlate>

          {/* Stat rows */}
          <ul className="mt-4 divide-y-2 divide-dotted divide-ps-ink/40 border-y-2 border-dotted border-ps-ink/40">
            {stats.map(stat => (
              <li key={stat} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-baseline gap-2">
                    <span className="font-playbill text-base uppercase tracking-wide text-ps-ink">{STAT_LABELS[stat]}</span>
                    <span className="font-playbill text-xl leading-none tabular-nums text-ps-ink">{character[stat]}</span>
                    {allocation[stat] > 0 && (
                      <Stamp tone="green" tilt={false} className="text-xs">
                        +{allocation[stat]}
                      </Stamp>
                    )}
                  </div>
                  <PlaybillCaption className="mt-0.5 normal-case tracking-normal">{STAT_DESCRIPTIONS[stat]}</PlaybillCaption>
                </div>
                <div className="flex items-center gap-1">
                  <PaperButton
                    variant="outline"
                    size="sm"
                    className="w-8 px-0 font-playbill text-base"
                    onClick={() => removePoint(stat)}
                    disabled={allocation[stat] <= 0}
                    aria-label={`Remove point from ${STAT_LABELS[stat]}`}
                  >
                    &minus;
                  </PaperButton>
                  <PaperButton
                    variant="outline"
                    size="sm"
                    className="w-8 px-0 font-playbill text-base"
                    onClick={() => addPoint(stat)}
                    disabled={remaining <= 0}
                    aria-label={`Add point to ${STAT_LABELS[stat]}`}
                  >
                    +
                  </PaperButton>
                </div>
              </li>
            ))}
          </ul>

          {/* Confirm button */}
          <PaperButton className="mt-4 w-full" onClick={handleConfirm} disabled={!allSpent}>
            {allSpent ? 'Confirm' : `Allocate ${remaining} more point${remaining !== 1 ? 's' : ''}`}
          </PaperButton>
        </PlaybillSheet>
      </div>
    </div>
  )
}

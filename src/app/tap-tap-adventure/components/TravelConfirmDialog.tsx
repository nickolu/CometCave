'use client'

/**
 * The question asked before you cross into another country: a bill over the
 * dark house with the region's name, its stamps, and Go or Stay.
 */
import { useEffect, useRef } from 'react'

import { Region } from '@/app/tap-tap-adventure/config/regions'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

interface TravelConfirmDialogProps {
  region: Region
  onConfirm: () => void
  onCancel: () => void
}

const DIFFICULTY_BADGE: Record<string, { label: string; tone: StampTone }> = {
  easy: { label: 'Easy', tone: 'green' },
  medium: { label: 'Medium', tone: 'gold' },
  hard: { label: 'Hard', tone: 'red' },
  very_hard: { label: 'Very hard', tone: 'red' },
  extreme: { label: 'Extreme', tone: 'violet' },
}

const ELEMENT_BADGE: Record<string, { label: string; tone: StampTone }> = {
  nature: { label: 'Nature', tone: 'green' },
  shadow: { label: 'Shadow', tone: 'ink' },
  arcane: { label: 'Arcane', tone: 'violet' },
  fire: { label: 'Fire', tone: 'red' },
  ice: { label: 'Ice', tone: 'blue' },
  none: { label: 'Neutral', tone: 'ink' },
}

export function TravelConfirmDialog({ region, onConfirm, onCancel }: TravelConfirmDialogProps) {
  const difficulty = DIFFICULTY_BADGE[region.difficulty] ?? DIFFICULTY_BADGE.easy
  const element = ELEMENT_BADGE[region.element] ?? ELEMENT_BADGE.none

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "color-mix(in srgb, var(--ps-house) 70%, transparent)" }} onClick={onCancel}>
      <div
        ref={dialogRef}
        className="w-full max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`Travel to ${region.name}`}
        onClick={e => e.stopPropagation()}
      >
        <PlaybillSheet className="space-y-4 px-5 pb-5 pt-4">
          <div className="text-center">
            <span className="font-body text-3xl leading-none" aria-hidden>{region.icon}</span>
            <PlaybillTitle size="md" className="mt-2">{region.name}</PlaybillTitle>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Stamp tone={difficulty.tone}>{difficulty.label}</Stamp>
              {region.element !== 'none' && <Stamp tone={element.tone} tilt={false}>{element.label} country</Stamp>}
              {region.minLevel > 0 && <Stamp tone="ink" tilt={false}>Lv {region.minLevel}+</Stamp>}
            </div>
          </div>

          <p className="font-body text-base leading-relaxed text-ps-ink">{region.description}</p>

          {region.enemyTypes.length > 0 && (
            <div>
              <PlaybillCaption>What lives there</PlaybillCaption>
              <p className="mt-1 font-body text-sm capitalize text-ps-ink-soft">{region.enemyTypes.join(', ')}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <PaperButton className="flex-1" onClick={onConfirm}>
              Go
            </PaperButton>
            <PaperButton variant="outline" className="flex-1" autoFocus onClick={onCancel}>
              Stay
            </PaperButton>
          </div>
        </PlaybillSheet>
      </div>
    </div>
  )
}

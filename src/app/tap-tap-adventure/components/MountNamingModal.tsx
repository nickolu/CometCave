'use client'

/**
 * Naming a new mount: a bill held up in front of the dark house. Escape or
 * the scrim skips naming; the mount is bought either way.
 */
import { useEffect, useRef, useState } from 'react'

import { MOUNT_PERSONALITY_INFO } from '@/app/tap-tap-adventure/config/mounts'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

interface MountNamingModalProps {
  mount: Mount
  isOpen: boolean
  onConfirm: (customName?: string) => void
}

const MOUNT_RARITY_TONE: Record<string, StampTone> = {
  common: 'ink',
  uncommon: 'green',
  rare: 'blue',
  legendary: 'gold',
}

export function MountNamingModal({ mount, isOpen, onConfirm }: MountNamingModalProps) {
  const [inputValue, setInputValue] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  const handleConfirm = () => {
    const trimmed = inputValue.trim()
    onConfirm(trimmed.length > 0 ? trimmed : undefined)
    setInputValue('')
  }

  const handleSkip = () => {
    onConfirm(undefined)
    setInputValue('')
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onConfirm(undefined)
        setInputValue('')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onConfirm])

  if (!isOpen) return null

  const rarityTone = MOUNT_RARITY_TONE[mount.rarity] ?? 'ink'
  const personality = mount.personality ? MOUNT_PERSONALITY_INFO[mount.personality] : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim: the dark house */}
      <div className="absolute inset-0 bg-ps-house/70" onClick={handleSkip} />

      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-label="New Mount"
      >
      <PlaybillSheet className="p-5 text-center sm:p-6">
        <PlaybillTitle size="md">A new mount</PlaybillTitle>
        <p className="mt-2 font-body text-sm text-ps-ink-soft">Would you like to give it a name?</p>

        {/* The mount */}
        <div className="mt-4 rounded-[3px] border-2 border-ps-ink p-3 text-left">
          <div className="flex items-center gap-3">
            <span className="font-body text-3xl leading-none" aria-hidden>{mount.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-playbill text-lg leading-tight text-ps-ink">{mount.name}</span>
                <Stamp tone={rarityTone} tilt={false}>{mount.rarity}</Stamp>
              </div>
            </div>
          </div>
          <p className="mt-2 font-body text-sm leading-snug text-ps-ink-soft">{mount.description}</p>
          {personality && (
            <p className="mt-2 flex flex-wrap items-center gap-2 font-body text-xs text-ps-ink-soft">
              <Stamp tone="ink" tilt={false}>
                <span aria-hidden>{personality.icon}</span> {personality.label}
              </Stamp>
              <span>{personality.description}</span>
            </p>
          )}
        </div>

        {/* Name */}
        <label className="mt-4 block text-left">
          <PlaybillCaption>Name (optional)</PlaybillCaption>
          <input
            type="text"
            aria-label="Mount name (optional)"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.slice(0, 30))}
            placeholder="A name for your mount"
            maxLength={30}
            className="mt-1 h-10 w-full rounded-[3px] border-2 border-ps-ink bg-transparent px-3 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
            autoFocus
          />
        </label>
        <p className="mt-1 text-right font-label text-xs font-bold uppercase tracking-widest tabular-nums text-ps-ink-soft">{inputValue.length}/30</p>

        <div className="mt-4 flex gap-3">
          <PaperButton variant="outline" className="flex-1" onClick={handleSkip}>
            Skip
          </PaperButton>
          <PaperButton className="flex-1" onClick={handleConfirm}>
            Name it
          </PaperButton>
        </div>
      </PlaybillSheet>
      </div>
    </div>
  )
}

'use client'

import { useRef } from 'react'

import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle } from '@/app/tap-tap-adventure/stage/Playbill'

interface ShortcutGroup {
  title: string
  shortcuts: { key: string; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Travel',
    shortcuts: [
      { key: 'Space / Enter', description: 'Take a step' },
      { key: 'Esc', description: 'Close a drawer' },
    ],
  },
  {
    title: 'Choices',
    shortcuts: [{ key: '1 – 4', description: 'Pick a line on the bill' }],
  },
  {
    title: 'Fights',
    shortcuts: [
      { key: 'A', description: 'Attack' },
      { key: 'H', description: 'Heavy attack' },
      { key: 'D', description: 'Defend' },
      { key: 'F', description: 'Flee' },
      { key: 'Q', description: 'Class ability' },
      { key: 'E', description: 'End turn' },
    ],
  },
]

interface KeyboardHelpProps {
  onClose: () => void
}

/** The house rules, printed on a bill. */
export function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ps-house/70" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        className="relative w-full max-w-sm"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <PlaybillSheet className="px-5 pb-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <PlaybillTitle id="keyboard-help-title" size="md" className="flex-1">
              Keys
            </PlaybillTitle>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {SHORTCUT_GROUPS.map(group => (
              <div key={group.title}>
                <PlaybillCaption>{group.title}</PlaybillCaption>
                <dl className="mt-1.5 divide-y-2 divide-dotted divide-ps-ink/40">
                  {group.shortcuts.map(s => (
                    <div key={s.key} className="flex items-center justify-between gap-3 py-1.5 font-body text-sm text-ps-ink">
                      <dt>{s.description}</dt>
                      <dd>
                        <kbd className="rounded-[3px] border-2 border-ps-ink px-2 py-0.5 font-playbill text-xs uppercase tracking-wide">{s.key}</kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center font-body text-xs text-ps-ink-soft">
            Press <kbd className="rounded-[3px] border-2 border-ps-ink px-1.5 py-0.5 font-playbill text-xs">?</kbd> any time to see this
          </p>
          <PaperButton className="mt-4 w-full" onClick={onClose}>
            Back to the stage
          </PaperButton>
        </PlaybillSheet>
      </div>
    </div>
  )
}

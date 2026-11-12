'use client'

import { useEffect, useRef, useState } from 'react'

import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { PaperButton, PlaybillSheet, PlaybillTitle } from '@/app/tap-tap-adventure/stage/Playbill'

interface OnboardingHintProps {
  title: string
  body: string
  onDismiss: () => void
}

/** A small bill held up in front of the stage the first time something happens. */
export function OnboardingHint({ title, body, onDismiss }: OnboardingHintProps) {
  const [isVisible, setIsVisible] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (dismissTimerRef.current != null) clearTimeout(dismissTimerRef.current) }
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        setIsVisible(false)
        dismissTimerRef.current = setTimeout(onDismiss, 300)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    dismissTimerRef.current = setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-ps-house/70" onClick={handleDismiss} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative mx-4 w-full max-w-sm transition-[transform,opacity] duration-500 motion-reduce:transition-none ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-75'
        }`}
        onKeyDown={e => { if (e.key === 'Escape') handleDismiss() }}
      >
        <PlaybillSheet className="px-5 pb-5 pt-4 text-center">
          <PlaybillTitle size="md">{title}</PlaybillTitle>
          <p className="mt-3 font-body text-sm leading-relaxed text-ps-ink">{body}</p>
          <PaperButton className="mt-4 w-full" onClick={handleDismiss}>
            Got it
          </PaperButton>
        </PlaybillSheet>
      </div>
    </div>
  )
}

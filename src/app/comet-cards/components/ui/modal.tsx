'use client'

import { useEffect, useId, useRef } from 'react'

import { GhostButton } from '@/app/comet-cards/components/cosmic/buttons'

export function Modal({
  children,
  onClose,
  title,
  eyebrow,
}: {
  children: React.ReactNode
  onClose: () => void
  title?: string
  eyebrow?: string
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="cosmic-cards fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'var(--cc-modal-scrim)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full outline-none"
        style={{
          maxWidth: 720,
          margin: '0 5%',
          background:
            'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
          border: '1px solid var(--cc-modal-border)',
          borderRadius: 10,
          padding: 28,
          color: 'var(--cc-text-default)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {(eyebrow || title) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {eyebrow && (
                <div
                  className="uppercase"
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 11,
                    letterSpacing: 2,
                    opacity: 0.5,
                  }}
                >
                  {eyebrow}
                </div>
              )}
              {title && (
                <div id={titleId} style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{title}</div>
              )}
            </div>
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        )}
        {children}
        {!eyebrow && !title && (
          <div className="mt-4 flex justify-end">
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        )}
      </div>
    </div>
  )
}

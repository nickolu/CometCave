'use client'

import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'

interface SpoilerCardProps {
  questionId: string
  questionText: string
  userHasSeen: boolean
  children: React.ReactNode
  onReveal?: (questionId: string) => void
}

export function SpoilerCard({
  questionId,
  questionText,
  userHasSeen,
  children,
  onReveal,
}: SpoilerCardProps) {
  const [revealed, setRevealed] = useState(userHasSeen)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleRevealClick = () => {
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    setShowConfirm(false)
    setRevealed(true)
    onReveal?.(questionId)
  }

  const handleCancel = () => {
    setShowConfirm(false)
  }

  return (
    <>
      <ChunkyCard>
        <ChunkyCardContent>
          <p
            className={[
              'text-on-surface text-base mb-3 pt-4',
              'transition-[filter] duration-500',
              revealed ? '' : 'blur-[8px] select-none',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {questionText}
          </p>

          {children}

          {!revealed && (
            <div className="mt-4">
              <ChunkyButton variant="secondary" size="sm" onClick={handleRevealClick}>
                Reveal Question
              </ChunkyButton>
            </div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Reveal"
            className="bg-surface-container-high rounded-ds-lg p-6 max-w-sm mx-4 shadow-hero flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-on-surface text-sm">
              Revealing this question means it won&apos;t appear in your future trivia runs. Are you
              sure?
            </p>
            <div className="flex gap-3 justify-end">
              <ChunkyButton variant="secondary" size="sm" onClick={handleCancel}>
                Cancel
              </ChunkyButton>
              <ChunkyButton variant="primary" size="sm" onClick={handleConfirm}>
                Reveal
              </ChunkyButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

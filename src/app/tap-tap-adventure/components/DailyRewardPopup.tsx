'use client'

import { useEffect, useRef, useState } from 'react'

import { DailyReward } from '@/app/tap-tap-adventure/config/dailyRewards'
import { ClaimResult } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { BrassPlate, PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface DailyRewardPopupProps {
  streak: number
  reward: DailyReward
  onClaim: () => ClaimResult | null
  onDismiss: () => void
}

/** A season ticket: seven boxes, one stamped each day you come back. */
export function DailyRewardPopup({ streak, reward, onClaim, onDismiss }: DailyRewardPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => { if (dismissTimerRef.current != null) clearTimeout(dismissTimerRef.current) }
  }, [])

  useDialogFocus(dialogRef)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false)
        dismissTimerRef.current = setTimeout(onDismiss, 300)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  // Auto-dismiss after claiming
  useEffect(() => {
    if (!claimed) return
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [claimed, onDismiss])

  const dayInCycle = (streak % 7) + 1

  const handleClaim = () => {
    const result = onClaim()
    if (result) {
      setClaimResult(result)
      setClaimed(true)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    dismissTimerRef.current = setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ps-house/70" onClick={claimed ? handleDismiss : undefined} />

      {/* Content */}
      <div
        className={`relative mx-4 w-full max-w-sm transition-[transform,opacity] duration-500 motion-reduce:transition-none ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-75'
        }`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Daily reward"
          tabIndex={-1}
          className="outline-none"
        >
          <PlaybillSheet className="px-5 pb-5 pt-4 text-center">
            {!claimed ? (
              <>
                <PlaybillCaption>Day {dayInCycle} of 7</PlaybillCaption>
                <PlaybillTitle size="md" className="mt-1.5">Daily reward</PlaybillTitle>

                {/* The seven boxes on the ticket */}
                <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label={`Days claimed this week: ${dayInCycle} of 7`}>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const stamped = i < dayInCycle
                    const today = i === dayInCycle - 1
                    return (
                      <li
                        key={i}
                        className={cn(
                          'flex h-10 items-center justify-center rounded-[2px] border-2 font-playbill text-base leading-none tabular-nums',
                          stamped ? 'border-ps-stamp-gold text-ps-stamp-gold' : 'border-ps-ink/40 text-ps-ink-soft',
                          today && 'outline outline-2 outline-offset-1 outline-ps-stamp-red'
                        )}
                        aria-current={today ? 'date' : undefined}
                      >
                        <span className={cn(stamped && '-rotate-6')}>{i + 1}</span>
                      </li>
                    )
                  })}
                </ol>

                {/* The reward on brass */}
                <BrassPlate className="mt-4 px-4 py-3">
                  <p className="font-playbill text-lg uppercase leading-tight tracking-wide">{reward.label}</p>
                  <p className="mt-1 font-body text-xs leading-snug text-ps-ink/80">{reward.description}</p>
                </BrassPlate>

                <PaperButton variant="brass" className="mt-4 w-full" onClick={handleClaim}>
                  Claim reward
                </PaperButton>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="mt-2 rounded-[2px] px-2 py-1 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft hover:text-ps-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                >
                  Not now
                </button>
              </>
            ) : (
              <>
                <PlaybillTitle size="md">Claimed</PlaybillTitle>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="status">
                  {claimResult && claimResult.goldAwarded > 0 && (
                    <Stamp tone="gold" animate className="text-xs">+{claimResult.goldAwarded} gold</Stamp>
                  )}
                  {claimResult && claimResult.reputationAwarded > 0 && (
                    <Stamp tone="blue" animate className="text-xs">+{claimResult.reputationAwarded} repute</Stamp>
                  )}
                  {claimResult && claimResult.items.map(item => (
                    <Stamp key={item.id} tone="violet" animate className="text-xs">
                      {item.name}
                    </Stamp>
                  ))}
                </div>
                <PlaybillCaption className="mt-4">Closing…</PlaybillCaption>
              </>
            )}
          </PlaybillSheet>
        </div>
      </div>
    </div>
  )
}

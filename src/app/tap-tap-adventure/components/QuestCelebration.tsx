'use client'

import { useEffect, useRef, useState } from 'react'

import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'

interface QuestCelebrationProps {
  quest: TimedQuest
  onClaim: () => void
}

export function QuestCelebration({ quest, onClaim }: QuestCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (claimTimerRef.current != null) clearTimeout(claimTimerRef.current) }
  }, [])

  useEffect(() => {
    soundEngine.playVictory()
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleClaim = () => {
    setIsVisible(false)
    claimTimerRef.current = setTimeout(onClaim, 300)
  }

  const { rewards } = quest

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Quest complete"
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-ps-house/70" />
      <div
        className={`relative mx-4 w-full max-w-sm transition-[transform,opacity] duration-500 motion-reduce:transition-none ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-75'
        }`}
      >
        <PlaybillSheet className="px-6 pb-5 pt-6 text-center">
          <div className="flex justify-center">
            <Stamp tone="green" animate className="border-[3px] px-4 py-1.5 font-playbill text-2xl tracking-widest">
              Quest complete
            </Stamp>
          </div>
          <PlaybillTitle size="md" className="mt-4">{quest.title}</PlaybillTitle>

          <PlaybillCaption className="mt-4 text-center">Rewards</PlaybillCaption>
          <ul className="mt-1.5 divide-y divide-dotted divide-ps-ink/40 border-y-2 border-dotted border-ps-ink/40 text-left font-body text-sm text-ps-ink">
            {rewards.gold && (
              <li className="flex items-center justify-between gap-3 py-2">
                <span>Gold</span>
                <Stamp tone="gold" tilt={false}>+{rewards.gold}</Stamp>
              </li>
            )}
            {rewards.reputation && (
              <li className="flex items-center justify-between gap-3 py-2">
                <span>Reputation</span>
                <Stamp tone="blue" tilt={false}>+{rewards.reputation}</Stamp>
              </li>
            )}
            {rewards.items?.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span>{item.name}</span>
                <Stamp tone="violet" tilt={false}>Item</Stamp>
              </li>
            ))}
            {rewards.companion && (
              <li className="flex items-center justify-between gap-3 py-2">
                <span>
                  {rewards.companion.icon && <span className="mr-1" aria-hidden>{rewards.companion.icon}</span>}
                  {rewards.companion.name} joins your party
                </span>
                <Stamp tone="green" tilt={false}>Companion</Stamp>
              </li>
            )}
          </ul>

          <PaperButton className="mt-4 w-full" onClick={handleClaim}>
            Claim rewards
          </PaperButton>
        </PlaybillSheet>
      </div>
    </div>
  )
}

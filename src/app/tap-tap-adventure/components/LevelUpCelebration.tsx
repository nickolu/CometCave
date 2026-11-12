'use client'

import React, { useEffect, useRef, useState } from 'react'

import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { PaperButton, PlaybillSheet, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'

// Paper confetti: brass, paper and the printer's gold, never a glow.
const PARTICLE_COLORS = ['var(--ps-brass)', 'var(--ps-brass-light)', 'var(--ps-stamp-gold)', 'var(--ps-playbill)']
const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 2 * Math.PI
  const radius = [40, 55, 70][i % 3]
  const tx = Math.round(Math.cos(angle) * radius)
  const ty = Math.round(Math.sin(angle) * radius)
  const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length]
  return { id: i, tx, ty, color }
})

interface LevelUpCelebrationProps {
  level: number
  onDismiss: () => void
}

export function LevelUpCelebration({ level, onDismiss }: LevelUpCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  useEffect(() => {
    // Play level up sound
    soundEngine.playLevelUp()
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true))

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300) // wait for fade-out
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Level up!"
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ps-house/70" />

      {/* Content */}
      <div
        className={`pointer-events-auto relative mx-4 w-full max-w-sm transition-[transform,opacity] duration-500 motion-reduce:transition-none ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-75'
        }`}
        onClick={handleDismiss}
      >
        <PlaybillSheet className="px-6 pb-5 pt-6 text-center">
          {isVisible && PARTICLES.map(p => (
            <span
              key={p.id}
              className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 animate-particle-burst motion-reduce:hidden"
              style={{
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                backgroundColor: p.color,
                animationDelay: `${p.id * 40}ms`,
              } as React.CSSProperties}
              aria-hidden
            />
          ))}

          <div className="flex justify-center">
            <Stamp tone="gold" animate className="border-[3px] px-4 py-1.5 font-playbill text-3xl tracking-widest">
              Level {level}
            </Stamp>
          </div>

          <PlaybillTitle size="sm" className="mt-4">You grow stronger</PlaybillTitle>

          {/* The facts, ruled */}
          <ul className="mt-3 divide-y divide-dotted divide-ps-ink/40 text-left font-body text-sm text-ps-ink">
            <li className="flex justify-between py-1.5"><span>Strength</span><span className="tabular-nums text-ps-stamp-green">+1</span></li>
            <li className="flex justify-between py-1.5"><span>Intelligence</span><span className="tabular-nums text-ps-stamp-green">+1</span></li>
            <li className="flex justify-between py-1.5"><span>Luck</span><span className="tabular-nums text-ps-stamp-green">+1</span></li>
          </ul>

          <PaperButton className="mt-4 w-full" onClick={handleDismiss}>
            Continue
          </PaperButton>
        </PlaybillSheet>
      </div>
    </div>
  )
}

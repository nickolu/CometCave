'use client'

import React, { useEffect, useRef, useState } from 'react'

import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { PaperButton, PlaybillSheet, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

// One stamp colour per rarity; the confetti is cut from brass and paper.
const RARITY_CONFIG: Record<'legendary' | 'epic', { tone: StampTone; particleColors: readonly string[]; label: string }> = {
  legendary: {
    tone: 'gold',
    particleColors: ['var(--ps-brass)', 'var(--ps-brass-light)', 'var(--ps-stamp-gold)', 'var(--ps-playbill)'],
    label: 'Legendary',
  },
  epic: {
    tone: 'violet',
    particleColors: ['var(--ps-stamp-violet)', 'var(--ps-brass)', 'var(--ps-brass-light)', 'var(--ps-playbill)'],
    label: 'Epic',
  },
}

type CelebrationRarity = keyof typeof RARITY_CONFIG

const PARTICLE_COUNT = 16
function buildParticles(colors: readonly string[]) {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI
    const radius = [45, 62, 78][i % 3]
    return {
      id: i,
      tx: Math.round(Math.cos(angle) * radius),
      ty: Math.round(Math.sin(angle) * radius),
      color: colors[i % colors.length],
    }
  })
}

interface RareLootCelebrationProps {
  item: Item
  onDismiss: () => void
}

export function RareLootCelebration({ item, onDismiss }: RareLootCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (dismissTimerRef.current != null) clearTimeout(dismissTimerRef.current) }
  }, [])

  const rarity = (item.rarity === 'legendary' || item.rarity === 'epic')
    ? item.rarity as CelebrationRarity
    : 'epic'

  const config = RARITY_CONFIG[rarity]
  const particles = buildParticles(config.particleColors)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))

    const timer = setTimeout(() => {
      setIsVisible(false)
      dismissTimerRef.current = setTimeout(onDismiss, 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    dismissTimerRef.current = setTimeout(onDismiss, 300)
  }

  const effectsSummary = item.effects
    ? Object.entries(item.effects)
        .filter(([, v]) => v !== undefined && v !== 0)
        .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
        .join(', ')
    : null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Rare loot drop"
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
          {/* Particles */}
          {isVisible && particles.map(p => (
            <span
              key={p.id}
              className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 animate-particle-burst motion-reduce:hidden"
              style={{
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                backgroundColor: p.color,
                animationDelay: `${p.id * 30}ms`,
              } as React.CSSProperties}
              aria-hidden
            />
          ))}

          {/* Rarity stamp */}
          <div className="flex justify-center">
            <Stamp tone={config.tone} animate className="border-[3px] px-4 py-1.5 font-playbill text-3xl tracking-widest">
              {config.label}
            </Stamp>
          </div>

          {/* Item name */}
          <PlaybillTitle size="md" className="mt-4">{item.name}</PlaybillTitle>

          {/* Description */}
          <p className="mt-3 font-body text-sm leading-relaxed text-ps-ink">{item.description}</p>

          {/* Effects */}
          {effectsSummary && (
            <p className="mt-2 font-label text-xs font-bold uppercase tracking-widest text-ps-stamp-green">{effectsSummary}</p>
          )}

          {/* Lore text */}
          {item.loreText && (
            <p className="mt-3 font-body text-xs italic leading-relaxed text-ps-ink-soft">&ldquo;{item.loreText}&rdquo;</p>
          )}

          <PaperButton className="mt-4 w-full" onClick={handleDismiss}>
            Continue
          </PaperButton>
        </PlaybillSheet>
      </div>
    </div>
  )
}

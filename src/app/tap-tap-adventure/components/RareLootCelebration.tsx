'use client'

import React, { useEffect, useState } from 'react'
import { Item } from '@/app/tap-tap-adventure/models/types'

const RARITY_CONFIG = {
  legendary: {
    borderColor: 'border-amber-500',
    glowColor: 'shadow-amber-500/40',
    textColor: 'text-amber-400',
    bgGlow: 'bg-amber-900/20',
    particleColors: ['#FACC15', '#FB923C', '#FDE047', '#F59E0B'],
    label: 'LEGENDARY',
    emoji: '✨',
  },
  epic: {
    borderColor: 'border-purple-500',
    glowColor: 'shadow-purple-500/40',
    textColor: 'text-purple-400',
    bgGlow: 'bg-purple-900/20',
    particleColors: ['#A78BFA', '#C084FC', '#7C3AED', '#DDD6FE'],
    label: 'EPIC',
    emoji: '💜',
  },
} as const

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

  const rarity = (item.rarity === 'legendary' || item.rarity === 'epic')
    ? item.rarity as CelebrationRarity
    : 'epic'

  const config = RARITY_CONFIG[rarity]
  const particles = buildParticles(config.particleColors)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))

    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300)
  }

  const effectsSummary = item.effects
    ? Object.entries(item.effects)
        .filter(([, v]) => v !== undefined && v !== 0)
        .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
        .join(', ')
    : null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/50 ${config.bgGlow}`} />

      {/* Content */}
      <div
        className={`relative pointer-events-auto transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-75 translate-y-8'
        }`}
        onClick={handleDismiss}
      >
        <div className={`relative bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 ${config.borderColor} rounded-2xl px-10 py-8 text-center shadow-2xl ${config.glowColor} max-w-sm mx-4`}>
          {/* Particles */}
          {isVisible && particles.map(p => (
            <span
              key={p.id}
              className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full pointer-events-none animate-particle-burst"
              style={{
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                backgroundColor: p.color,
                animationDelay: `${p.id * 30}ms`,
              } as React.CSSProperties}
            />
          ))}

          {/* Emoji sparkles */}
          <div className="text-3xl mb-2">
            <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>{config.emoji}</span>
            <span className="inline-block animate-bounce mx-2" style={{ animationDelay: '150ms' }}>{config.emoji}</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>{config.emoji}</span>
          </div>

          {/* Rarity badge */}
          <div className={`text-xs font-black tracking-widest uppercase mb-2 ${config.textColor}`}>
            {config.label} DROP
          </div>

          {/* Item name */}
          <h2 className={`text-2xl font-bold mb-3 ${config.textColor}`}>{item.name}</h2>

          {/* Description */}
          <p className="text-slate-300 text-sm mb-2">{item.description}</p>

          {/* Effects */}
          {effectsSummary && (
            <p className="text-emerald-400 text-xs font-semibold mb-2">{effectsSummary}</p>
          )}

          {/* Lore text */}
          {item.loreText && (
            <p className="text-amber-300/70 text-xs italic mb-3">&ldquo;{item.loreText}&rdquo;</p>
          )}

          {/* Dismiss hint */}
          <p className="text-slate-500 text-xs mt-3">Tap to continue</p>
        </div>
      </div>
    </div>
  )
}

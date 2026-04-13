'use client'

import { useEffect, useState } from 'react'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

interface LevelUpCelebrationProps {
  level: number
  onDismiss: () => void
}

export function LevelUpCelebration({ level, onDismiss }: LevelUpCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false)

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

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div
        className={`relative pointer-events-auto transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-75 translate-y-8'
        }`}
        onClick={() => {
          setIsVisible(false)
          setTimeout(onDismiss, 300)
        }}
      >
        <div className="bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 border-yellow-500/50 rounded-2xl px-10 py-8 text-center shadow-2xl shadow-yellow-500/20">
          {/* Stars */}
          <div className="text-4xl mb-2">
            <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>
              *
            </span>
            <span className="inline-block animate-bounce mx-2" style={{ animationDelay: '150ms' }}>
              *
            </span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>
              *
            </span>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-yellow-400 mb-1">Level Up!</h2>

          {/* Level */}
          <div className="text-6xl font-black text-white my-3">{level}</div>

          {/* Stats message */}
          <p className="text-slate-300 text-sm mb-4">
            +1 Strength, +1 Intelligence, +1 Luck
          </p>

          {/* Dismiss hint */}
          <p className="text-slate-500 text-xs">Tap to continue</p>
        </div>
      </div>
    </div>
  )
}

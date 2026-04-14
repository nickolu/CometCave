'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'

interface OnboardingHintProps {
  title: string
  body: string
  onDismiss: () => void
}

export function OnboardingHint({ title, body, onDismiss }: OnboardingHintProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        setIsVisible(false)
        setTimeout(onDismiss, 300)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={handleDismiss} />
      <div
        className={`relative transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-75 translate-y-8'
        }`}
      >
        <div className="bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 border-amber-500/50 rounded-2xl px-8 py-6 text-center shadow-2xl shadow-amber-500/20 max-w-sm mx-4">
          <p className="text-amber-400 font-bold text-lg mb-3">{title}</p>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">{body}</p>
          <Button
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-md"
            onClick={handleDismiss}
          >
            Got it!
          </Button>
        </div>
      </div>
    </div>
  )
}

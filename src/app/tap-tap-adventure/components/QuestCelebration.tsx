'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'

interface QuestCelebrationProps {
  quest: TimedQuest
  onClaim: () => void
}

export function QuestCelebration({ quest, onClaim }: QuestCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    soundEngine.playVictory()
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleClaim = () => {
    setIsVisible(false)
    setTimeout(onClaim, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className={`relative transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-75 translate-y-8'
        }`}
      >
        <div className="bg-gradient-to-b from-[#1e1f30] to-[#161723] border-2 border-emerald-500/50 rounded-2xl px-8 py-6 text-center shadow-2xl shadow-emerald-500/20 max-w-sm mx-4">
          <div className="text-3xl mb-2">
            <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>🏆</span>
            <span className="inline-block animate-bounce mx-2" style={{ animationDelay: '150ms' }}>⭐</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>🏆</span>
          </div>
          <h2 className="text-2xl font-bold text-emerald-400 mb-1">Quest Complete!</h2>
          <p className="text-slate-300 text-sm mb-4">{quest.title}</p>

          <div className="bg-emerald-950/40 border border-emerald-700/30 rounded-lg p-3 mb-4 space-y-1">
            <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wider mb-1">Rewards</p>
            {quest.rewards.gold && (
              <p className="text-sm text-yellow-400">+{quest.rewards.gold} Gold</p>
            )}
            {quest.rewards.reputation && (
              <p className="text-sm text-blue-400">+{quest.rewards.reputation} Reputation</p>
            )}
            {quest.rewards.items?.map(item => (
              <p key={item.id} className="text-sm text-purple-400">+ {item.name}</p>
            ))}
          </div>

          <Button
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-md"
            onClick={handleClaim}
          >
            Claim Rewards
          </Button>
        </div>
      </div>
    </div>
  )
}

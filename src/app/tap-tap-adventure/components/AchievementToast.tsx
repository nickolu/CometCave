'use client'

import { useEffect, useState } from 'react'
import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'

interface AchievementToastProps {
  achievementId: string
  onDismiss: () => void
}

export function AchievementToast({ achievementId, onDismiss }: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)

  useEffect(() => {
    // Animate in
    const showTimeout = setTimeout(() => setIsVisible(true), 50)
    // Auto-dismiss after 3 seconds
    const dismissTimeout = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300) // Wait for fade-out animation
    }, 3000)

    return () => {
      clearTimeout(showTimeout)
      clearTimeout(dismissTimeout)
    }
  }, [onDismiss])

  if (!achievement) return null

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-gradient-to-r from-amber-900/90 to-yellow-900/90 border border-amber-500/50 rounded-lg px-5 py-3 shadow-lg shadow-amber-500/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{achievement.icon}</span>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
              Achievement Unlocked!
            </div>
            <div className="text-sm font-bold text-white">{achievement.name}</div>
            <div className="text-[10px] text-amber-200/70">{achievement.description}</div>
            {(achievement.reward?.gold || achievement.reward?.reputation) && (
              <div className="text-[10px] text-yellow-300 font-semibold mt-0.5">
                Reward:{' '}
                {achievement.reward.gold ? `+${achievement.reward.gold}g` : ''}
                {achievement.reward.gold && achievement.reward.reputation ? ', ' : ''}
                {achievement.reward.reputation ? `+${achievement.reward.reputation} rep` : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AchievementToastContainer({ achievementIds }: { achievementIds: string[] }) {
  const [queue, setQueue] = useState<string[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)

  useEffect(() => {
    if (achievementIds.length > 0) {
      setQueue(prev => [...prev, ...achievementIds])
    }
  }, [achievementIds])

  useEffect(() => {
    if (!currentId && queue.length > 0) {
      setCurrentId(queue[0])
      setQueue(prev => prev.slice(1))
    }
  }, [currentId, queue])

  if (!currentId) return null

  return <AchievementToast achievementId={currentId} onDismiss={() => setCurrentId(null)} />
}

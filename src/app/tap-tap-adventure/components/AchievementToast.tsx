'use client'

import { useEffect, useRef, useState } from 'react'

import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'
import { PlaybillCaption, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'

interface AchievementToastProps {
  achievementId: string
  onDismiss: () => void
}

/** A small bill dropped from the flies for a moment. */
export function AchievementToast({ achievementId, onDismiss }: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)

  useEffect(() => {
    // Animate in
    const showTimeout = setTimeout(() => setIsVisible(true), 50)
    // Auto-dismiss after 3 seconds
    const dismissTimeout = setTimeout(() => {
      setIsVisible(false)
      dismissTimerRef.current = setTimeout(onDismiss, 300)
    }, 3000)

    return () => {
      clearTimeout(showTimeout)
      clearTimeout(dismissTimeout)
      if (dismissTimerRef.current != null) clearTimeout(dismissTimerRef.current)
    }
  }, [onDismiss])

  if (!achievement) return null

  const { reward } = achievement

  return (
    <div
      className={`fixed left-1/2 top-4 z-[100] w-[calc(100%-32px)] md:top-24 max-w-sm -translate-x-1/2 transition-[transform,opacity] duration-300 motion-reduce:transition-none ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
      role="status"
    >
      <div className="ps-paper flex items-center gap-3 rounded-[3px] border-2 border-ps-ink px-4 py-3 text-ps-ink">
        <span className="shrink-0 font-body text-2xl leading-none" aria-hidden>{achievement.icon}</span>
        <div className="min-w-0 flex-1">
          <PlaybillCaption>Achievement unlocked</PlaybillCaption>
          <p className="mt-0.5 truncate font-playbill text-base uppercase leading-tight tracking-wide">{achievement.name}</p>
          <p className="mt-0.5 font-body text-xs leading-snug text-ps-ink-soft">{achievement.description}</p>
          {(reward?.gold || reward?.reputation) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {reward.gold ? <Stamp tone="gold" tilt={false}>+{reward.gold} gold</Stamp> : null}
              {reward.reputation ? <Stamp tone="blue" tilt={false}>+{reward.reputation} repute</Stamp> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AchievementToastContainer({ achievementIds }: { achievementIds: string[] }) {
  // Newly completed ids are queued as they arrive; the head of the queue is on
  // screen, and dismissing it shows the next. The queue is kept as state
  // derived from the prop during render, not in an effect.
  const [queue, setQueue] = useState<string[]>([])
  const [seenIds, setSeenIds] = useState<string[] | null>(null)
  const [shown, setShown] = useState(0)

  if (achievementIds !== seenIds) {
    setSeenIds(achievementIds)
    if (achievementIds.length > 0) {
      setQueue(prev => [...prev, ...achievementIds])
    }
  }

  const currentId = queue[0] ?? null
  if (!currentId) return null

  return (
    <AchievementToast
      key={shown}
      achievementId={currentId}
      onDismiss={() => {
        setQueue(prev => prev.slice(1))
        setShown(s => s + 1)
      }}
    />
  )
}

'use client'

import { useCallback, useState } from 'react'

const HINT_KEYS = ['first-tap', 'first-combat', 'first-item', 'first-crossroads'] as const
export type HintKey = (typeof HINT_KEYS)[number]

function storageKey(characterId: string, hint: HintKey): string {
  return `tta-onboarding-${characterId}-${hint}`
}

export function useOnboarding(characterId: string | null | undefined) {
  // Counter to force re-render when a hint is dismissed
  const [, setTick] = useState(0)

  const hasSeenHint = useCallback(
    (hint: HintKey): boolean => {
      if (!characterId || typeof window === 'undefined') return false
      return localStorage.getItem(storageKey(characterId, hint)) === '1'
    },
    [characterId]
  )

  const markHintSeen = useCallback(
    (hint: HintKey) => {
      if (!characterId || typeof window === 'undefined') return
      localStorage.setItem(storageKey(characterId, hint), '1')
      setTick(t => t + 1)
    },
    [characterId]
  )

  return { hasSeenHint, markHintSeen }
}

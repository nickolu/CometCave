'use client'
import { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import type { MedalTier } from '@/lib/trivia/medals'

export interface CategoryMedalSummary {
  categoryId: number
  categoryName: string
  correctCount: number
  tier: MedalTier
  label: string | null
  nextThreshold: number | null
}

interface State {
  loading: boolean
  byCategoryId: Map<number, CategoryMedalSummary>
}

const EMPTY: State = { loading: false, byCategoryId: new Map() }

export function useCategoryMedals(): State {
  const { user } = useAuth()
  const [state, setState] = useState<State>(EMPTY)

  useEffect(() => {
    if (!user) {
      setState(EMPTY)
      return
    }

    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/v1/trivia/infinite/category-stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load category medals')
        const data = (await res.json()) as { medals: CategoryMedalSummary[] }
        if (cancelled) return
        const byCategoryId = new Map<number, CategoryMedalSummary>()
        for (const m of data.medals) byCategoryId.set(m.categoryId, m)
        setState({ loading: false, byCategoryId })
      } catch {
        if (!cancelled) setState(EMPTY)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  return state
}

export const TIER_EMOJI: Record<MedalTier, string> = {
  none: '',
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '🏅',
  diamond: '💎',
}
